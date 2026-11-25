<p align="center">
  <img src="build/icon.png" width="96" alt="Frnt Notes icon" />
</p>

<h1 align="center">Frnt Notes</h1>

<p align="center">
  A free, open-source, <b>local-first</b> alternative to Notion.<br/>
  Block editor · nested pages · databases (table &amp; board) · version history · Notion import.<br/>
  No account. No limits on pages or blocks. Your data is a single SQLite file on your own disk.
</p>

<p align="center">
  <a href="../../releases/latest"><b>⬇ Download</b></a> ·
  <a href="#run-from-source">Run from source</a> ·
  <a href="README.vi.md">Tiếng Việt</a>
</p>

![Editor](docs/screenshots/editor.png)

| Board view (dark) | Table view |
|---|---|
| ![Board](docs/screenshots/board-dark.png) | ![Table](docs/screenshots/table.png) |

> **Note:** the interface is currently in **Vietnamese** only. English UI (i18n) is the #1 item on the roadmap. Contributions are very welcome!

## Features

- **Block editor**: type `/` for headings, to-dos, toggles, quotes, code, tables, images/video/files, dividers. Drag blocks to reorder. Markdown shortcuts. Rich-text toolbar.
- **Pages**: unlimited nesting, emoji icons, cover images, breadcrumbs, favourites, full-width mode, drag & drop in the sidebar.
- **Links**: `/Trang con` creates a sub-page inline; `@` links to any page (titles stay in sync). Each page shows its **backlinks**.
- **Databases**: table and Kanban board views, 10 property types (text, number, select, multi-select, status, date, checkbox, URL, created/edited time), filters, multi-level sorts, column resizing, several views per database, inline or full-page. Each row is a full page.
- **Search** (`⌘K` / `Ctrl+K`) across titles and content, accent-insensitive.
- **Version history** per page, with one-click restore.
- **Templates**: four built-in, and you can save any page as a template.
- **Import** from a Notion export (Markdown & CSV `.zip`: pages, images and databases) or from plain `.md` files.
- **Safety**: autosave, trash with restore, daily automatic backups (30 kept, folder configurable, for example a cloud-synced folder), full JSON export/import, Markdown/PDF export.
- Light and dark themes.

## Download

Grab the installer for your OS from **[Releases](../../releases/latest)**:

| OS | File |
|---|---|
| macOS (Apple Silicon / Intel) | `Frnt-Notes-x.y.z-mac-arm64.dmg` / `-mac-x64.dmg` |
| Windows | `Frnt-Notes-x.y.z-win-x64.exe` |
| Linux | `.AppImage` or `.deb` |

> The builds are **not code-signed** yet, because signing certificates cost money.
> - **macOS:** after dragging the app to Applications, right-click it, choose **Open**, then confirm (first launch only). If macOS says the app "is damaged", run `xattr -cr "/Applications/Frnt Notes.app"`.
> - **Windows:** on the SmartScreen warning, choose **More info**, then **Run anyway**.

## Run from source

Requirements: **Node.js ≥ 22.13** (Node 24 recommended). No native modules: SQLite comes built into Node.

```bash
git clone https://github.com/thanhmam/frnt-notes.git
cd frnt-notes
npm install

npm run dev        # development with hot reload → http://localhost:3001
npm start          # production build in the browser → http://localhost:3001
npm run desktop    # run as a desktop app (Electron)
npm run dist       # build an installer for your current OS → ./release
```

> ⚠️ Don't keep the project folder inside iCloud Drive, OneDrive or Dropbox: they corrupt `node_modules`.

### Where is my data?

| OS | Folder |
|---|---|
| macOS | `~/Library/Application Support/FrntNotes/` |
| Windows | `%APPDATA%\FrntNotes\` |
| Linux | `~/.local/share/frnt-notes/` |

It contains `notes.db` (SQLite), `uploads/` (images and files) and `backups/`. The browser and desktop versions share the same data.
Override it with `DATA_DIR=/path`, and the port with `PORT=4000`.

> The server listens on `127.0.0.1` only and has **no authentication**. Don't expose it to a network (`HOST=0.0.0.0`) unless it sits behind your own authenticating reverse proxy or VPN.

## Architecture

```
server/app.js        Express + node:sqlite: pages, databases, versions, search, uploads, backups
server/index.js      CLI entry (npm run dev / npm start)
electron/main.mjs    Desktop shell: runs the server in-process and opens a window
src/                 React frontend (Vite)
  Editor.jsx         BlockNote editor + custom "page" and "database" blocks
  db/                Database views (table, board, filters, sorts, cells)
  importer.js        Notion / Markdown import
```

A page is one row in the `pages` table. Content is stored as BlockNote JSON. Databases are pages with `kind = 'database'`: their schema is JSON, and their rows are child pages with `props`.

## Roadmap

- [ ] English UI / i18n
- [ ] Calendar & gallery database views; relation and formula properties
- [ ] Side-peek for database rows
- [ ] Optional encrypted sync between devices
- [ ] Self-hosting (Docker image + login)
- [ ] Mobile-friendly layout and PWA
- [ ] Code-signed installers

See [CONTRIBUTING.md](CONTRIBUTING.md) to help out.

## License

[MIT](LICENSE). The editor is built on [BlockNote](https://github.com/TypeCellOS/BlockNote) (MPL-2.0).
"Notion" is a trademark of Notion Labs, Inc. This project is not affiliated with or endorsed by Notion.
