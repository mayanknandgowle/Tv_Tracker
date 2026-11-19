# Tv Tracker handover

## Where to work

| Area | Location |
| --- | --- |
| Windows window, settings vault and updater | `desktop/main.cjs`, `desktop/settings.cjs`, `desktop/updater.cjs` |
| Desktop and browser workspace | `gsheet_dashboard/frontend/src/main.jsx` |
| Standalone sample dashboard and synthetic data | `gsheet_dashboard/frontend/demo.html`, `gsheet_dashboard/frontend/src/demo/` |
| Local API, reporting, and Sheets sync | `gsheet_dashboard/server.py`, `report_workspace.py`, `tracker_sync.py` |
| TitleVision capture | `gsheet_dashboard/scrape_datatrace.js` |
| Windows build and release validation | `desktop/build.ps1`, `.github/workflows/desktop-release.yml` |

Electron starts a Python engine on loopback and authorizes local API requests. Production tracker rows live in Google Sheets. Captures, import history and pending sync jobs live in the local workspace. The sample page loads synthetic rows directly in the browser.

## Connect or migrate a workspace

- In **Connections & settings**, set the spreadsheet URL, tracker tab names and TitleVision connection. Import an owner-provisioned service-account JSON key. Enable the Sheets API and share the target spreadsheet with that service account as Editor. Use **Test saved Google Sheets connection** before the first sync.
- This fork uses `%APPDATA%\Tv Tracker Workspace`. To move from the upstream edition, create a backup from its **Local data & recovery** settings and restore it in this edition. Re-enter credentials in the new profile. Use a staging spreadsheet to check the migration before scheduling capture or sync.
- The default tracker XLSX files ship with headers and no order rows. Connect the existing production Sheets to retain those records. For a private build that requires baseline seeding, replace the two templates with approved workbooks of the same names and preserve their `TV Orders` and `Sheet1` tabs.
- Use **Create backup** before a migration or a bulk import. Backups cover workspace data. Store credentials separately through approved account provisioning.

## Build and validate

Use Windows x64, Python 3.12 x64, and Node.js 22.12+. From the root in PowerShell:

```powershell
.\desktop\build.ps1 -Python python
npm.cmd --prefix desktop test
$env:PYTHONPATH = "$pwd/.desktop-build/deps;$pwd/gsheet_dashboard"
python -m unittest discover -s gsheet_dashboard -p "test_*.py"
Push-Location gsheet_dashboard/frontend
npx.cmd playwright test --config playwright.reports.config.js
Pop-Location
```

The build uses lockfiles and writes the installer and portable ZIP to `release/<version>/`. Use `-DirectoryOnly` for an unpacked build. The report and sample browser tests use Edge and local fixtures. The desktop browser config uses Chrome. End-to-end checks against live TitleVision and Google Sheets require a provisioned test account and spreadsheet.

## Publish a release

Update the versions in the desktop and frontend package manifests and their lockfiles together. Tag the tested `main` commit with the matching `v<version>` and push the tag. The Windows workflow validates the tag, builds and tests, checks the installer against its updater manifest, and stages the full asset set before publishing. The updater reads the Latest release in `mayanknandgowle/Tv_Tracker`.

The Windows assets include the installer, portable ZIP, source ZIP, updater metadata and checksums. Builds can use the optional CI signing secrets described in the workflow. Without a signing certificate, Windows may display an unknown-publisher prompt.
