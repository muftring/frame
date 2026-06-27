# Frame

A photo workflow studio built with Electron, Vue 3, and Vite. Frame manages the full lifecycle of a photo shoot as a **session** — import and group photos, sort keepers, edit and process, upload to cloud storage, and track completion through an end-to-end pipeline.

## Sessions

Sessions are the central organizing concept. Create a session when you start importing a shoot; it tracks your progress through every stage of the workflow. A persistent pipeline bar shows which stages are complete and lets you jump between them at any time.

When all pipeline stages are marked complete, Frame displays a **session complete** screen with a summary of what you did: photos imported and kept, keep rate, events grouped, destinations published to, and a time span of the shoot. Completed sessions are archived from the Home screen.

## Modules

**Home** — Create and manage sessions. Shows active sessions with pipeline progress bars and quick Resume actions. Completed sessions appear in a distinct section with keep rate and publish destination. Start a new import by naming a session and optionally linking a source folder.

**Triage** — Group incoming photos by time gaps and copy them into organized event folders. Scans EXIF timestamps, adjusts grouping threshold with a slider, and previews each group with thumbnails before copying. In session mode, groups and files are registered in the database after copying so the full pipeline can track them.

**Sorter** — Flip through images one at a time to keep or delete. Filmstrip navigation, full-resolution viewer, keyboard-driven workflow (K to keep, D to delete, arrow keys to navigate).

In **standalone mode** (no active session), deleting a file physically moves it to a `.frame-trash` sibling folder immediately. Files can be restored individually or the trash can be permanently emptied.

In **session mode**, delete is a database-only soft delete — the file stays on disk in its event folder, only its status in SQLite changes. This means:
- **Un-deleting is instant**: navigate back to a deleted file and press K, or use the Deleted panel's Restore button. No file moves needed.
- The "Recently Deleted" smart album shows all soft-deleted files across sessions.
- A **"Clean up (N)"** button appears in the toolbar when deleted files haven't yet been moved to `.frame-trash`. Clicking shows a confirmation with the file count and approximate disk space to reclaim, then moves files to a per-group `.frame-trash` folder.
- The session complete screen also offers a one-click cleanup card if deleted files remain on disk after the pipeline finishes.

A **"Mark Sort Complete"** button appears once every file has been reviewed (none remain unreviewed), advancing the session pipeline. In session mode, a "Resume from where you left off" prompt appears on re-entry if the pipeline has a saved position.

**Gallery** — Browse images from multiple sources via a left sidebar:

- **Smart Albums** — dynamic albums defined by rule sets (status, rating, date range, filename, size, published destination, tags). A rule builder modal lets you create and edit albums with live preview counts. Five default albums ship with every install.
- **This Session** — auto-generated views for All, Kept, Deleted, and Unreviewed files in the active session, plus individual event groups.
- **Open Folder** — classic folder browse mode.

The thumbnail grid uses IntersectionObserver for lazy loading. Click any thumbnail for a full-screen viewer; a slide-in metadata panel shows EXIF data, star ratings, and tags. Right-click for a context menu to open in Darktable, RawTherapee, or reveal in Finder.

**Editor** — Canvas-based image editor with rotate (90/180/flip) and crop tools. Draggable crop rectangle with corner handles, rule-of-thirds overlay, and aspect ratio presets (Free, 4:3, 3:2, 1:1, 16:9). Undo history keeps the last 5 states. Save overwrites the original or saves a copy. In session mode, each save appends an operation log to the file's edit history in the database.

**Process** — Launch files and folders in Darktable or RawTherapee. Run RawTherapee CLI batch exports with live log streaming. In session mode, a "Session Kept Files" button loads all kept files as the export source, and a successful export marks the Process stage complete.

**Publish** — Publish photos to cloud storage via a provider-based system. Two providers included:
- **ArchiVault** — Upload to AWS S3 with integrity tracking via the `archivault` CLI. Supports tagging and uploaded-by metadata.
- **iCloud Photos** — Import into Photos.app via osascript (macOS only). Files sync to iCloud automatically. Supports an optional **album name** — the album is created if it doesn't exist, and all files are imported into it. If the files have Frame tags, those tags are set as Photos **keywords** on each imported item via AppleScript.

In session mode, a "Session Kept Files" button loads kept files as the publish source. After a successful publish, each file's destinations are recorded in the database. When all kept files have at least one destination, the Publish stage is marked complete and the session complete screen is shown.

## Tags

Tags are free-form keywords attached to individual files and stored in the database. Add or remove tags from the metadata panel in Gallery (type a tag and press Enter or comma; click × to remove). Tags are lowercase and deduplicated.

Tags integrate with the rest of Frame:
- **Smart Albums** — use the `has tag` rule to build dynamic albums like "all files tagged lacrosse"
- **iCloud Publish** — tags are automatically set as Photos keywords on import when publishing to iCloud Photos

## Themes

Three appearance modes selectable in Settings:
- **Dark** — default dark interface
- **Gray** — neutral mid-gray surround (Darktable-inspired) for color-accurate photo work
- **Light** — light interface

## Tech Stack

- **Electron 35** — desktop shell with context-isolated IPC
- **Vue 3** (Options API) — UI framework
- **Vite** — dev server and renderer bundler
- **better-sqlite3** — embedded SQLite database (synchronous, WAL mode)
- **Sharp** — thumbnail generation, rotate, crop, flip
- **electron-store** — settings and window state persistence

## Project Structure

```
frame/
├── electron/
│   ├── main.js              # Electron main process, all IPC handlers
│   ├── preload.js           # Context bridge (invoke + on)
│   └── services/
│       ├── fileSystem.js     # Scan, EXIF, copy, trash, mkdir
│       ├── imageProcessor.js # Thumbnails, rotate, crop, flip
│       ├── sessionStore.js   # SQLite sessions, groups, files, albums, pipeline
│       ├── toolLauncher.js   # Darktable/RawTherapee detection & launch
│       └── uploadService.js  # Provider-based upload (ArchiVault, iCloud)
├── src/
│   ├── main.js               # Vue app entry
│   ├── App.vue               # Nav, session pipeline bar, theme, toasts, providers
│   └── modules/
│       ├── Home/
│       │   ├── HomeModule.vue      # Session list, new session form
│       │   └── SessionComplete.vue # Completion overlay with stats and gallery strip
│       ├── Triage/            # TriageModule.vue
│       ├── Sorter/            # SorterModule.vue
│       ├── Gallery/
│       │   ├── GalleryModule.vue   # Main grid, toolbar, source routing
│       │   ├── SmartAlbumsPanel.vue # Left sidebar: albums + session sources
│       │   ├── SmartAlbumEditor.vue # Album rule builder modal
│       │   ├── ImageViewer.vue     # Full-screen overlay viewer
│       │   └── MetadataPanel.vue   # Slide-in EXIF panel
│       ├── Editor/            # EditorModule.vue
│       ├── Process/           # ProcessModule.vue
│       ├── Publish/           # PublishModule.vue
│       └── Settings/          # SettingsPanel.vue
├── index.html
├── vite.config.js
└── package.json
```

## Getting Started

```bash
npm install
npm run dev
```

This starts the Vite dev server and launches Electron. The app opens a 1280x820 window with a collapsible sidebar for module navigation. The SQLite database is created automatically at `~/.frame/frame.db` on first launch.

## Building

```bash
npm run build
```

Produces macOS DMG and ZIP for both arm64 and x64 in `dist/electron/`.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd+0 | Home |
| Cmd+1–6 | Switch between modules (Triage → Publish) |
| Cmd+, | Toggle Settings panel |
| K | Keep image (Sorter) |
| D | Delete image (Sorter) |
| Left/Right | Navigate images (Sorter) |
| Escape | Close viewer / panel |

## Data Locations

| Path | Purpose |
|------|---------|
| `~/.frame/frame.db` | SQLite database — sessions, files, smart albums, pipeline state |
| `~/.frame/thumbcache/` | Cached thumbnails (clearable in Settings) |
| `~/.frame/temp/` | Editor undo history and working copies |
| `~/.archivault/config.json` | ArchiVault configuration (if installed) |
| `~/Library/Application Support/frame/` | electron-store settings and window bounds |

## External Tools

Frame integrates with [Darktable](https://www.darktable.org) and [RawTherapee](https://www.rawtherapee.com) for post-processing. Both are auto-detected from standard install paths. Custom paths can be set in Settings.

The Upload module integrates with [ArchiVault](https://github.com/muftring/archivault) for S3-based photo archiving. ArchiVault must be installed and configured separately (`archivault config --bucket <name> --region <region>`).
