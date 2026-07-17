# Frame — Design Notes & Session Index

> **Photo Workflow Studio** · Electron + Vue 3 + SQLite  
> Built with Claude · Design conversations in Claude.ai · Build in Claude Code  
> Last updated: July 2026

This document is the persistent index of all design decisions, prompts, and architectural choices made across the Claude.ai design conversation. Keep it updated as new phases are built. Bring it into Claude Code sessions as context when needed.

---

## Current Status

Phases 11–14 (Panoramas, Bursts, Smart Albums, Sequence Detection) build in progress with Claude Code — targeting v1.1.0. Branding Prompt A (logo, icons, splash screen) complete and looking great. Branding Prompt B (home screen redesign, UI polish) in progress — B1 and B2 handed to Claude Code, checking results between prompts.

Export/Import feature fully designed but Claude Code prompts not yet written — needed within 4–6 weeks for planned Mac migration. Blog/paper outline drafted in full; writing not yet started.

**Next actions:**
- [x] Complete Phases 11–14 in Claude Code
- [x] Complete Branding B1 and B2, verify in app
- [x] Run Export/Import + Auto-Backup prompts (E1, E2) in Claude Code
- [ ] Begin blog/paper Part 1 in chat
- [ ] Mac migration using Export/Import

---

## Decisions Log

*Reverse-chronological. One line per decision + rationale.*

| Date | Decision | Rationale |
|---|---|---|
| 2026-07 | Chose Times New Roman Regular Italic (J6) for logomark F | Most distinctive of 12 options explored; italic echoes strip tilt rhythm; regular weight lets bright rim do the lifting |
| 2026-07 | Chose H3 strip treatment — 5 fading gold strips + dark gap + #ffd966 rim on F | 5 strips fill the icon completely; fading opacity reads as negative film; I3 rim separates F from strips without being decorative |
| 2026-07 | Home screen redesigned: session cards + pipeline bar + library stats | Original home was a plain list — not intuitive, bland for new users; redesign makes pipeline visible and rewards continued use with growing stats |
| 2026-07 | Export/Import + Auto-Backup: E1 + E2 prompt pair, `.framelib` zip format, 7-day rolling backup, pre-import backup, Snapshots deferred to v2.0 | Snapshot rollback approximated by Option A delete; auto-backup covers corruption risk at low cost |
| 2026-07 | Kept gold/dark color palette (#c9a84c on #1a1a1a) — no color scheme change | Strong combination, cinematic, right for a photography tool; changing it would require rebuilding all token references for little gain |
| 2026-07 | Blog/paper format: long-form narrative + companion prompt appendix | Lets general readers read the story without prompt overwhelm; developers can go deep in companion doc |
| 2026-07 | Export/Import: Approach A (path remapping on import) for Mac migration | Approach B (relative paths) is better long-term but requires schema change; Approach A implementable in one Claude Code session within the 4–6 week window |
| 2026-07 | Publish module renamed from Upload | "Publish" correctly implies intent; "Upload" implied mechanics; rename done by Claude Code post-v1.0 |
| 2026-06 | B&W conversion stays in Darktable, not Frame | True B&W from RAW requires channel mixing, local contrast, grain — Darktable's Color Calibration module is professional-grade; Frame adds tag/preview/handoff workflow only |
| 2026-06 | Panorama stitching via Hugin, not native engine | Homography + multi-band blending is substantial math; Hugin is free, excellent, and already integrates via CLI; Frame handles selection, grouping, and handoff |
| 2026-06 | Burst composite via ffmpeg lighten blend + Hugin alignment (optional) | ffmpeg lighten mode works well for colored jerseys on green field; Hugin alignment available for cleaner results; staged complexity matches use cases |
| 2026-06 | Single-pass sequence:detectGroups returns panoramas + bursts | Panorama and burst detection share the same run-building logic; two outputs from one scan is more efficient and cleaner than two separate scans |
| 2026-06 | Burst fast-reject: shutter > 1/500s OR gap < 1.5s → not a panorama | Lacrosse bursts at 3fps (333ms gaps, 1/500–1/1000s shutter) fail both criteria immediately — solves the sports burst / panorama ambiguity problem |
| 2026-06 | Delete behavior: Option A — database-only soft delete | Files stay on disk during sort; un-delete is instant; destructive action is explicit and informed (disk space shown); matches Lightroom's "reject" model |
| 2026-06 | Session model as central organizing concept | Without sessions, every launch is from scratch; sessions enable resume, history, library stats, and pipeline state tracking |
| 2026-06 | Frame as orchestrator, not replacement for Darktable/RawTherapee | Professional RAW tools took decades to build; Frame's value is the pipeline connection, not competing with them |
| 2026-05 | Vue 3 Options API (not Composition API) | Developer knows Options API; wants to read and understand the code Claude Code produces; Composition API would be opaque |
| 2026-05 | Electron + Vue 3 + Vite + better-sqlite3 + sharp | Real filesystem access needed (File System Access API too limited); SQLite for session persistence; sharp for thumbnail generation |
| 2026-05 | HTML prototypes (PhotoTriage, PhotoSorter) before Electron | Browser sandbox enabled rapid UI iteration; prototypes clarified requirements before committing to Electron complexity |
| 2026-04 | Nikon D80 Lacrosse Photography Field Guide as first artifact | Documenting camera settings for personal use revealed the shape of the software problem — guide became seed content for Frame's Process module tips |

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

### Phase 11 — Unified Sequence Detection Schema ✅
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

### Phase 12 — Panorama UI ✅
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

### Phase 13 — Burst UI ✅
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

### Phase 14 — Settings Integration ✅
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

### Branding B — Home Screen & UI Polish ✅
| Prompt | Description |
|---|---|
| B1 | HomeModule.vue redesign — top bar (logo + wordmark + session pill + version), pipeline bar (5 clickable stages), session card grid (3-col), SessionCard.vue component, library stats row, empty state |
| B2 | App-wide polish — macOS traffic lights, module transitions, global toast system (provide/inject), ⌘1-7 + ⌘, shortcuts, EmptyState.vue component, micro-interactions, typography, window state persistence |

---

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

## Export / Import / Backup

Three related but distinct features. Two prompts (E1 and E2) cover all three.

### The Distinction

| Feature | Purpose | Frequency | Scope | Initiated by |
|---|---|---|---|---|
| **Export/Import** | Move library between machines | Rare / one-time | Whole library, portable | User explicitly |
| **Auto-backup** | Protect against loss or mistakes | Every launch | Database only, local | Automatic |
| **Snapshots** | Experiment with rollback position | Per-session | One session's DB state | User explicitly |

Snapshots are deferred to v2.0. See [Future Features](#future-features).

---

### Prompt E1 — Export / Import

**Use case:** Mac migration, second machine, sharing a library.

**The `.framelib` format** (a zip file):
```
Frame_Export_[date].framelib
├── manifest.json       version, export date, hostname, photo root paths used
├── frame.db            complete SQLite database copy
├── thumbcache/         all thumbnails (optional — checkbox + size warning)
└── settings.json       electron-store config
```

**Export flow:**
1. File → Export Frame Library…
2. Options: include thumbnail cache (shows size, default OFF), destination picker
3. "Export" button — zip created with progress bar
4. Success: reveal in Finder

**Import flow (5 steps):**
1. File → Import Frame Library… (or double-click `.framelib` file)
2. Read manifest.json, show summary: N sessions, M photos, exported from [hostname] on [date]
3. **Path remapping** — for each root path in manifest that doesn't resolve on this machine, show a folder picker: `[old path] → [pick new location]`. "Skip" option for paths that no longer exist.
4. Confirmation: "Import will replace your current Frame library. A backup of your current library will be created first."
5. Progress: backup current db → copy frame.db → update all `full_path` values with remappings → copy thumbcache (if included) → write settings → prompt to restart

**Pre-import backup:** Always create `~/.frame/backups/frame-pre-import-[timestamp].db` before overwriting. Non-negotiable — protects against a bad import destroying the existing library.

**`.framelib` file association:** Register in electron-builder so double-clicking opens Frame and triggers import.

**IPC channels:**
- `library:export(options)` → streams progress, returns `{ success, outputPath, sizeBytes }`
- `library:getManifest(filePath)` → reads manifest from .framelib without full extract
- `library:import(filePath, pathMappings)` → full import with remapping, returns `{ success, sessionsImported, filesImported }`
- `library:validateDb(dbPath)` → runs `PRAGMA integrity_check`, returns `{ valid, errors }`

**Components:**
- `src/modules/Settings/ExportPanel.vue`
- `src/modules/Settings/ImportPanel.vue`
- Both accessible from Settings panel under a new "Library" section

---

### Prompt E2 — Auto-Backup

**Use case:** Insurance against database corruption, failed migrations, bad schema updates, accidental session deletion.

**What it backs up:** The SQLite database (`frame.db`) only. Photo files are the user's responsibility (Time Machine, external drive). Make this explicit in the UI.

**What it does NOT back up:** Photo files, thumbnail cache, electron-store settings.

**Trigger:** On every app launch, before the main window appears (during splash screen "Initializing database" step).

**Retention:** Keep last 7 backups. Auto-delete oldest when adding an 8th. 7 days of daily use = 1 week of history.

**Storage location:** `~/.frame/backups/`
**Filename format:** `frame-YYYY-MM-DD-HHmm.db`
**Example:** `frame-2026-07-17-0834.db`

**Deduplication:** If a backup already exists for today (same YYYY-MM-DD), skip — don't create a duplicate for multiple launches in the same day. Check by listing existing backups before creating.

**IPC channels:**
- `backup:create()` → called on launch, returns `{ success, backupPath, skipped }`
- `backup:list()` → returns `[{ filename, path, sizeBytes, createdAt }]` sorted newest first
- `backup:restore(backupPath)` → confirm dialog, copy backup over current db, returns `{ success }`
- `backup:delete(backupPath)` → delete a specific backup file
- `backup:openFolder()` → `shell.showItemInFolder()` on backups directory

**Settings panel — "Library" section:**

New section in SettingsPanel.vue:

```
LIBRARY

  Auto-backup
    ✓ Back up database on launch (recommended)
    [toggle — default ON, stored in electron-store]

  Recent backups                              [Open folder ↗]
  ┌─────────────────────────────────────────────────────┐
  │  Today, 8:34 AM          frame-2026-07-17-0834.db  │
  │  2.1 MB                  [Restore]  [Delete]        │
  ├─────────────────────────────────────────────────────┤
  │  Yesterday, 9:12 AM      frame-2026-07-16-0912.db  │
  │  2.0 MB                  [Restore]  [Delete]        │
  └─────────────────────────────────────────────────────┘
  (up to 7 shown)

  Note: Frame backs up your session database automatically.
  Your photo files are not included — back those up separately
  using Time Machine or your preferred backup solution.
```

**Restore confirmation dialog:**
```
Restore from backup?

This will replace your current Frame library with the
backup from [date/time]. Any changes made since then
will be lost.

Your current library will be saved as a backup first.

[Cancel]   [Restore and restart]
```

**On restore:** Before copying the backup over current db, create one more backup of the current state (`frame-pre-restore-[timestamp].db`). Then copy, then call `app.relaunch()` + `app.exit(0)`.

**Integration with E1:** The `backup:create()` function is also called by `library:import()` before any import. Shared utility function in `electron/services/backupService.js`.

---

## Future Features

Features that are designed and understood but explicitly deferred. Revisit for v2.0.

### Snapshots 💭

**What it is:** A named, point-in-time capture of a single session's database state. Lets you experiment (try aggressive culling, try reordering events) with a rollback position if you change your mind.

**Why deferred:** The existing Option A delete behavior already approximates this for the most common case — deleted files stay on disk, un-delete is instant via status change. The added complexity of snapshot UI (naming, browsing, restoring per-session state) isn't justified until the use case is more clearly felt by real users.

**When to revisit:** If users express frustration with not being able to undo bulk operations (e.g., "I accidentally marked 50 photos as deleted and can't undo"). The auto-backup (E2) partially addresses this — you can restore from yesterday's backup — but session-scoped snapshots would be more surgical.

**Rough design when the time comes:**
- `session_snapshots` table: id, session_id, name, created_at, db_snapshot (BLOB or path to snapshot file)
- "Take snapshot" button in Sorter toolbar when a session is active
- Snapshot browser in session detail view
- Restore: re-apply the snapshot's file status values to the current files table (not a full DB restore)
- Keep max 5 snapshots per session

---

### Relative Paths (v2.0) 💭

Replace absolute `full_path` in files table with paths relative to a library root. Eliminates Mac migration path remapping problem permanently. Schema change — plan carefully. Supersedes the path remapping step in E1 once implemented.

---

### Theme System (v2.0) 💭

Three themes:
- **Dark Gold** (current) — #1a1a1a + #c9a84c
- **Light Editorial** — #F7F4F0 + #C4522A burnt sienna
- **Bold Violet** — #16111F + #E8943A amber

Implementation: CSS custom property swap on `:root`. All colors already in tokens.css as variables. Theme is one variable set swap. Add theme picker to Settings.

---

### In-App Help System (v2.0) 💭

Deferred until user base exists. For now: Option 4 hybrid docs.
- **PDF:** Quick start (1 page) + keyboard reference (1 page) + pipeline overview (1 page)
- **Website:** Full reference docs, tutorial walkthroughs, troubleshooting, changelog

---

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

---

## Claude Code Prompts — E1 and E2

### Prompt E1 — Export / Import

```
Add Export and Import capabilities to Frame.
This covers moving a Frame library between machines —
the primary use case is Mac migration.

Build after Branding B is complete and verified.

═══════════════════════════════════════════════════════════
PART 1 — SHARED BACKUP UTILITY
═══════════════════════════════════════════════════════════

Create electron/services/backupService.js

This module is shared by both Export/Import (E1) and
Auto-Backup (E2). Build it first — both prompts depend on it.

const path = require('path')
const fs   = require('fs/promises')
const { app } = require('electron')

const DB_PATH      = path.join(app.getPath('home'), '.frame', 'frame.db')
const BACKUPS_DIR  = path.join(app.getPath('home'), '.frame', 'backups')

async function ensureBackupsDir() {
  await fs.mkdir(BACKUPS_DIR, { recursive: true })
}

async function createBackup(label = null) {
  // label: optional string suffix, e.g. 'pre-import', 'pre-restore'
  // default filename: frame-YYYY-MM-DD-HHmm.db
  // labeled filename: frame-pre-import-[timestamp].db
  await ensureBackupsDir()

  const now  = new Date()
  const date = now.toISOString().slice(0, 10)          // YYYY-MM-DD
  const time = now.toTimeString().slice(0, 5).replace(':', '') // HHmm

  const filename = label
    ? `frame-${label}-${date}-${time}.db`
    : `frame-${date}-${time}.db`

  const dest = path.join(BACKUPS_DIR, filename)
  await fs.copyFile(DB_PATH, dest)
  const stat = await fs.stat(dest)
  return { filename, path: dest, sizeBytes: stat.size, createdAt: now.toISOString() }
}

async function listBackups() {
  await ensureBackupsDir()
  const files = await fs.readdir(BACKUPS_DIR)
  const backups = []
  for (const f of files) {
    if (!f.endsWith('.db')) continue
    const fp   = path.join(BACKUPS_DIR, f)
    const stat = await fs.stat(fp)
    backups.push({
      filename: f,
      path: fp,
      sizeBytes: stat.size,
      createdAt: stat.birthtime.toISOString()
    })
  }
  return backups.sort((a, b) =>
    new Date(b.createdAt) - new Date(a.createdAt))
}

async function pruneBackups(keepCount = 7) {
  // Keep only the N most recent non-labeled backups
  // (labeled backups like pre-import are kept separately)
  const all = await listBackups()
  const regular = all.filter(b =>
    /^frame-\d{4}-\d{2}-\d{2}-\d{4}\.db$/.test(b.filename))
  const toDelete = regular.slice(keepCount)
  for (const b of toDelete) {
    await fs.unlink(b.path).catch(() => {})
  }
}

async function restoreBackup(backupPath) {
  // Before restoring, save current db as a pre-restore backup
  await createBackup('pre-restore')
  await fs.copyFile(backupPath, DB_PATH)
}

async function validateDb(dbPath) {
  // Run PRAGMA integrity_check via better-sqlite3
  const Database = require('better-sqlite3')
  try {
    const db = new Database(dbPath, { readonly: true })
    const result = db.pragma('integrity_check')
    db.close()
    const valid = result.length === 1 && result[0].integrity_check === 'ok'
    return { valid, errors: valid ? [] : result.map(r => r.integrity_check) }
  } catch(e) {
    return { valid: false, errors: [e.message] }
  }
}

module.exports = {
  createBackup, listBackups, pruneBackups,
  restoreBackup, validateDb,
  DB_PATH, BACKUPS_DIR
}

Wire up IPC channels in main.js:

  backup:create()
    → backupService.createBackup()
    → returns { success, backup: { filename, path, sizeBytes, createdAt } }

  backup:list()
    → backupService.listBackups()
    → returns [{ filename, path, sizeBytes, createdAt }]

  backup:restore(backupPath)
    → backupService.restoreBackup(backupPath)
    → returns { success }
    → then: app.relaunch(); app.exit(0)

  backup:delete(backupPath)
    → fs.unlink(backupPath)
    → returns { success }

  backup:openFolder()
    → shell.showItemInFolder(BACKUPS_DIR)

═══════════════════════════════════════════════════════════
PART 2 — THE .framelib FORMAT
═══════════════════════════════════════════════════════════

Install as dependency: npm install archiver unzipper

The .framelib file is a ZIP archive with this structure:

  manifest.json
  frame.db
  thumbcache/          (optional)
    [SHA256].jpg
    [SHA256].jpg
    ...
  settings.json        (electron-store config)

manifest.json schema:
  {
    "frameVersion": "1.2.0",
    "exportDate": "2026-07-17T08:34:00.000Z",
    "hostname": "Michaels-MacBook-Pro",
    "platform": "darwin",
    "photoRoots": [
      "/Volumes/LacrosseDrive/2026",
      "/Users/michael/Pictures"
    ],
    "sessionCount": 12,
    "fileCount": 4231,
    "includedThumbs": false,
    "thumbCount": 0
  }

photoRoots: extract the unique top-level directory components
from all full_path values in the files table. These are what
need remapping on the destination machine.

Extract them with:
  SELECT DISTINCT full_path FROM files WHERE full_path IS NOT NULL
  Then parse each path to find the mount point or home-relative root.
  Group by common prefix — paths sharing the first 2-3 components
  belong to the same root.

═══════════════════════════════════════════════════════════
PART 3 — EXPORT IPC CHANNEL
═══════════════════════════════════════════════════════════

Add IPC channel: library:export(options)

options: {
  outputPath: string,      -- full path for output .framelib file
  includeThumbs: boolean,  -- default false
}

Implementation:

  1. Validate the current database first:
     const check = await validateDb(DB_PATH)
     if (!check.valid) return { success: false,
       error: 'Database integrity check failed: ' + check.errors.join(', ') }

  2. Build manifest.json:
     Query sessions count, files count from SQLite.
     Extract unique photo roots from files.full_path.
     Write manifest object.

  3. Get settings.json:
     Read electron-store config file from:
       macOS: ~/Library/Application Support/frame/config.json
       Win:   %APPDATA%/frame/config.json
     If not found, use empty object {}.

  4. Create ZIP using archiver:
     const archive = archiver('zip', { zlib: { level: 6 } })
     archive.pipe(fs.createWriteStream(outputPath))
     archive.append(JSON.stringify(manifest, null, 2),
       { name: 'manifest.json' })
     archive.file(DB_PATH, { name: 'frame.db' })
     archive.append(settingsJson, { name: 'settings.json' })

     If includeThumbs:
       archive.directory(THUMBCACHE_DIR, 'thumbcache')

     archive.finalize()

  5. Stream progress events during archiving:
     archive.on('progress', (p) => {
       ipcMain.emit('library:exportProgress', event, {
         entries: p.entries.processed,
         bytes: p.fs.processedBytes
       })
     })

  6. On finish:
     const stat = await fs.stat(outputPath)
     return { success: true, outputPath, sizeBytes: stat.size }

Also add: library:getExportSize(includeThumbs)
  Returns estimated export size in bytes:
    DB file size + (thumbcache dir size if includeThumbs) + 50KB overhead
  Use fs.stat for DB, recursive size sum for thumbcache.
  Return { dbBytes, thumbBytes, totalBytes }

═══════════════════════════════════════════════════════════
PART 4 — IMPORT IPC CHANNELS
═══════════════════════════════════════════════════════════

Add IPC channel: library:getManifest(filePath)
  Extract and parse manifest.json from the .framelib zip
  WITHOUT fully extracting it (use unzipper to read
  a single entry by name).
  Returns { success, manifest } or { success: false, error }

Add IPC channel: library:import(filePath, pathMappings)

pathMappings: [{ oldRoot: string, newRoot: string }]
  Each entry maps an old photo root path to its new location.

Implementation:

  1. Validate the .framelib file:
     - Can it be opened as a ZIP?
     - Does manifest.json exist and parse correctly?
     - Does frame.db exist in the archive?
     Return { success: false, error } on any failure.

  2. Create pre-import backup (ALWAYS):
     await backupService.createBackup('pre-import')

  3. Extract to a temp directory:
     const tmpDir = path.join(os.tmpdir(), 'frame-import-' + Date.now())
     await fs.mkdir(tmpDir)
     Use unzipper to extract all entries to tmpDir.

  4. Validate the extracted database:
     const check = await validateDb(path.join(tmpDir, 'frame.db'))
     if (!check.valid) {
       await fs.rm(tmpDir, { recursive: true })
       return { success: false,
         error: 'Imported database failed integrity check.' }
     }

  5. Apply path remappings to extracted database:
     Open tmpDir/frame.db with better-sqlite3.
     For each { oldRoot, newRoot } in pathMappings:
       UPDATE files
       SET full_path = newRoot || SUBSTR(full_path, LENGTH(oldRoot) + 1)
       WHERE full_path LIKE oldRoot || '%'
     Also update: original_path, output_path in burst_sets,
       output_path in pano_sets, composite_path in burst_sets.
     Close the database.

  6. Copy extracted database over current:
     await fs.copyFile(
       path.join(tmpDir, 'frame.db'), DB_PATH)

  7. Copy thumbcache if present:
     const thumbSrc = path.join(tmpDir, 'thumbcache')
     if (await fs.access(thumbSrc).then(() => true).catch(() => false)) {
       await fs.cp(thumbSrc, THUMBCACHE_DIR,
         { recursive: true, force: false })  // don't overwrite existing
     }

  8. Apply settings if present:
     Read tmpDir/settings.json.
     Merge into electron-store (don't wholesale replace —
     preserve any keys not in the import, like window state).
     Keys to import: tool paths, detection defaults,
       output folder preferences.
     Keys to preserve: window bounds, last-used session.

  9. Cleanup temp dir:
     await fs.rm(tmpDir, { recursive: true })

  10. Return:
      { success: true,
        sessionsImported: N,    -- count from manifest
        filesImported: M,
        thumbsImported: K }

  11. Caller (renderer) shows success then calls app.relaunch().

═══════════════════════════════════════════════════════════
PART 5 — EXPORT PANEL UI
═══════════════════════════════════════════════════════════

Create src/modules/Settings/ExportPanel.vue

Add to SettingsPanel.vue as a new "Library" section,
above the existing Thumbnail Cache section.

ExportPanel contents:

  Header: "Export Frame Library"
  Description (12px, text-3 color):
    "Create a portable backup of your sessions, metadata,
     and settings. Use this to move Frame to a new Mac or
     share your library."

  Options:
    Include thumbnail cache:
      Toggle (default OFF)
      Helper text (shown when OFF):
        "Thumbnails will be regenerated automatically on
         the new machine. (~X MB)" — populate X from
         library:getExportSize()
      Helper text (shown when ON):
        "Includes all cached thumbnails for faster startup.
         (~X MB total)"
      Live size estimate updates as toggle changes.

  Export button:
    "Export library…"
    On click:
      Open save dialog: dialog.showSaveDialog({
        defaultPath: 'Frame_Export_' +
          new Date().toISOString().slice(0,10) + '.framelib',
        filters: [{ name: 'Frame Library', extensions: ['framelib'] }]
      })
      If cancelled: return
      Show progress overlay:
        Spinner + "Exporting… X files"
        Progress from library:exportProgress IPC events
      On complete: show success state:
        "Export complete"
        File path (clickable — reveals in Finder)
        File size
        "Done" button dismisses

  Validation warning (shown if DB check fails on open):
    Warn box: "Your database may have integrity issues.
    Run a backup before exporting."

═══════════════════════════════════════════════════════════
PART 6 — IMPORT PANEL UI
═══════════════════════════════════════════════════════════

Create src/modules/Settings/ImportPanel.vue

Add to Settings "Library" section, below Export.

ImportPanel contents:

  Header: "Import Frame Library"
  Description:
    "Replace your current library with a .framelib export.
     Your current library will be backed up first."

  Import button:
    "Import library…"
    On click: open multi-step import flow (modal overlay)

IMPORT MODAL (5 steps, shown as a stepped modal):

  Step 1 — Select file:
    Open file dialog:
      filters: [{ name: 'Frame Library', extensions: ['framelib'] }]
    Call library:getManifest(filePath)
    If error: show error message, stay on step 1
    On success: advance to step 2

  Step 2 — Summary:
    Show manifest details:
      "This library contains:"
      N sessions · M photos · exported [date]
      "From: [hostname] on [platform]"
    Warning box:
      "Importing will replace your current Frame library.
       A backup of your current library will be created
       automatically before import."
    [Back]  [Continue →]

  Step 3 — Path remapping (only if needed):
    For each photoRoot in manifest.photoRoots:
      Check if path exists on current machine:
        await window.api.invoke('fs:pathExists', root)
      If exists: show as ✓ green "Found" — no action needed
      If missing: show as ⚠ amber with folder picker:
        "[old path]"
        "→ [Pick new location]" button
        Opens directory picker, stores selection
      "Skip" link: marks this root as skipped
        (files from this root will have broken paths
         but import will proceed)
    If all roots are found: show "All photo locations found ✓"
      and skip directly to step 4.
    [Back]  [Continue →] (disabled until all missing roots
      have either a mapping or are explicitly skipped)

  Step 4 — Confirmation:
    Summary of what will happen:
      "Ready to import:"
      ✓ N sessions, M photos
      ✓ [N thumbnail files] (if included in archive)
      ✓ Settings from [hostname]
      ✓ Your current library will be backed up first
      [list any skipped roots as ⚠ warnings]
    [Back]  [Import and restart]

  Step 5 — Progress:
    "Importing library…"
    Steps with checkmarks as each completes:
      ○ → ✓  Creating backup of current library
      ○ → ✓  Extracting archive
      ○ → ✓  Validating database
      ○ → ✓  Applying path remappings
      ○ → ✓  Copying files
      ○ → ✓  Updating settings
    On success:
      "Import complete! Frame will restart now."
      Auto-restart after 2 seconds (call app.relaunch then app.exit)
    On error:
      Show error message
      "Your original library has been preserved as a backup."
      [Close]

═══════════════════════════════════════════════════════════
PART 7 — FILE ASSOCIATION
═══════════════════════════════════════════════════════════

In package.json electron-builder config, add file association:

  "fileAssociations": [
    {
      "ext": "framelib",
      "name": "Frame Library",
      "description": "Frame Photo Workflow Library",
      "icon": "build/icons/icon",
      "role": "Editor"
    }
  ]

In electron/main.js, handle open-file events:

  app.on('open-file', (event, filePath) => {
    event.preventDefault()
    if (filePath.endsWith('.framelib')) {
      // Store path, open when window is ready
      global.pendingImportPath = filePath
    }
  })

  // After main window is ready-to-show:
  if (global.pendingImportPath) {
    mainWindow.webContents.send(
      'library:triggerImport', global.pendingImportPath)
    global.pendingImportPath = null
  }

In App.vue, listen for the trigger:
  window.api.on('library:triggerImport', (filePath) => {
    // Navigate to Settings → Library section
    // and pre-populate the import modal with filePath
    this.currentModule = 'Settings'
    this.$nextTick(() => {
      this.$refs.settings.openImport(filePath)
    })
  })

Also add ipcRenderer listener in preload.js:
  'library:triggerImport': callback listener

Also add: fs:pathExists(filePath) IPC channel in main.js:
  → fs.access(filePath).then(() => true).catch(() => false)

═══════════════════════════════════════════════════════════
VERIFICATION CHECKLIST — E1
═══════════════════════════════════════════════════════════

□ backupService.js created with all functions
□ All backup: IPC channels registered in main.js
□ library:export creates a valid .framelib zip
□ .framelib contains manifest.json, frame.db, settings.json
□ manifest.json photoRoots correctly extracted from file paths
□ Export size estimate shown and updates on toggle
□ Progress events fire during export
□ library:getManifest reads manifest without full extract
□ library:import: pre-import backup created BEFORE any changes
□ library:import: path remapping updates full_path in files table
□ library:import: extracted db passes integrity check before copy
□ Import modal 5 steps all work, back/forward navigation
□ Path remapping step skipped when all roots exist locally
□ "Skip" option works — import proceeds with warning
□ App restarts after successful import
□ On import error: original library intact (backup preserved)
□ Double-clicking .framelib file on macOS opens Frame + import
□ Settings panel shows Library section with Export + Import
□ No regressions in existing Settings sections
```

---

### Prompt E2 — Auto-Backup

```
Add automatic database backup to Frame.
Run after Prompt E1 is complete — this prompt depends on
backupService.js created in E1 Part 1.

═══════════════════════════════════════════════════════════
PART 1 — LAUNCH-TIME BACKUP
═══════════════════════════════════════════════════════════

In electron/main.js, in the app startup sequence
(during the splash screen, at the "Initializing database"
progress step), add:

  const backupService = require('./services/backupService')
  const Store = require('electron-store')
  const store = new Store()

  async function runAutoBackup() {
    // Check if auto-backup is enabled (default: true)
    const enabled = store.get('autoBackup.enabled', true)
    if (!enabled) return { skipped: true, reason: 'disabled' }

    // Check if we already backed up today
    const backups = await backupService.listBackups()
    const today   = new Date().toISOString().slice(0, 10)  // YYYY-MM-DD
    const regular = backups.filter(b =>
      /^frame-\d{4}-\d{2}-\d{2}-\d{4}\.db$/.test(b.filename))
    const alreadyToday = regular.some(b => b.filename.startsWith('frame-' + today))

    if (alreadyToday) {
      return { skipped: true, reason: 'already backed up today' }
    }

    // Check that frame.db exists (first launch has no db yet)
    const dbExists = await require('fs/promises')
      .access(backupService.DB_PATH)
      .then(() => true).catch(() => false)
    if (!dbExists) return { skipped: true, reason: 'no database yet' }

    // Create the backup
    const backup = await backupService.createBackup()

    // Prune old backups (keep 7 regular backups)
    await backupService.pruneBackups(7)

    return { skipped: false, backup }
  }

Call runAutoBackup() during startup, between the database
init step and the "Loading sessions" step.

If backup fails: log the error but DO NOT prevent app startup.
The app should always start even if backup fails.

If backup succeeds: log to console (dev) — no UI notification.
Backup is silent and automatic. Users see it only in Settings.

═══════════════════════════════════════════════════════════
PART 2 — SETTINGS PANEL — LIBRARY SECTION
═══════════════════════════════════════════════════════════

In SettingsPanel.vue, in the Library section created by E1,
add a "Auto-backup" subsection BELOW the Export/Import panels.

─── AUTO-BACKUP SUBSECTION ───────────────────────────────

Header: "Auto-backup"

Toggle row:
  Label: "Back up database on launch"
  Sublabel (12px, text-3): 
    "A copy of your session database is saved each time
     Frame starts. Keeps the last 7 days."
  Toggle: default ON
  On change: store.set('autoBackup.enabled', value)
             via new IPC channel: settings:set(key, value)

Note row (below toggle, always visible):
  Icon: ⓘ (info circle)  
  Text (11px, text-3, italic):
    "Frame backs up your session database automatically.
     Your photo files are not included — back those up
     separately using Time Machine or your preferred
     backup solution."

─── RECENT BACKUPS ───────────────────────────────────────

Subsection: "Recent backups"

Right-aligned link: "Open folder ↗"
  On click: window.api.invoke('backup:openFolder')

Backup list:
  Load from backup:list() on Settings panel mount.
  Refresh after any restore or delete action.

  If no backups yet:
    Muted text: "No backups yet. Frame will create one
    on next launch."

  If backups exist, show list (max 7 items):

    Each backup row:
      Left:
        Date/time (formatted): "Today, 8:34 AM"
          or "Yesterday, 9:12 AM"
          or "Jun 14, 10:05 AM"
        Filename in text-3 color: "frame-2026-07-17-0834.db"
      Right:
        File size: "2.1 MB" (text-3)
        "Restore" button (small, secondary style)
        "Delete" button (small, danger-muted style — 
          color: var(--color-delete-hover), no background)

    Date formatting function:
      const now = new Date()
      const d   = new Date(backup.createdAt)
      const diffDays = Math.floor((now - d) / 86400000)
      if (diffDays === 0) return 'Today, ' + formatTime(d)
      if (diffDays === 1) return 'Yesterday, ' + formatTime(d)
      return formatDate(d) + ', ' + formatTime(d)

    File size formatting:
      if bytes < 1024*1024: return (bytes/1024).toFixed(1) + ' KB'
      return (bytes/1024/1024).toFixed(1) + ' MB'

─── RESTORE FLOW ─────────────────────────────────────────

On "Restore" click:

  Show confirmation modal:

    Title: "Restore from backup?"
    Body:
      "This will replace your current Frame library with
       the backup from [formatted date/time].

       Any changes made since then will be lost.

       Your current library will be saved as an additional
       backup before restoring."
    Buttons: [Cancel]  [Restore and restart]

  On confirm:
    Show inline progress: "Restoring…"
    Call backup:restore(backupPath)
    On success: "Restarting Frame…" then app restarts
    On error: show error message, leave library intact

─── DELETE FLOW ──────────────────────────────────────────

On "Delete" click:

  Inline confirmation (no modal — small action):
    Replace the row buttons with:
      "Delete this backup?" [Yes, delete]  [Cancel]
    On confirm: call backup:delete(backupPath)
    Remove row from list immediately (optimistic update)
    On error: restore the row, show toast error

═══════════════════════════════════════════════════════════
PART 3 — SETTINGS IPC CHANNEL
═══════════════════════════════════════════════════════════

Add IPC channel: settings:set(key, value)
  Uses electron-store: store.set(key, value)
  Returns { success }

Add IPC channel: settings:get(key, defaultValue)
  Uses electron-store: store.get(key, defaultValue)
  Returns { value }

These are general-purpose settings channels. If they already
exist from Phase 4A, verify they match this signature and
update if needed. They are used by the auto-backup toggle
and may be used by other settings in future.

═══════════════════════════════════════════════════════════
VERIFICATION CHECKLIST — E2
═══════════════════════════════════════════════════════════

□ Auto-backup runs silently on app launch
□ Backup is skipped if one already exists for today
□ Backup is skipped on very first launch (no db yet)
□ App starts normally even if backup throws an error
□ Backups appear in ~/.frame/backups/ with correct filenames
□ Old backups pruned — only 7 regular backups kept
□ Settings panel shows auto-backup toggle
□ Toggle persists across app restarts
□ Backup list loads and displays correctly
□ Date/time and file size formatted correctly
□ "Open folder" reveals backups directory in Finder
□ Restore: confirmation modal shown before any action
□ Restore: pre-restore backup created before overwrite
□ Restore: app restarts after successful restore
□ Restore: on error, library is intact
□ Delete: inline confirmation, no modal
□ Delete: row removed from list immediately
□ Note about photo files NOT being included is visible
□ No regressions in E1 export/import functionality
□ settings:set and settings:get channels work correctly
```
