# Contributing to Frnt Notes

Thanks for helping! Issues and pull requests in English or Vietnamese are both welcome.

## Getting started

```bash
git clone https://github.com/<you>/frnt-notes.git
cd frnt-notes
npm install
npm run dev            # http://localhost:3001, hot reload (server restarts on server/ changes)
```

Use a throw-away data folder while developing so you don't touch your real notes:

```bash
DATA_DIR=/tmp/frnt-dev npm run dev
```

Before opening a PR:

```bash
npm run build          # the frontend must compile
npm run smoke          # macOS/Linux: launches the desktop app headless and checks it loads
```

## Project layout

| Path | What |
|---|---|
| `server/app.js` | All API routes, SQLite schema & migrations, backups, versions |
| `server/seed.js` | Welcome page & built-in templates |
| `electron/main.mjs` | Desktop wrapper |
| `src/Editor.jsx` | BlockNote editor, custom blocks, slash / `@` menus |
| `src/db/` | Database feature (views, cells, filters, sorts) |
| `src/importer.js` | Notion / Markdown import |

## Guidelines

- Keep it **local-first**: no telemetry, no required accounts, no network calls to third parties.
- Schema changes go through the migration block at the top of `startServer()` (add columns, never drop).
- Keep dependencies small. The packaged app only ships `express` as its runtime dependency. Frontend libs are bundled by Vite.
- UI strings are in Vietnamese for now. If you are working on i18n, please open an issue first so we agree on the approach.

## Releasing (maintainers)

1. Bump `version` in `package.json`.
2. `git tag vX.Y.Z && git push --tags`.
3. GitHub Actions builds the macOS, Windows and Linux installers and attaches them to the release.
