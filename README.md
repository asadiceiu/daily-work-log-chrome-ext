# Daily Work Log Chrome Extension

A minimal Chrome extension that lets you:
- Add tasks quickly with a single input field (`Enter` to save).
- Keep separate task logs for each day.
- Move between days using left/right navigation.
- Edit task text inline by clicking a task.
- Toggle a weekly view with per-day groups.
- Export all logs to CSV from the bottom action bar.
- Open a full-page app view from the popup (`Full App` button).

## Files
- `manifest.json`: Extension configuration (Manifest V3).
- `popup.html`: Popup UI markup.
- `popup.css`: Popup styling.
- `popup.js`: Date navigation + task storage logic.
- `app.html`: Full-page app UI markup.
- `app.css`: Full-page layout and style overrides.

## Load in Chrome
1. Open `chrome://extensions`.
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked**.
4. Select this folder: `/Users/aasa0007/Python/ChromeExt/daily-work-log`.
5. Pin the extension and click its icon to open the task logger.
6. Use **Full App** in the popup to open the full-page workspace.

## How it works
- Tasks are saved in `chrome.storage.local`.
- Data is grouped by date key (`YYYY-MM-DD`).
- The selected day and view mode are saved, so reopening resumes your context.

## Quick improvement ideas
- Add a keyboard shortcut command to open the popup.
- Add drag-and-drop task ordering.
- Add a compact monthly heatmap view.
