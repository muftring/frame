# Frame

A photo workflow studio built with Electron, Vue 3, and Vite. Frame helps manage the full lifecycle of photo shoots — from importing and triaging raw captures, to sorting keepers, browsing galleries, light editing, and batch processing through external tools.

## Modules

**Triage** — Group incoming photos by time gaps and copy them into organized event folders. Scans EXIF timestamps, lets you adjust the grouping threshold with a slider, and previews each group with thumbnails before copying.

**Sorter** — Flip through images one at a time to keep or delete. Filmstrip navigation, full-resolution viewer, keyboard-driven workflow (K to keep, D to delete, arrow keys to navigate). Trashed files go to a `.frame-trash` folder with restore and empty-trash support.

**Gallery** — Browse a folder as a responsive thumbnail grid with lazy loading via IntersectionObserver. Click any thumbnail to open a full-screen viewer with EXIF metadata. Right-click for context menu to open in Darktable, RawTherapee, or reveal in Finder.

**Editor** — Canvas-based image editor with rotate (90/180/flip) and crop tools. Draggable crop rectangle with corner handles, rule-of-thirds overlay, and aspect ratio presets (Free, 4:3, 3:2, 1:1, 16:9). Undo history keeps the last 5 states. Save overwrites original or save a copy.

**Process** — Launch files and folders in Darktable or RawTherapee. Run RawTherapee CLI batch exports with live log streaming. Auto-detects installed tools with manual path override in Settings.

## Tech Stack

- **Electron 35** — desktop shell with context-isolated IPC
- **Vue 3** (Options API) — UI framework
- **Vite** — dev server and renderer bundler
- **Sharp** — thumbnail generation, rotate, crop, flip
- **electron-store** — settings and window state persistence

## Project Structure

```
frame/
├── electron/
│   ├── main.js              # Electron main process, IPC handlers
│   ├── preload.js            # Context bridge (invoke + on)
│   └── services/
│       ├── fileSystem.js     # Scan, EXIF, copy, trash, mkdir
│       ├── imageProcessor.js # Thumbnails, rotate, crop, flip
│       └── toolLauncher.js   # Darktable/RawTherapee detection & launch
├── src/
│   ├── main.js               # Vue app entry
│   ├── App.vue               # Sidebar nav, toast system, settings provider
│   └── modules/
│       ├── Triage/            # TriageModule.vue
│       ├── Sorter/            # SorterModule.vue
│       ├── Gallery/           # GalleryModule.vue, ImageViewer.vue
│       ├── Editor/            # EditorModule.vue
│       ├── Process/           # ProcessModule.vue
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

This starts the Vite dev server and launches Electron. The app opens a 1280x820 window with a collapsible sidebar for module navigation.

## Building

```bash
npm run build
```

Produces macOS DMG and ZIP for both arm64 and x64 in `dist/electron/`.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd+1–5 | Switch between modules |
| Cmd+, | Toggle Settings panel |
| K | Keep image (Sorter) |
| D | Delete image (Sorter) |
| Left/Right | Navigate images (Sorter, Gallery, Editor) |
| Escape | Close viewer/panel |

## Data Locations

| Path | Purpose |
|------|---------|
| `~/.frame/thumbcache/` | Cached thumbnails (clearable in Settings) |
| `~/.frame/temp/` | Editor undo history and working copies |
| `~/Library/Application Support/frame/` | electron-store settings |

## External Tools

Frame integrates with [Darktable](https://www.darktable.org) and [RawTherapee](https://www.rawtherapee.com) for post-processing. Both are auto-detected from standard install paths. Custom paths can be set in Settings.
