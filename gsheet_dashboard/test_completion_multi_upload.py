from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import json
import unittest
from flask import Flask
from openpyxl import Workbook
from production_export import register_production_export


def report(rows):
    book=Workbook()
    book.active.append(['Order Number','Completed Time (hours)'])
    for row in rows: book.active.append(row)
    data=BytesIO();book.save(data);book.close();data.seek(0)
    return data


class CompletionBatchTests(unittest.TestCase):
    def test_batch_deduplicates_and_excludes_all_conflicts(self):
        with TemporaryDirectory() as folder:
            workspace=SimpleNamespace(store=SimpleNamespace(root=Path(folder)/'previews'))
            app=Flask(__name__)
            app.config['MAX_CONTENT_LENGTH']=256  # The batch route must override the single-file limit.
            register_production_export(app,workspace,lambda _:None)
            response=app.test_client().post('/api/production-report/completion-upload',data={'files':[
                (report([['A','11/7/2026'],['B','11/7/2026'],['C','11/7/2026'],['C','11/8/2026']]),'one.xlsx'),
                (report([['A','11/7/2026'],['B','11/8/2026'],['C','11/7/2026'],['D','11/8/2026']]),'two.xlsx')]})
            self.assertEqual(response.status_code,200,response.json)
            self.assertEqual(response.json['files'],2)
            self.assertEqual(response.json['orders'],2)
            self.assertEqual(response.json['conflicts'],2)
            saved=Path(folder)/'production-exports/completion-uploads'/(response.json['token']+'.json')
            self.assertEqual(set(json.loads(saved.read_text())),{'a','d'})

    def test_invalid_batch_does_not_publish_partial_upload(self):
        with TemporaryDirectory() as folder:
            app=Flask(__name__)
            register_production_export(app,SimpleNamespace(store=SimpleNamespace(root=Path(folder)/'previews')),lambda _:None)
            response=app.test_client().post('/api/production-report/completion-upload',data={'files':[
                (report([['A','11/7/2026']]),'good.xlsx'),(BytesIO(b'invalid'),'bad.xlsx')]})
            self.assertEqual(response.status_code,400)
            self.assertFalse(list(Path(folder).rglob('*.json')))
