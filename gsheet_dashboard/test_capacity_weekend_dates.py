import unittest
from monthly_production import local_datetime
from capacity_calculations import capacity_completions


class WeekendTextDateTests(unittest.TestCase):
    def test_production_text_dates_roll_back_to_friday(self):
        rows = [{'Order Number': str(i), 'Status': 'Completed and delivered',
                 'Out Time': value} for i, value in enumerate(
                    ['06-11-2026', '07-11-2026', '08-11-2026', '14-11-2026'])]
        completed, missing = capacity_completions(
            [{'Date': '2026-11-03', 'rows': rows}], out_time_only=True)
        self.assertEqual(missing, 0)
        self.assertEqual({day: len(values) for day, values in completed.items()},
                         {'2026-11-06': 3, '2026-11-13': 1})
        self.assertEqual(completed['2026-11-06'][1]['Source completion date'], '2026-11-07')

    def test_slash_dates_still_use_portal_month_first_format(self):
        self.assertEqual(local_datetime('11/7/2026 5:00:00 PM').isoformat(), '2026-11-07T17:00:00')
        self.assertIsNone(local_datetime('31-11-2026'))
