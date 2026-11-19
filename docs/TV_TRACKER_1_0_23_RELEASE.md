# Tv Tracker 1.0.23

Released November 16, 2026.

- Preserves Production Report uploaded ExcelReports, results, folder, selected preview, routing, status overrides, and toggle choices when navigating to Capacity Report and back during the current session. Reloading or restarting starts a new session.
- Parses day-month-year production dates correctly so weekend completions are included in Friday capacity totals.
- Moves every Saturday and Sunday completion to the preceding Friday during production Excel updates, including existing weekend Out Times, while retaining the time of day.
- Supports selecting or dragging multiple Completed ExcelReports, with combined order counts and exclusion of conflicting completion times across files.
- Adds a Completed in TV switch and a KPI for Full Search and C-O and Update. Review matched orders not marked completed in production, then use Proceed to mark them Completed and Delivered and fill missing Out Times.
- Shows previous and planned completion dates before applying changes; preserves category switches, workbook change checks, backups, and Revert.
- Simplifies the Production Report screen, enlarges the Excel update controls, and removes worksheet labels from report cards.

Local captures and encrypted connections are retained. The Windows installer follows the existing unsigned distribution process; Windows may show an unknown-publisher warning.
