# Changelog

All notable changes to Frnt are listed here, newest first.
The format follows [Keep a Changelog](https://keepachangelog.com) and versions follow [Semantic Versioning](https://semver.org).
Each section is also used as the release notes on GitHub and in the app's update dialog.

## [0.6.2] - 2026-11-26

### Added
- **Top Notion templates** tab in the Template library: 24 popular templates from Notion's public gallery (11 made by Notion), with search and categories. **Import…** opens the guided Notion-link import with the link filled in; **Open in Notion** opens the template. The list lives in `library/notion-picks.json`, so maintainers can update it without a new app release.

### Fixed
- Long badges in template cards no longer wrap.

## [0.6.1] - 2026-11-26

### Added
- `CHANGELOG.md`. Release notes on GitHub (and in the in-app update dialog) are now generated from it automatically.

## [0.6.0] - 2026-11-26

### Added
- **In-app updates.** Frnt checks GitHub for a new version once a day (can be turned off in Settings → Version & updates) and shows a notice in the sidebar. **Update now** downloads the right file for your system and installs it: on macOS the app replaces itself and restarts, Windows runs the installer, and Linux updates the AppImage. You can also check manually in Settings or Help → Check for updates.
- Links to Notion's free template gallery from the Template library and the "From a Notion link" dialog.

### Changed
- Running Frnt with a custom `DATA_DIR` uses a separate app profile, so a second, separate Frnt can run next to the main one.

## [0.5.1] - 2026-11-26

### Added
- **Add a template from a Notion link.** Paste a notion.so / notion.site / notion.com link; Frnt opens it in Notion and walks you through *Duplicate → Export (Markdown & CSV)*; drop the .zip in and it can be saved straight to your Templates. It uses only Notion's official Duplicate and Export features.

## [0.5.0] - 2026-11-25

### Added
- **Group by** in table views (status, select, multi-select, checkbox, date by month, text, number), with collapsible groups, counts, and "+ New" inside a group that pre-fills its value.
- **Column calculations** in the table footer: count, unique, empty / not empty, percentages, sum, average, median, min, max, range, % checked, earliest / latest date.
- **Template library**, shared through this repository's `library/` folder: search, category and language filters, "New" badges, an offline copy, "Use template" and "+ My templates". 12 starter templates in English and Vietnamese.
- **Export as library template** (page ⋯ menu) and `npm run library:build` for maintainers.

## [0.4.1] - 2026-11-25

### Changed
- The sidebar can be widened up to 70% of the window. Deep page levels are indented more compactly, full titles show on hover, and thin guide lines show nesting.
- Long breadcrumbs collapse to *first / … / last two*; "…" lists the hidden levels.

### Fixed
- Breadcrumbs no longer overlap the "Edited …" status.

## [0.4.0] - 2026-11-25

### Added
- Resizable sidebar (drag its edge; double-click to reset).
- **Open in browser** (desktop app): the same notes in your web browser at `http://localhost:37291`.
- New welcome page about Frnt's key points.

### Fixed
- The app hung when its preferred port was already in use; it now picks a free port.

## [0.3.0] - 2026-11-25

### Added
- Notion import rebuilt for large workspaces (tested with a 615 MB export: 5,500 pages, 195 databases, 735 images in about 30 seconds). It supports Notion's current export layout, detects date and multi-select columns, shows progress, and writes an "Import report" page listing anything that couldn't be imported.
- Large databases render progressively ("Load more").

### Fixed
- **"Failed to fetch"** when saving or importing long pages (over 64 KB).
- Error messages now say which request failed and why.

## [0.2.1] - 2026-11-25

### Fixed
- Vietnamese letters with stacked accents (ầ, ể, ừ, ộ…) rendered in mixed fonts. Frnt now uses system fonts that fully support Vietnamese.

## [0.2.0] - 2026-11-25

### Added
- English and Vietnamese interface with a language switch.

### Changed
- Renamed to **Frnt (Free Notes)**.
- README: system requirements, feature list, comparison with Notion.

## [0.1.0] - 2026-11-25

### Added
- First public release: block editor, nested pages, databases (table and board), version history, templates, backlinks, Notion and Markdown import, daily automatic backups, light and dark themes, and desktop apps for macOS, Windows and Linux.

[0.6.2]: https://github.com/thanhmam/frnt-notes/compare/v0.6.1...v0.6.2
[0.6.1]: https://github.com/thanhmam/frnt-notes/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/thanhmam/frnt-notes/compare/v0.5.1...v0.6.0
[0.5.1]: https://github.com/thanhmam/frnt-notes/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/thanhmam/frnt-notes/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/thanhmam/frnt-notes/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/thanhmam/frnt-notes/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/thanhmam/frnt-notes/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/thanhmam/frnt-notes/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/thanhmam/frnt-notes/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/thanhmam/frnt-notes/releases/tag/v0.1.0
