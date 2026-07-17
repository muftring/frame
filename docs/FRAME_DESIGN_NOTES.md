# Frame — Design Notes & Session Index

> **Photo Workflow Studio** · Electron + Vue 3 + SQLite  
> Built with Claude · Design conversations in Claude.ai · Build in Claude Code  
> Last updated: July 2026

This document is the persistent index of all design decisions, prompts, and architectural choices made across the Claude.ai design conversation. Keep it updated as new phases are built. Bring it into Claude Code sessions as context when needed.

---

## Table of Contents

1. [Technology Stack](#technology-stack)
2. [Key Architectural Decisions](#key-architectural-decisions)
3. [Phase Map & Prompt Inventory](#phase-map--prompt-inventory)
4. [Feature Reference](#feature-reference)
5. [External Tool Integrations](#external-tool-integrations)
6. [Design System & Branding](#design-system--branding)
7. [Planned but Not Yet Built](#planned-but-not-yet-built)
8. [Delete Behavior — Option A](#delete-behavior--option-a)
9. [Tag System Reference](#tag-system-reference)
10. [Sequence Detection Algorithm](#sequence-detection-algorithm)
11. [Blog / Paper Outline](#blog--paper-outline)

---

## Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| App shell | Electron | Main + renderer process, IPC bridge |
| UI framework | Vue 3 (Options API) | Options API by preference — developer knows it, wants readable code |
| Bundler | Vite + @vitejs/plugin-vue | Dev server → Electron renderer |
| Database | better-sqlite3 (SQLite) | Synchronous API, `~/.frame/frame.db` |
| Image processing | sharp | Thumbnails, crop, rotate, composite |
| Settings persistence | electron-store | Tool paths, detection defaults, window state |
| Build/distribution | electron-builder | macOS DMG+ZIP (arm64+x64 universal), Windows |
| App ID | `com.michael.frame` | |
| Product name | Frame | |

### IPC Pattern
```js
// Renderer
const result = await window.api.invoke('channel:name', args)

// Main process
ipcMain.handle('channel:name', async (event, args) => { ... })
```

### File Locations
```
~/.frame/frame.db          SQLite database
~/.frame/thumbcache/       Disk-backed thumbnail cache
~/.frame/temp/             Editor undo history (ephemeral)
~/Library/Application Support/frame/  electron-store config
```

---

## Key Architectural Decisions

### Session Model
Every import creates a named **Session**. A session tracks:
- Source path (SD card)
- All event groups and their files
- Pipeline stage completion state
- Per-file keep/delete/published status
- Resume position in Sorter

**Why:** Without sessions, every launch starts from scratch. Sessions enable resume, history, and the library stats view.

### Pipeline
Five linear stages with a persistent status bar:
```
Triage → Sort → Edit → Process → Publish
```
Each stage is green (complete), gold (active), or gray (pending). Clicking a completed stage navigates there.

### Delete Behavior — Option A (Database-only soft delete)
Marking a file "deleted" in the Sorter **only updates SQLite**. The file stays on disk untouched. Filesystem cleanup is a separate, explicit action with a disk-space warning. See [Delete Behavior](#delete-behavior--option-a) section for full spec.

### Vue Options API
Chosen because the developer knows Options API and wants to read the code Claude Code produces. All components use Options API — never Composition API.

### External Tool Philosophy
Frame is an **orchestrator**, not a replacement for professional tools. Darktable, RawTherapee, Hugin, and ffmpeg do the heavy computation. Frame handles selection, grouping, handoff, and result tracking.

### Publish (formerly Upload)
The Upload module was renamed to **Publish** in v1.0 during Claude Code work. All references should use "Publish" and `publish_complete`.

---

## Phase Map & Prompt Inventory

### Status Key
- ✅ Built and shipped
- 🔨 In progress
- 📝 Prompts written, not yet built
- 💭 Designed, prompts not yet written

---

### Phase 1 — Project Skeleton ✅
| Prompt | Description |
|---|---|
| 1A | Scaffold Electron + Vue 3 + Vite, IPC bridge, dark window |
| 1B | Sidebar navigation, 5 module placeholders, CSS color palette |

---

### Phase 2 — IPC Services Layer ✅
| Prompt | Description |
|---|---|
| 2A | `fs:` channels — scanFolder, readExif, copyFile, moveToTrash, restoreFromTrash, emptyTrash, createDirectory |
| 2B | `img:` channels — thumbnail (with disk cache), rotate, crop, getMetadata. Sharp integration. |
| 2C | `tools:` channels — findInstalled (Darktable, RawTherapee), openFile, openFolder, runBatchExport, revealInFinder |

---

### Phase 3 — Feature Modules ✅
| Prompt | Description |
|---|---|
| 3A | TriageModule.vue — folder picker, gap slider, scan, group cards with thumbnails, copy with progress |
| 3B | SorterModule.vue — filmstrip, viewer, Keep/Delete actions, trash panel, keyboard shortcuts |
| 3C | GalleryModule.vue + ImageViewer.vue — thumbnail grid, IntersectionObserver lazy load, full-screen viewer |
| 3D | EditorModule.vue — canvas crop (draggable handles, aspect lock), rotate, undo history |
| 3E | ProcessModule.vue — tool status, file/folder launcher, RawTherapee batch export with live log |

---

### Phase 4 — Polish and Settings ✅
| Prompt | Description |
|---|---|
| 4A | SettingsPanel.vue — tool paths, thumbnail cache, defaults, about section |
| 4B | Window chrome (hiddenInset), drag region, loading states, toast system, keyboard shortcuts ⌘1-5, empty states, window state persistence, production build |

---

### Phase 5 — Upload / Publish ✅
Built during v1.0 development. Integrates with:
- **ArchiVault** (another app built with Claude)
- **iCloud Photos** via AppleScript

*Note: Module was named "Upload" during build, renamed to "Publish" post-v1.0.*

---

### Phase 6 — Session Model & Persistence ✅
| Prompt | Description |
|---|---|
| 6A | SQLite schema: `sessions`, `event_groups`, `files`, `pipeline_state`, `sequence_detection_runs`. All session/group/file IPC channels. |
| 6B | HomeModule.vue v1 — session list, resume button, pipeline progress, new session flow |

---

### Phase 7 — Metadata Panel ✅
| Prompt | Description |
|---|---|
| 7A | `img:getFullMetadata` — full EXIF parsing, human-readable values (f/2.8, 1/1000s, Matrix metering, etc.) |
| 7B | MetadataPanel.vue — slide-in panel, File/Capture/Frame Status/Histogram sections, tag display |

---

### Phase 8 — Smart Albums ✅
| Prompt | Description |
|---|---|
| 8A | `smart_albums` table, rule engine (eq/neq/gt/lt/contains/in_last_days operators), album IPC channels, seeded default albums |
| 8B | SmartAlbumsPanel.vue in Gallery sidebar, SmartAlbumEditor modal with rule builder and live preview |

**Default seeded albums:**
- All Keepers (`status = kept`)
- Unpublished (`status = kept AND published_to = '[]'`)
- 5 Stars (`rating >= 5`)
- This Week (`exif_ts in last 7 days`)
- Recently Deleted (`status = deleted`)
- B&W Candidates (`tags contains "bw-candidate"`)
- Panorama Candidates (`tags contains "pano-candidate"`)
- Burst Candidates (`tags contains "burst-candidate"`)

---

### Phase 9 — Pipeline Integration ✅
| Prompt | Description |
|---|---|
| 9A (revised) | Wire all modules to activeSession. **Option A delete behavior** explicitly specified. `trashed_at` migration. Clean-up actions at session and sort-complete. |
| 9B | SessionComplete.vue — celebration screen, stats summary, keeper gallery strip, archive action |

**Critical: 9A was revised** after initial prompt to specify Option A delete behavior explicitly. The revision is the authoritative version — the original prompt should not be used.

---

### Phase 10 — B&W Candidate Tagging ✅
| Prompt | Description |
|---|---|
| 10A | `tags` column + `tag_definitions` table. Tag IPC channels: listDefinitions, addToFile, removeFromFile, toggleOnFile, listByTag, listByFile. Seeds bw-candidate tag (shortcut: B). |
| 10B | Sorter integration — B key shortcut, filmstrip badge, B&W preview toggle (P key, CSS grayscale), "B&W Preview" overlay indicator |
| 10C | Smart album for B&W. Gallery grid badge. MetadataPanel tag row with dropdown. Session-scoped album. |
| 10D | Process module B&W section — candidate count, Darktable .dtstyle preset picker, launch button, D80-specific tip |

---

### Phase 11 — Unified Sequence Detection Schema 📝
| Prompt | Description |
|---|---|
| 11A | `pano_sets` + `burst_sets` tables. File columns: pano_set_id, burst_set_id, pano_frame_order, burst_frame_order, tags, trashed_at. Seeds pano-candidate (N) and burst-candidate (U) tags. All pano:/burst:/tag: IPC channels. |
| 11B | `sequence:detectGroups(sessionId, options)` — single-pass detection returning `{ panoramas, bursts, ambiguous, summary }`. Fast-reject criteria, confidence scoring, histogram comparison option. Logs to sequence_detection_runs. |

**Detection options (all configurable):**
```js
{
  maxGapSeconds: 45,
  minFrames: 3,
  requireConsecutiveNames: true,
  panoMaxShutterSpeed: 500,    // reject if shutter > 1/500
  panoMaxFrames: 20,
  panoMinGapSeconds: 1.5,      // panoramas need > 1.5s between frames
  panoFocalTolerance: 5,       // mm
  burstMaxGapSeconds: 2.0,
  burstMinShutterSpeed: 250,
  burstMaxFrames: 60,
  burstMinFrames: 3,
  highConfidenceThreshold: 80,
  mediumConfidenceThreshold: 50,
  useHistogramComparison: false,
  histogramSimilarityMin: 0.70
}
```

---

### Phase 12 — Panorama UI 📝
| Prompt | Description |
|---|---|
| 12A | Sorter pano integration — PANO badge, blue set border, pano info bar above action bar with "View set →" link |
| 12B | Gallery panorama panel — PanoSetView.vue, detection modal with all knobs, DetectionResults modal with PANORAMAS and AMBIGUOUS tabs |
| 12C | Process module Hugin handoff — interactive open or CLI quick stitch (nona + enblend + autooptimiser), step progress UI, .pto generation |

**Hugin paths to check:**
```
macOS: /Applications/Hugin/Hugin.app/Contents/MacOS/Hugin
       /Applications/Hugin.app/Contents/MacOS/Hugin
       /usr/local/bin/hugin, /opt/homebrew/bin/hugin
Win:   C:\Program Files\Hugin\bin\hugin.exe
CLI:   nona, enblend, autooptimiser (same dir as hugin or PATH)
```

---

### Phase 13 — Burst UI 📝
| Prompt | Description |
|---|---|
| 13A | Sorter burst integration — BRST badge (orange), burst set border, burst info bar, BurstCompareView.vue with synchronized zoom grid, "Keep best delete rest" action |
| 13B | Gallery burst panel — BurstSetView.vue, keeper display, detection results BURSTS tab |
| 13C | Process module burst composite — ffmpeg motion trail, Hugin background-stabilized, sequence strip modes. tools:createComposite IPC. |

**Composite modes:**
- **Motion trail** (lighten blend) — sharp + composite(), no alignment needed
- **Background-stabilized** — Hugin alignment + blend, ~1-2 min
- **Sequence strip** — side-by-side with configurable gap, optional labels

**ffmpeg paths:**
```
macOS: /usr/local/bin/ffmpeg, /opt/homebrew/bin/ffmpeg
Win:   C:\Program Files\ffmpeg\bin\ffmpeg.exe
```

---

### Phase 14 — Settings Integration 📝
| Prompt | Description |
|---|---|
| 14A | Settings panel additions: sequence detection defaults (all knobs), composite defaults, ffmpeg/Hugin paths, default output folders. electron-store key: "sequenceDetectionOptions" |

---

### Branding A — Logo, Icons, Splash ✅
| Item | Description |
|---|---|
| Logomark | J6: Times New Roman Regular Italic F, I3 treatment (dark gap + #ffd966 rim), 5 fading gold negative strips (tilts: -6°, +2°, -4°, +3°, -2°) |
| Icon generation | scripts/generate-icons.js — opentype.js outlines F glyph, sharp rasterizes, png-to-ico for Windows |
| Splash screen | electron/splash.html — standalone HTML, 420×280, progress bar, min 1400ms display |
| Pipeline icons | src/assets/icons/ — triage, sort, edit, gallery, process, publish, settings, home |
| NavIcon.vue | Reusable sidebar icon component, CSS filter for gold active state |
| CSS tokens | src/styles/tokens.css — full color/spacing/typography/z-index system |

**Logo colors:**
```
Strips:     #c9a84c at opacity 0.55 / 0.40 / 0.28 / 0.18 / 0.09 (fading)
F fill:     #c9a84c
F dark gap: #0d0d0d, stroke-width 5
F rim:      #ffd966, stroke-width 1.5
Background: #1a1a1a (contained mark), transparent (mark only)
```

---

### Branding B — Home Screen & UI Polish 🔨
| Prompt | Description |
|---|---|
| B1 | HomeModule.vue redesign — top bar (logo + wordmark + session pill + version), pipeline bar (5 clickable stages), session card grid (3-col), SessionCard.vue component, library stats row, empty state |
| B2 | App-wide polish — macOS traffic lights, module transitions, global toast system (provide/inject), ⌘1-7 + ⌘, shortcuts, EmptyState.vue component, micro-interactions, typography, window state persistence |

---

## Feature Reference

### Keyboard Shortcuts (post-Branding-B)
| Key | Action |
|---|---|
| ⌘1 | Home |
| ⌘2 | Triage |
| ⌘3 | Sort |
| ⌘4 | Edit |
| ⌘5 | Gallery |
| ⌘6 | Process |
| ⌘7 | Publish |
| ⌘, | Settings |

**In Sorter:**
| Key | Action |
|---|---|
| K | Keep (auto-advance) |
| D | Delete (auto-advance) |
| B | Toggle B&W candidate tag |
| N | Toggle panorama candidate tag |
| U | Toggle burst candidate tag |
| P | Toggle B&W preview (CSS grayscale) |
| C | Open burst compare view |
| ← → | Navigate photos |

**In Burst Compare View:**
| Key | Action |
|---|---|
| ← → | Navigate frames |
| K / Enter | Mark as keeper |
| D / Delete | Not this one |
| Shift+Enter | Keep best, delete rest |
| 1-9 | Jump to frame N |
| +/- | Zoom all thumbnails |
| 0 | Reset zoom |
| Escape | Close |

---

### Tag System
| Tag name | Label | Color | Shortcut | Smart album |
|---|---|---|---|---|
| `bw-candidate` | B&W Candidate | #888888 | B | B&W Candidates |
| `pano-candidate` | Panorama | #4a90d9 | N | Panorama Candidates |
| `burst-candidate` | Burst | #e8943a | U | Burst Candidates |

Tags stored as JSON array in `files.tags` column.

---

## External Tool Integrations

| Tool | Use | Launch method |
|---|---|---|
| Darktable | RAW editing, noise reduction, B&W conversion | `shell.openPath()` or `spawn()` |
| RawTherapee | RAW editing, batch export with .pp3 presets | `spawn()` for CLI batch |
| Hugin | Panorama stitching (interactive or CLI) | `spawn()` with .pto project |
| nona | Hugin CLI remap step | `spawn()` |
| enblend | Hugin CLI blend step | `spawn()` |
| autooptimiser | Hugin CLI alignment | `spawn()` |
| ffmpeg | Burst composite (lighten blend, sequence strip) | `spawn()` |
| ArchiVault | Publish destination (sister app) | IPC / custom integration |
| iCloud Photos | Publish destination | AppleScript via `osascript` |

---

## Design System & Branding

### Color Palette (tokens.css)
```css
--color-bg:           #1a1a1a
--color-surface:      #242424
--color-surface-2:    #2e2e2e
--color-surface-3:    #383838
--color-border:       rgba(255,255,255,0.09)
--color-border-2:     rgba(255,255,255,0.16)
--color-text:         #f0f0f0
--color-text-2:       #999999
--color-text-3:       #555555
--color-accent:       #c9a84c
--color-accent-dim:   rgba(201,168,76,0.12)
--color-accent-mid:   rgba(201,168,76,0.25)
--color-accent-bright:#ffd966
--color-keep:         #2a7a2a
--color-keep-hover:   #339933
--color-delete:       #8a2a2a
--color-delete-hover: #b33333
--color-tag-bw:       #888888
--color-tag-pano:     #4a90d9
--color-tag-burst:    #e8943a
```

### Typography
- UI font: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- Mono font: `'SF Mono', 'Fira Code', monospace`
- Sizes: 10px (xs) / 11px (sm) / 13px (base) / 14px (md) / 16px (lg)

### Spacing Scale
`4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48px`

### Logo Files
```
src/assets/logo/frame-mark.svg              — mark only, no background
src/assets/logo/frame-mark-contained.svg   — mark + #1a1a1a rounded square
src/assets/logo/frame-wordmark-dark.svg    — mark + "FRAME" light on dark
src/assets/logo/frame-wordmark-light.svg   — mark + "FRAME" dark on light
build/icons/icon.icns                       — macOS dock icon
build/icons/icon.ico                        — Windows icon
```

---

## Delete Behavior — Option A

**The rule:** Marking a file "deleted" in the Sorter ONLY updates `files.status = 'deleted'` in SQLite. The file stays on disk, untouched, in its event folder.

**Un-deleting** is instant: call `file:updateStatus(fileId, 'kept')` — no file move needed.

**Filesystem cleanup happens at two explicit moments only:**

1. **"Clean up deleted files" button in Sorter toolbar**
   - Only visible when session has files with `status = 'deleted' AND trashed_at IS NULL`
   - Shows: "Move N deleted files to trash? This will free ~X GB."
   - On confirm: `fs:moveToTrash` for each file, updates `file.full_path` and `file.trashed_at`

2. **Session Complete screen**
   - Shows: "N files are marked deleted and still on disk. Remove them now to free X GB?"
   - Same behavior — moves to `.frame-trash`, does not permanently delete

**Permanent deletion** always requires a separate "Empty Trash" confirmation step.

**The `.frame-trash` folder** lives inside the event folder (`event-1/.frame-trash/`).

**Disk space calculation:** Sum `size_bytes` for all `status = 'deleted'` files in session. Format: GB if ≥ 1000 MB, else MB, one decimal.

---

## Sequence Detection Algorithm

Single-pass detection produces `{ panoramas, bursts, ambiguous }`.

### Fast-reject for panorama (→ may still be burst):
- Any inter-frame gap < `panoMinGapSeconds` (1.5s)
- Median shutter > `panoMaxShutterSpeed` (1/500s) — suggests action shooting
- Frame count > `panoMaxFrames` (20)

### Fast-reject for burst (→ may still be pano):
- Median gap > `burstMaxGapSeconds` (2.0s)
- Frame count > `burstMaxFrames` (60)

### Classification:
```
pano rejected, burst not: → 'panorama'
burst rejected, pano not: → 'burst'
neither rejected:         → compare confidence scores
                            higher score wins → 'ambiguous-pano' or 'ambiguous-burst'
both rejected:            → 'unclassified' (skip)
```

### Why lacrosse bursts don't become panoramas:
Lacrosse bursts at 3fps (D80 CH mode) have ~333ms inter-frame gaps and shutter speeds of 1/500–1/1000s. Both criteria trigger fast-reject for panorama immediately.

---

## Planned but Not Yet Built

### Export / Import — `.framelib` format 💭

**Priority:** High — needed for Mac migration in 4-6 weeks.

**Design:**

Export creates `Frame_Export_[date].framelib` (a zip containing):
```
manifest.json      version, export date, hostname, photo root paths
frame.db           complete SQLite database
thumbcache/        all thumbnails (optional — include checkbox + size warning)
settings.json      electron-store config
```

Import flow (5 steps):
1. Select `.framelib` file
2. Show summary: N sessions, M photos, export date
3. **Path remapping** — detect paths that don't resolve, ask user to map each old root to new location
4. Confirmation: "Import will replace your current Frame library"
5. Progress: copy db → update all `full_path` values → copy thumbcache → write settings → restart

**Approach A (chosen for timeline):** Path remapping on import. One-time fix when paths change. Simpler than Approach B.

**Approach B (v2.0 consideration):** Relative paths stored relative to a library root. Eliminates path remapping entirely but requires schema change.

**`.framelib` file association:** Register in electron-builder so double-clicking opens Frame and triggers import.

**Claude Code prompt:** Not yet written. When ready, covers:
- `library:export(options)` IPC channel
- `library:import(filePath)` IPC channel with path remapping UI
- ExportPanel.vue and ImportPanel.vue components
- electron-builder file association config
- Backup of existing db before overwrite (`frame.db.backup.[timestamp]`)

---

### Theme System 💭
Three themes planned for v2.0:
- **Dark Gold** (current) — #1a1a1a + #c9a84c
- **Light Editorial** — #F7F4F0 + #C4522A burnt sienna
- **Bold Violet** — #16111F + #E8943A amber

Implementation: CSS custom property swap on `:root`. All colors already in tokens.css as variables — no hardcoded hex in components. Theme is one variable set swap.

---

### In-App Help System 💭
Deferred until user base exists. For now: Option 4 hybrid docs.
- **PDF:** Quick start (1 page) + keyboard reference (1 page) + pipeline overview (1 page)
- **Website:** Full reference docs, tutorial walkthroughs, troubleshooting, changelog

---

### Website 💭
Hugo + Netlify + GitHub. Planned content:
- Documentation (primary purpose initially)
- Blog / photo gallery
- "Frame: Built with Claude" paper/post

Requires photo release consideration before publishing player photos.

---

### Relative Paths (v2.0) 💭
Replace absolute `full_path` in files table with paths relative to a library root. Eliminates Mac migration path remapping problem permanently. Schema change — plan carefully.

---

## Blog / Paper Outline

**Title:** Frame: A Photo Workflow Studio, Built with Claude  
**Subtitle:** A case study in domain-driven software development through human-AI collaboration

**Thesis:** The quality of the outcome was determined by the quality of the problem definition, not by the AI's capabilities.

**Target audience:** General tech readers (primary), photographers, developers

**Format:** Long-form narrative (~8,000 words) + companion prompt appendix (~8-10,000 words)

### Part Structure
| Part | Title | ~Words |
|---|---|---|
| Abstract | — | 200 |
| 1 | The Problem | 1,300 |
| 1.1 | A photographer's unmet need | 600 |
| 1.2 | The Nikon D80 constraint | 400 |
| 1.3 | The scope of the problem | 300 |
| 2 | Before the Code: The Design Conversation | 2,300 |
| 2.1 | Starting with a photography guide | 500 |
| 2.2 | HTML prototypes as design tools | 600 |
| 2.3 | Architectural decisions made in conversation | 800 |
| 2.4 | The value of domain expertise in AI-assisted design | 400 |
| 3 | The Build | 3,700 |
| 3.1 | The technology stack and why | 400 |
| 3.2 | The prompting methodology | 700 |
| 3.3 | Selected prompts with annotation | 2,000 |
| 3.4 | What Claude Code does well, and where humans intervene | 500 |
| 4 | The Features | 2,300 |
| 4.1–4.7 | Pipeline / Triage / Sort / Detection / External tools / B&W / Branding | 300 each |
| 5 | Reflections | 1,400 |
| 5.1 | What this process is, and isn't | 400 |
| 5.2 | What surprised me (personal — written by Michael) | 400 |
| 5.3 | The meta-observation: conversation as design tool | 400 |
| 5.4 | Where Frame goes next | 200 |
| Appendix | Complete prompt set with annotations | 8-10k |

**Selected prompts for featured annotation (Section 3.3):**
1. Prompt 1A — project scaffold
2. Prompt 2A — file system service
3. Prompt 6A — session schema
4. Prompt 9A revised — Option A delete
5. Prompt 11B — unified sequence detection
6. Prompt 13A — burst compare view
7. Branding Prompt A — visual specification

---

## Version History

| Version | What shipped |
|---|---|
| v1.0.0 | Core pipeline: Triage, Sort, Edit, Process, Publish (with ArchiVault + iCloud integration) |
| v1.1.0 | Phases 11-14: Panoramas, Bursts, Smart Albums, Sequence Detection (in progress) |
| v1.2.0 | Branding A+B: Logo, redesigned home screen, UI polish (in progress) |
| v2.0 | Planned: relative paths, theme system, in-app help |

---

*This document is maintained alongside the Frame codebase.*  
*Design conversation: Claude.ai (long-form chat)*  
*Build: Claude Code*
