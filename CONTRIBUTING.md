# Contributing to Freenote

Thanks for helping! Issues and pull requests in English or Vietnamese are both welcome.

## Getting started

```bash
git clone https://github.com/<you>/freenote.git
cd freenote
npm install
npm run dev            # http://localhost:3001, hot reload (server restarts on server/ changes)
```

Use a throw-away data folder while developing so you don't touch your real notes:

```bash
DATA_DIR=/tmp/freenote-dev npm run dev
```

Before opening a PR:

```bash
npm run i18n:check     # every UI string must have a translation
npm run build          # the frontend must compile
npm run smoke          # macOS/Linux: launches the desktop app headless and checks it loads
```

## Project layout

| Path | What |
|---|---|
| `server/app.js` | All API routes, SQLite schema & migrations, backups, versions |
| `server/seed.js` | Welcome page & built-in templates (per language) |
| `electron/main.mjs` | Desktop wrapper |
| `src/i18n.js`, `src/locales/` | Translations |
| `src/Editor.jsx` | BlockNote editor, custom blocks, slash / `@` menus |
| `src/db/` | Database feature (views, cells, filters, sorts) |
| `src/importer.js` | Notion / Markdown import |

## Translations

English is the source language: UI strings are written in English and wrapped in `t()`:

```jsx
import { t } from "./i18n.js";
<button>{t("New page")}</button>
t("Edited {time}", { time })      // placeholders in {braces}
```

**To add a language** (for example French):

1. Copy `src/locales/vi.js` to `src/locales/fr.js` and translate the values (keep the keys in English).
2. Register it in `LOCALES` in `src/i18n.js`, using a BlockNote editor locale if one exists (`bnLocales.fr`) and a date locale such as `"fr-FR"`.
3. Optionally add first-run content for it in `server/seed.js`.
4. Run `npm run i18n:check`. It lists any missing keys.

When you add a new UI string, wrap it in `t("...")` and add its translation to every file in `src/locales/`. CI fails if a translation is missing.

## Templates

To add a template to the shared library, see [library/README.md](library/README.md).

## Guidelines

- Keep it **local-first**: no telemetry, no required accounts, no network calls to third parties. The exceptions are the daily update check (GitHub Releases, can be turned off) and the Template library, which is fetched only when the user opens it.
- Schema changes go through the migration block at the top of `startServer()` (add columns, never drop).
- Keep dependencies small. The packaged app only ships `express` as its runtime dependency. Frontend libs are bundled by Vite.

## Releasing (maintainers)

1. Add a `## [X.Y.Z] - YYYY-MM-DD` section at the top of `CHANGELOG.md` (Added / Changed / Fixed), plus its compare link at the bottom. Preview the notes with `npm run release-notes`.
2. Bump `version` in `package.json`.
3. `git tag vX.Y.Z && git push --tags`.
4. GitHub Actions checks the changelog section, builds the macOS, Windows and Linux installers, and uses that section as the release notes. Apps show the notes in their update dialog.
