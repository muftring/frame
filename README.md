<div align="center">

<img src="src/assets/logo/frame-mark-contained.svg" width="96" height="96" alt="Frame logo" />

# Frame

**Photo workflow, start to finish.**

A macOS desktop app for photographers who shoot too much and want a fast,
focused workflow — import, cull, edit, publish — without the overhead of
a full photo management suite.

[![Version](https://img.shields.io/github/v/release/muftring/frame?style=flat-square&color=c9a84c)](https://github.com/muftring/frame/releases)
[![Platform](https://img.shields.io/badge/platform-macOS-lightgrey?style=flat-square)](https://github.com/muftring/frame/releases)
[![License](https://img.shields.io/github/license/muftring/frame?style=flat-square)](LICENSE)
[![Built with Claude](https://img.shields.io/badge/built%20with-Claude-6B48FF?style=flat-square)](https://claude.ai)

</div>

---

## What Frame does

Frame organizes your photo workflow into five connected stages:

```
Triage  →  Sort  →  Edit  →  Process  →  Publish
```

Every shoot becomes a named **session**. Frame tracks your progress through
each stage so you can stop after sorting, come back the next day, and pick up
exactly where you left off. A persistent pipeline bar shows what's done and
lets you jump between stages at any time.

---

## The pipeline

### 🗂 Triage
Import from an SD card, camera folder, or any directory. Frame groups photos
by time gap — one group per game, one per hike, one per event — so you're
working with meaningful sets rather than a flat list of hundreds of files.
Adjust the gap threshold with a slider and preview each group with thumbnails
before copying.

### ✅ Sort
A fast, keyboard-driven sorter: **K** to keep, **D** to delete, **← →** to
navigate. Deleted photos stay on disk until you explicitly clean them up —
no accidental permanent deletion. Detected bursts open in a synchronized-zoom
compare view to find the peak moment across every frame. Detected panoramas
are flagged for stitching.

### ✂️ Edit
Crop with draggable handles and aspect ratio lock (Free, 4:3, 3:2, 1:1,
16:9). Rotate and flip. Full EXIF metadata panel. B&W candidate tagging with
live grayscale preview. Undo history.

### ⚙️ Process
Hand off to the tools that do the heavy computation:
- **Darktable / RawTherapee** — RAW development and batch export
- **Hugin** — panorama stitching (interactive or CLI quick-stitch)
- **ffmpeg** — burst composites (motion trail, background-stabilized, sequence strip)

Frame launches the right tool with the right files. You do the work there;
Frame tracks what's done.

### 🚀 Publish
Send your keepers where they need to go — iCloud Photos or
[ArchiVault](https://github.com/muftring/archivault). Tags set in Frame are
written as Photos keywords on iCloud import. A session complete screen
celebrates what you did: photos kept, keep rate, destinations published to,
and a strip of your best photos.

---

## Features

| Feature | Description |
|---|---|
| **Sessions** | Every import is a named session. Resume exactly where you left off. |
| **Sequence detection** | Single-pass algorithm distinguishes panoramas from bursts — including sports bursts at 3fps that look like panoramas |
| **Burst compare** | Synchronized zoom across all frames — find the peak moment side by side |
| **Smart Albums** | Rule-based albums that update automatically: All Keepers, This Week, B&W Candidates, and more |
| **Curator notes** | Markdown notes at session level, group level, and a continuous global journal |
| **Obsidian export** | Export session notes and journal to an Obsidian vault as linked Markdown files with YAML frontmatter |
| **Export / Import** | Move your entire Frame library between Macs with automatic path remapping |
| **Auto-backup** | Database backed up silently on every launch. 7-day rolling retention. |
| **Library stats** | Running totals across all sessions: photos, keepers, panoramas, composites |
| **Themes** | Dark (default), Gray (Darktable-inspired neutral), Light |

---

## Screenshots

*Screenshots coming soon.*

---

## Requirements

- macOS 12 (Monterey) or later · Apple Silicon or Intel
- [Darktable](https://www.darktable.org/) or [RawTherapee](https://www.rawtherapee.com/) for RAW editing *(optional)*
- [Hugin](https://hugin.sourceforge.io/) for panorama stitching *(optional)*
- [ffmpeg](https://ffmpeg.org/) for burst composites *(optional — `brew install ffmpeg`)*
- [ArchiVault](https://github.com/muftring/archivault) for S3 publishing *(optional)*

---

## Installation

1. Download `Frame-x.x.x.dmg` from [Releases](https://github.com/muftring/frame/releases)
2. Open the DMG and drag **Frame.app** to your Applications folder
3. On first launch, macOS may show a security warning — see below

> **macOS security note:** Frame is not yet notarized with Apple's notarization
> service. If you see *"Frame is damaged and can't be opened"*, run this once
> in Terminal:
> ```bash
> xattr -cr /Applications/Frame.app
> ```
> Then launch normally. Code signing and notarization are planned for v3.0.

---

## Keyboard shortcuts

### Global

| Key | Action |
|---|---|
| ⌘1 | Home |
| ⌘2 | Triage |
| ⌘3 | Sort |
| ⌘4 | Edit |
| ⌘5 | Gallery |
| ⌘6 | Process |
| ⌘7 | Journal |
| ⌘8 | Publish |
| ⌘, | Settings |

### In the Sorter

| Key | Action |
|---|---|
| K | Keep and advance |
| D | Delete and advance |
| B | Toggle B&W candidate tag |
| N | Toggle panorama candidate tag |
| U | Toggle burst candidate tag |
| P | B&W preview (live grayscale) |
| C | Open burst compare view |
| ← → | Navigate photos |

### In Burst Compare View

| Key | Action |
|---|---|
| ← → | Navigate frames |
| K / Enter | Mark as keeper |
| Shift+Enter | Keep best, delete rest |
| 1–9 | Jump to frame N |
| +/- | Zoom all thumbnails |
| 0 | Reset zoom |
| Escape | Close |

---

## The soft-delete model

Frame never permanently deletes photos during a sort. Pressing **D** in the
Sorter only updates the database — the file stays on disk untouched.

**Un-deleting is instant:** navigate back to a deleted photo and press K.
No file moves, no confirmation dialog.

**Cleaning up** happens at two explicit moments:
1. A **"Clean up (N)"** button appears in the Sorter toolbar showing how many
   deleted files remain on disk and how much space they use. Click to move them
   to a `.frame-trash` folder.
2. The **Session Complete screen** offers the same cleanup with a disk space
   summary.

Permanent deletion requires a separate "Empty Trash" confirmation. Frame
always tells you the disk space impact before you commit.

---

## Data locations

| Path | Purpose |
|---|---|
| `~/.frame/frame.db` | SQLite database — sessions, files, albums, pipeline state |
| `~/.frame/thumbcache/` | Thumbnail cache (clearable in Settings) |
| `~/.frame/backups/` | Auto-backups (7-day rolling retention) |
| `~/.frame/journal.md` | Global photographer's journal (plain Markdown file) |
| `~/.frame/temp/` | Editor undo history |
| `~/Library/Application Support/frame/` | electron-store settings and window bounds |

---

## Tech stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron |
| UI framework | Vue 3 (Options API) |
| Bundler | Vite |
| Database | better-sqlite3 (SQLite, WAL mode) |
| Image processing | sharp |
| Markdown | marked |
| Settings | electron-store |
| Distribution | electron-builder |

---

## Project structure

```
frame/
├── electron/
│   ├── main.js               Main process, all IPC handlers
│   ├── preload.js            Context bridge
│   ├── splash.html           Splash screen (standalone HTML)
│   └── services/
│       ├── backupService.js  Shared backup utility
│       ├── fileSystem.js     Scan, EXIF, copy, trash
│       ├── imageProcessor.js Thumbnails, rotate, crop
│       ├── sessionStore.js   SQLite sessions, files, albums, pipeline
│       ├── toolLauncher.js   Darktable/RawTherapee detection & launch
│       └── uploadService.js  ArchiVault + iCloud Photos
├── src/
│   ├── assets/
│   │   ├── icons/            Pipeline stage SVG icons
│   │   └── logo/             Logomark, wordmark, contained variants
│   ├── components/
│   │   ├── MarkdownEditor.vue  Shared Markdown editor (view/edit/auto-save)
│   │   ├── NavIcon.vue         Sidebar navigation icon with CSS filter theming
│   │   ├── SessionCard.vue     Home screen session card
│   │   └── EmptyState.vue      Empty state component
│   ├── modules/
│   │   ├── Home/             Session list, pipeline bar, library stats
│   │   ├── Triage/           Import and time-gap grouping
│   │   ├── Sorter/           Keep/delete workflow + burst compare
│   │   ├── Editor/           Crop, rotate, flip
│   │   ├── Gallery/          Grid, smart albums, image viewer, metadata
│   │   ├── Process/          External tool handoff (Darktable, Hugin, ffmpeg)
│   │   ├── Journal/          Global Markdown journal
│   │   ├── Publish/          ArchiVault + iCloud Photos
│   │   └── Settings/         Tool paths, export/import, backup, Obsidian
│   └── styles/
│       └── tokens.css        CSS custom properties (colors, spacing, typography)
├── scripts/
│   └── generate-icons.js     Build-time icon generation (opentype.js + sharp)
└── docs/
    └── FRAME_DESIGN_NOTES.md Architecture decisions, prompt inventory, roadmap
```

---

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Generate app icons
npm run icons

# Build for distribution
npm run build
```

> **Note on icon generation:** `scripts/generate-icons.js` uses opentype.js to
> outline the Times New Roman Italic *F* glyph before rasterizing with sharp.
> The glyph origin is set to `F_X = 24` — intentionally calibrated for this
> font and canvas size. opentype.js places the glyph's **left edge** at x,
> unlike SVG's `text-anchor="middle"` which centers at x. Do not change
> `F_X` to match the SVG's `x="50"`.

---

## Roadmap

**v2.2**
- [ ] Film strip clip fix — top strip bleeds past rounded icon corner ([#17](https://github.com/muftring/frame/issues/17))
- [ ] Auto-update check at launch — notify when a newer version is available

**v2.x**
- [ ] Print lab integration (Mpix, Shutterfly, and others)

**v3.0**
- [ ] Code signing and notarization (Apple Developer account)
- [ ] iCloud Photos as a source — curate your existing library in chunks
- [ ] Relative paths — eliminate Mac migration path remapping
- [ ] Theme system — Dark Gold (current) · Light Editorial · Bold Violet
- [ ] Session snapshots — named rollback positions
- [ ] In-app help

See [FRAME_DESIGN_NOTES.md](docs/FRAME_DESIGN_NOTES.md) for the full design
history, architectural decisions, and feature roadmap.

---

## Origin: browser prototypes

Before Frame was an Electron app, it was two HTML files.

[`prototypes/PhotoTriage.html`](prototypes/PhotoTriage.html) and
[`prototypes/PhotoSorter.html`](prototypes/PhotoSorter.html) were built first
in the browser — no build tools, no dependencies, just a canvas for thinking
through the workflow. The browser sandbox made UI iteration instant; those
prototypes clarified what the pipeline needed to be before any Electron
complexity was introduced.

They still open in a browser today. They're the seed from which Frame grew.

---

## Built with Claude

Frame was designed and built in close collaboration with
[Claude](https://claude.ai) (Anthropic) — and it shows in how the project
is structured.

**Claude.ai** (this interface) handled the design work: defining the problem,
exploring architecture options, making tradeoffs, iterating on the branding,
and producing detailed specifications for every feature. The logo, the
pipeline model, the soft-delete behavior, the sequence detection algorithm,
the Obsidian export format — all of these emerged from extended design
conversations in Claude.ai across many sessions.

**Claude Code** did the building: translating those specifications into
working Electron/Vue code, phase by phase, prompt by prompt. Each feature
was a structured prompt — precise enough that Claude Code could implement
it correctly, with a verification checklist to confirm it before moving on.

The [`docs/FRAME_DESIGN_NOTES.md`](docs/FRAME_DESIGN_NOTES.md) file in this
repo is the living record of those design conversations — every architectural
decision, every prompt, every tradeoff, with rationale. It travels with the
code so future Claude Code sessions have full context on what exists and why.

A longer write-up on this process — *Frame: A Photo Workflow Studio, Built
with Claude* — is in progress.

> *"The quality of the outcome was determined by the quality of the problem
> definition, not by the AI's capabilities."*

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">
<sub>Keep the best. Retire the rest.</sub>
</div>
