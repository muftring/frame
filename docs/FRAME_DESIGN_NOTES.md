# Frame — Design Notes & Session Index

> **Photo Workflow Studio** · Electron + Vue 3 + SQLite  
> Built with Claude · Design conversations in Claude.ai · Build in Claude Code  
> Last updated: July 2026

This document is the persistent index of all design decisions, prompts, and architectural choices made across the Claude.ai design conversation. Keep it updated as new phases are built. Bring it into Claude Code sessions as context when needed.

---

## Current Status

**v1.5 shipped.** Phases 11–14 complete: unified sequence detection, panorama workflow, burst workflow, settings integration.

**v2.0 shipped.** Branding A+B + Export/Import + Auto-Backup complete.

**v2.1 shipped.** Curator Notes: session notes, group notes, global journal (~/.frame/journal.md), Obsidian export.

**v2.2 shipped.** Film strip clip fix (PR #22) + auto-update check (PR #23) + latest.json date fix (PR #24). Tagged and released August 27, 2026 — ahead of the August 31 milestone.

**v2.3 in progress.** Print order workflow: resolution + aspect ratio warnings, print order management, prepare print folder, manifest export, stage for upload, Bay Photo API. Six prompts (V2.3-A through V2.3-F), all written. V2.3-A built, merged (PR #35), not yet tagged. V2.3-B through V2.3-F not yet run. Due September 30, 2026.

**GitHub milestones:**
- v2.2 — due August 31, 2026 ✅ shipped Aug 27, 2026
- v2.3 — due September 30, 2026
- v3.0 — due October 31, 2026

**Next actions:**
- [x] Complete Phases 11–14 → v1.5
- [x] Branding A+B → v2.0
- [x] Export/Import + Auto-Backup (E1, E2) → v2.0
- [x] Mac migration using Export/Import
- [x] Run N1, N2, N3 in Claude Code → v2.1
- [x] Film strip clip fix (V2.2-A) → v2.2 (PR #22)
- [x] Auto-update check (V2.2-B) → v2.2 (PR #23)
- [x] latest.json date fix → v2.2 (PR #24)
- [x] Tag and release v2.2 → v2.2.0 shipped Aug 27, 2026
- [x] Resolution + aspect ratio warning system (V2.3-A) → v2.3 (PR #35, merged, not yet tagged)
- [ ] Run V2.3-B (Print Order management) in Claude Code → v2.3
- [ ] Run V2.3-C (Prepare print folder) in Claude Code → v2.3
- [ ] Run V2.3-D (Print order manifest export) in Claude Code → v2.3
- [ ] Run V2.3-E (Stage for Upload) in Claude Code → v2.3
- [ ] Bay Photo professional account + API credentials
- [ ] Run V2.3-F (Bay Photo API) in Claude Code, once credentials arrive → v2.3
- [ ] Tag and release v2.3
- [ ] Begin blog/paper Part 1 in chat
- [ ] iCloud Photos integration planning → v3.0

---

## Collaboration Process

Frame is designed in Claude.ai and built in Claude Code, with Michael
as the bridge between the two. This section defines how the two
sessions stay in sync without overwriting each other's work.

### Division of ownership

| Domain | Owner | Notes |
|---|---|---|
| Feature design, architecture decisions | Claude.ai | What to build and why |
| Claude Code prompt authoring | Claude.ai | Handed to Michael → Claude Code |
| Branch names, release state, what's merged/tagged | Claude Code | Ground truth from the repo |
| Design notes updates touching repo mechanics | Claude Code | Reconcile against real repo state |
| Design notes updates: new features, decisions | Claude.ai → fragment | Additive, labeled, Claude Code merges |

### The two-segment bridge

```
Claude.ai ←→ Michael    Design intent, decisions, prompts, narrative
Michael ←→ Claude Code  Implementation, repo state, release mechanics
```

Michael carries design decisions from Claude.ai to Claude Code,
and carries repo corrections from Claude Code back to Claude.ai.

### Design update fragments

When Claude.ai generates design notes content, it produces a labeled
**fragment** rather than a direct rewrite of the doc. Claude Code reads
the fragment, diffs against the current doc, and merges additively —
preserving its own corrections.

Fragment format:
- Clearly labeled sections with ADD / UPDATE / APPEND intent
- Explicit "do not overwrite" callouts for Claude Code-owned sections
- Status language follows the agreed convention (see below)

### Status language convention

| State | Language to use |
|---|---|
| In design doc only, not yet run | "prompt written, not yet run" |
| PR merged to master, no release yet | "built and merged, not yet tagged" |
| git tag + GitHub Release confirmed | "✅ Shipped" |

### Repo conventions

- **Default branch: `master`** (not `main` — Michael's repos use original convention)
- Release tags: `vX.X.X` format
- "Shipped" requires both a git tag AND a GitHub Release with DMG attached
- `latest.json` URL uses `master` branch — Claude.ai will not assert `main`

---

## Decisions Log

*Reverse-chronological. One line per decision + rationale.*

| Date | Decision | Rationale |
|---|---|---|
| 2026-09 | Stage for Upload (#29) made top-level issue separate from Print Lab Integration — applies to TeamSnap, Sprocket, any destination without an API; is its own workflow independent of print ordering | Grouping/sharing feature, not print-specific |
| 2026-09 | Print Order management (#32) is a first-class Frame feature independent of any lab API — SQLite-backed, living doc with Markdown notes, status lifecycle, manifest export | API integration (Bay Photo) is just one delivery option at the end of the workflow |
| 2026-09 | Manifest export uses Electron's built-in printToPDF via offscreen BrowserWindow — no additional PDF library needed | Chromium renderer already bundled in Electron; avoids puppeteer/wkhtmltopdf dependency |
| 2026-09 | Bay Photo API mock mode via BAY_PHOTO_MOCK=true env var — full UI flow testable without credentials | Allows building V2.3-F before credentials arrive; mock ≠ skip, it's a real code path |
| 2026-09 | Mpix has no public developer API — integration only possible through ShootProof/Pixieset partnership; not directly buildable in Frame | Confirmed from DPReview forum + search; Mpix issue kept open in case a partnership opportunity arises |
| 2026-09 | v2.3 print order workflow: resolution warning + aspect ratio warning + crop assist + print order management + prepare folder + manifest export + stage for upload; Bay Photo API as optional enhancement layer | Full workflow has value independent of any API; manual upload to lab website is acceptable end step |
| 2026-09 | Crop-assist UX: setting aspectRatio to a non-preset value (e.g. 0.8 for 8×10) constrained drag behavior correctly but left the toolbar visually indistinguishable from Free mode. Fix: dynamically prepend a labeled preset to aspectOptions in EditorModule.vue's mounted() hook — Vue's existing :class binding picks it up with zero template changes. Fixed by Claude Code without being asked | Design spec described the handoff but not every resulting visual state; Claude Code owns UI ground truth |
| 2026-09 | V2.3-A verification checklist had one incorrect entry: "expect warn, ~162 DPI" for D80 at 16×20 — DPI figure correct but status wrong (162 < MIN_DPI_ACCEPTABLE 200 → 'error' not 'warn'). All other checklist examples verified correct, including the ~17% crop for 3:2 → 8×10 (16.7% exact 3:2, 16.3% D80 real sensor). Caught by Claude Code, implemented with correct thresholds, verified with 19 unit tests | Claude Code owns ground truth on computed values |
| 2026-09 | Aspect ratio warning added to resolution warning system (V2.3-A) — same prompt, same infrastructure; aspect ratio mismatches more common than resolution failures for DSLR shooters | 3:2 sensor → 8×10 print causes ~17% crop, affects composition; lab sites handle this poorly |
| 2026-09 | "Add to print order" keyboard shortcut: O in Sorter (alongside K keep, D delete) | Natural extension of the sort workflow; captures print intent at the moment of curation |
| 2026-08 | Collaboration process formalized: Claude.ai owns design intent + prompts; Claude Code owns repo ground truth + release state; design notes updates from Claude.ai arrive as labeled fragments for Claude Code to merge additively | Prevents overwrite of Claude Code corrections; prevents Claude.ai asserting wrong repo facts |
| 2026-08 | Default branch confirmed as `master` (not `main`) — Claude.ai will not assert branch names without Claude Code confirmation; auto-update URL corrected in PR #23 | `master` is Michael's long-standing convention from original git/GitLab setup |
| 2026-07 | Code signing + notarization added to v3.0 roadmap — Apple Developer account required; xattr workaround sufficient for personal use until then | Gatekeeper blocks unsigned apps with misleading "damaged" message |
| 2026-07 | Dock icon F centering: F_X=24 in generate-icons.js, not 50 — opentype.js glyph.getPath(x) places LEFT EDGE at x, unlike SVG text-anchor=middle which centers at x. Do not revert to 50. | Root cause: different rendering pipelines, different reference points |
| 2026-07 | Curator notes at three levels: session (SQLite), group (SQLite), global journal (flat .md file). Obsidian export one-way only. No in-Frame linking — leave that to Obsidian. | Frame captures notes in context with photos; Obsidian provides the knowledge graph across sessions |
| 2026-07 | v2.0 scope defined: Branding A+B + Export/Import + Auto-Backup + Design Notes. v1.5 shipped Phases 11-14. | Clean milestone — all new polish and infrastructure in one release |
| 2026-07 | Chose Times New Roman Regular Italic (J6) for logomark F | Most distinctive of 12 options explored; italic echoes strip tilt rhythm; regular weight lets bright rim do the lifting |
| 2026-07 | Chose H3 strip treatment — 5 fading gold strips + dark gap + #ffd966 rim on F | 5 strips fill the icon completely; fading opacity reads as negative film; I3 rim separates F from strips without being decorative |
| 2026-07 | Home screen redesigned: session cards + pipeline bar + library stats | Original home was a plain list — not intuitive, bland for new users; redesign makes pipeline visible and rewards continued use with growing stats |
| 2026-07 | Export/Import + Auto-Backup: E1 + E2 prompt pair, `.framelib` zip format, 7-day rolling backup, pre-import backup, Snapshots deferred to v3.0 | Snapshot rollback approximated by Option A delete; auto-backup covers corruption risk at low cost |
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
7. [Delete Behavior — Option A](#delete-behavior--option-a)
8. [Sequence Detection Algorithm](#sequence-detection-algorithm)
9. [Export / Import / Backup](#export--import--backup)
10. [Future Features](#future-features)
11. [Blog / Paper Outline](#blog--paper-outline)
12. [Version History](#version-history)
13. [Claude Code Prompts — E1 and E2](#claude-code-prompts--e1-and-e2)

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
~/.frame/backups/          Auto-backup files
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

### Phase 5 — Publish ✅
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

**Critical: 9A was revised** after initial prompt to specify Option A delete behavior explicitly. The revision is the authoritative version.

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
| 11B | `sequence:detectGroups(sessionId, options)` — single-pass detection returning `{ panoramas, bursts, ambiguous, summary }`. Fast-reject criteria, confidence scoring, histogram comparison option. |

**Detection options (all configurable):**
```js
{
  maxGapSeconds: 45,        minFrames: 3,
  requireConsecutiveNames: true,
  panoMaxShutterSpeed: 500, panoMaxFrames: 20,
  panoMinGapSeconds: 1.5,   panoFocalTolerance: 5,
  burstMaxGapSeconds: 2.0,  burstMinShutterSpeed: 250,
  burstMaxFrames: 60,       burstMinFrames: 3,
  highConfidenceThreshold: 80, mediumConfidenceThreshold: 50,
  useHistogramComparison: false, histogramSimilarityMin: 0.70
}
```

---

### Phase 12 — Panorama UI ✅
| Prompt | Description |
|---|---|
| 12A | Sorter pano integration — PANO badge, blue set border, pano info bar with "View set →" link |
| 12B | Gallery panorama panel — PanoSetView.vue, detection modal with all knobs, DetectionResults modal |
| 12C | Process module Hugin handoff — interactive open or CLI quick stitch (nona + enblend + autooptimiser) |

---

### Phase 13 — Burst UI ✅
| Prompt | Description |
|---|---|
| 13A | Sorter burst integration — BRST badge, burst info bar, BurstCompareView.vue with synchronized zoom grid |
| 13B | Gallery burst panel — BurstSetView.vue, keeper display, detection results BURSTS tab |
| 13C | Process module burst composite — ffmpeg motion trail, Hugin background-stabilized, sequence strip |

**Composite modes:** Motion trail (lighten blend) · Background-stabilized (Hugin) · Sequence strip

---

### Phase 14 — Settings Integration ✅
| Prompt | Description |
|---|---|
| 14A | Settings panel: sequence detection defaults, composite defaults, ffmpeg/Hugin paths, output folders |

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
F fill:     #c9a84c  ·  F dark gap: #0d0d0d sw=5  ·  F rim: #ffd966 sw=1.5
Background: #1a1a1a (contained mark), transparent (mark only)
```

---

### Branding B — Home Screen & UI Polish ✅
| Prompt | Description |
|---|---|
| B1 | HomeModule.vue redesign — top bar, pipeline bar (5 clickable stages), session card grid (3-col), SessionCard.vue, library stats row, empty state |
| B2 | App-wide polish — macOS traffic lights, module transitions, global toast (provide/inject), ⌘1-7 + ⌘, shortcuts, EmptyState.vue, micro-interactions, typography, window state persistence |

---

### Export / Import + Auto-Backup — E1, E2 ✅
| Prompt | Description |
|---|---|
| E1 | `backupService.js` shared utility. `.framelib` zip format with manifest, db, thumbcache, settings. Export IPC with progress streaming. Import IPC with path remapping + integrity check. ExportPanel.vue + ImportPanel.vue (5-step modal). `.framelib` file association. |
| E2 | Launch-time auto-backup: deduplication, 7-backup retention, silent failure. Settings panel Library section: backup list, restore flow (pre-restore backup + app.relaunch), inline delete confirmation. `settings:set/get` IPC channels. |

See full spec in [Export / Import / Backup](#export--import--backup) section.

---

## Feature Reference

### Keyboard Shortcuts (post-Branding-B)
| Key | Action | Key | Action |
|---|---|---|---|
| ⌘1 | Home | K | Keep (Sorter) |
| ⌘2 | Triage | D | Delete (Sorter) |
| ⌘3 | Sort | B | B&W candidate tag |
| ⌘4 | Edit | N | Panorama candidate tag |
| ⌘5 | Gallery | U | Burst candidate tag |
| ⌘6 | Process | P | B&W preview toggle |
| ⌘7 | Publish | C | Burst compare view |
| ⌘, | Settings | ← → | Navigate photos |

**In Burst Compare View:** ← → navigate · K/Enter keep · D/Delete reject · Shift+Enter keep best · 1-9 jump · +/- zoom · 0 reset · Escape close

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

| Tool | Use | Launch |
|---|---|---|
| Darktable | RAW editing, noise reduction, B&W | `shell.openPath()` or `spawn()` |
| RawTherapee | RAW editing, batch export (.pp3 presets) | `spawn()` CLI |
| Hugin | Panorama stitching | `spawn()` with .pto |
| nona / enblend / autooptimiser | Hugin CLI steps | `spawn()` |
| ffmpeg | Burst composite | `spawn()` |
| ArchiVault | Publish destination | IPC / custom |
| iCloud Photos | Publish destination | AppleScript `osascript` |

---

## Design System & Branding

### Color Palette (tokens.css)
```css
--color-bg: #1a1a1a          --color-surface: #242424
--color-surface-2: #2e2e2e   --color-surface-3: #383838
--color-border: rgba(255,255,255,0.09)
--color-border-2: rgba(255,255,255,0.16)
--color-text: #f0f0f0        --color-text-2: #999999
--color-text-3: #555555
--color-accent: #c9a84c      --color-accent-dim: rgba(201,168,76,0.12)
--color-accent-mid: rgba(201,168,76,0.25)
--color-accent-bright: #ffd966
--color-keep: #2a7a2a        --color-keep-hover: #339933
--color-delete: #8a2a2a      --color-delete-hover: #b33333
--color-tag-bw: #888888      --color-tag-pano: #4a90d9
--color-tag-burst: #e8943a
```

### Typography & Spacing
- UI: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- Mono: `'SF Mono', 'Fira Code', monospace`
- Sizes: 10 / 11 / 13 / 14 / 16px
- Spacing: `4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48px`

### Logo Files
```
src/assets/logo/frame-mark.svg              mark only, transparent bg
src/assets/logo/frame-mark-contained.svg   mark + #1a1a1a rounded square
src/assets/logo/frame-wordmark-dark.svg    mark + "FRAME" on dark
src/assets/logo/frame-wordmark-light.svg   mark + "FRAME" on light
build/icons/icon.icns                       macOS dock
build/icons/icon.ico                        Windows
```

---

## Delete Behavior — Option A

**The rule:** Marking a file "deleted" ONLY updates `files.status = 'deleted'` in SQLite. File stays on disk untouched.

**Un-deleting:** Instant — `file:updateStatus(fileId, 'kept')`, no file move needed.

**Filesystem cleanup — two explicit moments only:**
1. **"Clean up deleted files" button** in Sorter toolbar — visible when `status = 'deleted' AND trashed_at IS NULL`. Shows disk space. Moves to `.frame-trash`.
2. **Session Complete screen** — same offer after pipeline is done.

**Permanent deletion** always requires a separate "Empty Trash" step after moving to `.frame-trash`.

**Disk space:** Sum `size_bytes` for all `status = 'deleted'` files. Format as GB (≥1000 MB) or MB, one decimal.

---

## Sequence Detection Algorithm

Single-pass `sequence:detectGroups` returns `{ panoramas, bursts, ambiguous }`.

### Fast-reject for panorama:
- Inter-frame gap < 1.5s · Median shutter > 1/500s · Frame count > 20

### Fast-reject for burst:
- Median gap > 2.0s · Frame count > 60

### Classification:
```
pano rejected, burst not  → 'panorama'
burst rejected, pano not  → 'burst'
neither rejected          → compare scores → 'ambiguous-pano' or 'ambiguous-burst'
both rejected             → 'unclassified' (skip)
```

**Why lacrosse bursts don't become panoramas:** 3fps = 333ms gaps, shutter 1/500–1/1000s. Both fast-reject criteria fire immediately.

---

## Export / Import / Backup

Three related but distinct features covered by prompts E1 and E2.

| Feature | Purpose | Frequency | Scope | Initiated by |
|---|---|---|---|---|
| **Export/Import** | Move library between machines | Rare | Whole library, portable | User explicitly |
| **Auto-backup** | Protect against loss or mistakes | Every launch | Database only, local | Automatic |
| **Snapshots** | Experiment with rollback | Per-session | One session DB state | User explicitly |

Snapshots deferred — see [Future Features](#future-features).

### `.framelib` format
A ZIP archive containing:
```
manifest.json      version, date, hostname, photo root paths, counts
frame.db           complete SQLite database
thumbcache/        all thumbnails (optional)
settings.json      electron-store config
```

### `backupService.js` — shared utility
Lives at `electron/services/backupService.js`. Used by both E1 and E2.
Functions: `createBackup(label?)` · `listBackups()` · `pruneBackups(n)` · `restoreBackup(path)` · `validateDb(path)`

Backup filename format: `frame-YYYY-MM-DD-HHmm.db`
Labeled backups: `frame-pre-import-YYYY-MM-DD-HHmm.db`, `frame-pre-restore-…`

### Import path remapping
For each `photoRoot` in manifest that doesn't resolve on current machine:
- Show folder picker: `[old path] → [pick new location]`
- "Skip" option for paths that no longer exist
- Applied as: `UPDATE files SET full_path = newRoot || SUBSTR(full_path, LENGTH(oldRoot) + 1) WHERE full_path LIKE oldRoot || '%'`
- Also applied to: `pano_sets.output_path`, `burst_sets.output_path`, `burst_sets.composite_path`

### Auto-backup behavior
- Runs on every app launch, silently
- Skips if backup already exists for today (YYYY-MM-DD match)
- Skips on first launch (no db yet)
- Never prevents app startup if it fails
- Keeps last 7 regular backups, auto-prunes older
- Labeled backups (pre-import, pre-restore) not counted in the 7

### Key IPC channels
```
library:export(options)           → { success, outputPath, sizeBytes }
library:getManifest(filePath)     → { success, manifest }
library:import(filePath, maps)    → { success, sessionsImported, filesImported }
library:validateDb(dbPath)        → { valid, errors }
library:getExportSize(thumbs)     → { dbBytes, thumbBytes, totalBytes }
backup:create()                   → { success, backup }
backup:list()                     → [{ filename, path, sizeBytes, createdAt }]
backup:restore(backupPath)        → { success } then app.relaunch()
backup:delete(backupPath)         → { success }
backup:openFolder()               → shell.showItemInFolder
settings:set(key, value)          → { success }
settings:get(key, default)        → { value }
fs:pathExists(filePath)           → boolean
```

See full Claude Code prompts in [Claude Code Prompts — E1 and E2](#claude-code-prompts--e1-and-e2).

---

---

### Curator Notes + Journal — N1, N2, N3 ✅
| Prompt | Description |
|---|---|
| N1 | `MarkdownEditor.vue` shared component (view/edit/auto-save/auto-resize). `notes:updateSession` + `notes:updateGroup` IPC. `journal:read/write/getPath` IPC for `~/.frame/journal.md`. Session notes on Home cards. Group notes in Triage, PanoSetView, BurstSetView. |
| N2 | `JournalModule.vue` — full-screen Markdown writing environment, always-edit mode, Preview toggle, word count, "Open in editor" (shell.openPath), session context bar. Journal sidebar nav item + icon. |
| N3 | Obsidian vault export — Settings Integrations section (vault path, subfolder), `library:exportObsidian(scope)` IPC, session `.md` files with YAML frontmatter + event sections + stats table, `Frame Index.md` with wikilinks, auto-export on session complete toggle. |

**Storage:**
- Session notes: `sessions.notes` (column exists from Phase 6A)
- Group notes: `event_groups.notes` (column exists from Phase 6A)
- Global journal: `~/.frame/journal.md` (flat file, not SQLite)

**Export format:** `[vault]/Frame/Sessions/[Session Name].md` + `[vault]/Frame/Journal.md` + `[vault]/Frame/Frame Index.md`

---

## Future Features

Designed and understood — explicitly deferred.

### Film Strip Clip Fix ✅ *(v2.2 — merged PR [#22](https://github.com/muftring/frame/pull/22), closed issue [#17](https://github.com/muftring/frame/issues/17))*

Top film strip in the app icon bled past the rounded corner boundary in the upper-right. Fixed with a `<clipPath>` in the icon SVG that constrains all strip content to the rounded square boundary. The F sits outside the clip group and was unaffected. Also caught the same bug in `electron/splash.html`'s inline copy of the mark (not covered by the original fix description) and fixed it there too.

---

### Auto-Update Check ✅ *(v2.2 — merged PR [#23](https://github.com/muftring/frame/pull/23), closed issue [#18](https://github.com/muftring/frame/issues/18) "tier 1", shipped in v2.2.0)*

On launch, Frame silently fetches a `latest.json` from the repo, compares to `app.getVersion()`, and shows a toast if a newer version is available: *"Frame 2.2.0 is available — download."* One click opens the GitHub releases page. No auto-download (requires code signing — deferred to v3.0).

Fetches from `raw.githubusercontent.com/muftring/frame/master/latest.json` — note **`master`**, not `main`. This repo's default branch has always been `master` (the [GitHub Workflow](#github-workflow) section below said `main`; corrected there too).

`latest.json` format (as actually shipped in v2.2.0 — released Aug 27, a few days ahead of the Aug 31 milestone):
```json
{
  "version": "2.2.0",
  "releaseDate": "2026-08-27",
  "releaseNotes": "Film strip clip fix, auto-update check",
  "downloadUrl": "https://github.com/muftring/frame/releases/latest"
}
```

IPC channel: `app:checkForUpdates()` → `{ hasUpdate, latestVersion, downloadUrl }`
Shown as a dismissible toast, not a modal. Checks once per launch only.

---

### Print Lab Integration 🔨 *(v2.3 — due Sep 30, tracked in [#20](https://github.com/muftring/frame/issues/20) — all six prompts written, V2.3-A merged)*

Send keeper photos directly to a print lab from the Publish module.

**Recommended starting point: Mpix** — professional lab with a developer-friendly API, part of Miller's Lab group. Quality appropriate for a photography workflow app. *(Superseded by the API research below — Mpix turns out to have no public API. Bay Photo is the better starting point.)*

**Frame's approach:** consistent with the orchestrator philosophy — Frame handles selection and handoff, the lab handles fulfillment.

**Feature scope:**
- New "Send to print lab" section in Publish module alongside ArchiVault + iCloud
- Select keeper photos, choose lab, select print sizes
- Frame warns if a photo's resolution is insufficient for the requested print size (calculated from EXIF megapixels and aspect ratio)
- For labs with APIs (Mpix): full order creation in Frame — sizes, quantities, paper type, submit
- For labs without APIs: Frame opens vendor upload page and stages files in a folder for manual upload

**Labs to evaluate:** Mpix · Shutterfly · Bay Photo · WHCC · Artifact Uprising · CVS · Walgreens

#### API research findings (2026-08-27)

**Mpix** ([#25](https://github.com/muftring/frame/issues/25))**:** No public developer API available. Integration only possible through platforms like ShootProof or Pixieset that have partnership relationships with Mpix. Direct Frame integration not feasible without a formal partnership. Note: Mpix prints RGB files only — CMYK/grayscale files are rejected (relevant for the resolution warning system).

**Bay Photo** ([#26](https://github.com/muftring/frame/issues/26))**:** API exists with token-based authentication. API access requires a professional account and approval — not self-serve. Bay Photo has a dedicated "Sports and Events Plus" product well-suited to lacrosse photography. Order Desk's integration confirms the API uses an access token provided by Bay Photo directly.

**Shutterfly** ([#27](https://github.com/muftring/frame/issues/27)) is tracked as lower priority.

**Recommended v2.3 scope (Option B — Hybrid approach):**
1. Resolution warning system ([#28](https://github.com/muftring/frame/issues/28)) — build first, no API needed, immediately useful
2. "Prepare print order" workflow — Frame selects photos, prompts for sizes, packages files into an organized folder, opens the vendor's upload page. Manual final step, but Frame does all the prep work.
3. Bay Photo API — add when credentials are secured, as an enhancement to the manual flow.

**Action needed:** Create a Bay Photo professional account and request API access — may take 1-2 weeks for approval. Build the resolution warning system and manual workflow first while waiting.

**Stage for Upload** ([#29](https://github.com/muftring/frame/issues/29)) is a separate top-level GitHub issue — not part of print lab integration. Applies to TeamSnap, Sprocket Sports, and any future destination without an API.

The six prompts below (V2.3-A through V2.3-F) are the detailed breakdown of this hybrid-approach scope, one section per shippable unit — same pattern as Film Strip Clip Fix and Auto-Update Check above.

---

### Print Compatibility Warning System — V2.3-A 🔨 *(built and merged — PR [#35](https://github.com/muftring/frame/pull/35), issue [#28](https://github.com/muftring/frame/issues/28) — not yet tagged)*

| Prompt | Description |
|---|---|
| V2.3-A | `printCompatibility.js` service — resolution check (DPI at target size), aspect ratio check (crop percent + severity), combined check, matching sizes finder. `print:checkCompatibility`, `print:getSizesForPhoto`, `print:getSizes` IPC channels. `PrintCompatibilityBadge.vue` and `PrintSizeSelector.vue` reusable components. Crop assist: `editor:openWithAspectRatio` opens Edit module with ratio locked. `width` + `height` columns on files table. 19 unit tests, all passing. |

**Print size severity thresholds:**
| Crop % | Status | Treatment |
|---|---|---|
| < 2% | ok | No warning |
| 2–8% | minor | Small notice |
| 8–15% | warn | Clear warning + crop offer |
| > 15% | error | Strong warning + mandatory acknowledge |

**Standard print sizes covered:** 4×6 · 5×7 · 8×10 · 8×12 · 11×14 · 12×18 · 16×20 · 20×24 · 20×30 · 24×36 · 4×4 · 8×8 · 10×10 · 6×18 · 8×24 · 12×36 (panoramic)

**Key insight:** For D80 (3:2 sensor), perfect-fit sizes are 4×6, 8×12, 12×18, 20×30. The common 8×10 causes a ~17% crop (16.3% for the D80's real 1.494:1 sensor ratio, 16.7% for an exact 3:2) — Frame flags this as a significant mismatch (`error`, since it's above the 15% threshold).

**Resolution check, D80 (3872×2592) at standard sizes — every value below reverified directly against the shipped code:**

| Print size | Auto-rotated to | dpiW | dpiH | Limiting DPI | Status |
|---|---|---|---|---|---|
| 4×6 | 6×4 | 645 | 648 | 645 | ok |
| 8×10 | 10×8 | 387 | 324 | 324 | ok |
| 8×12 | 12×8 | 323 | 324 | 323 | ok |
| 16×20 | 20×16 | 194 | 162 | **162** | **error** |
| 20×30 | 30×20 | 129 | 130 | 129 | error |

The original prompt's verification checklist stated 16×20 as "warn, ~162 DPI" — the DPI figure was correct, but 162 is below the module's own `MIN_DPI_ACCEPTABLE` (200), so it's `error`, not `warn`. Caught and corrected during implementation; the algorithm and thresholds themselves needed no changes, only the checklist's illustrative status label was wrong. Everything else in the original checklist — including the ~17% crop figure for 3:2 → 8×10 — held up exactly.

---

### Print Order Management — V2.3-B 📝 *(prompt written, not yet run · issue [#32](https://github.com/muftring/frame/issues/32))*

| Prompt | Description |
|---|---|
| V2.3-B | `print_orders` + `print_order_items` SQLite tables. Seven IPC channels: create, list (with filter), get, update, addItem (runs compat check), updateItem, removeItem, archive. `PrintOrderPanel.vue` in Publish module — list view with filter (Active/Archived/All), detail view with items table, status lifecycle, Markdown notes, action buttons. `AddToOrderPopover.vue` for Sorter (O key) and Gallery (context menu + toolbar). |

**Print order status lifecycle:**
```
preparing → ready → ordered → delivered → archived
```

**IPC channels:**
```
printOrder:create(sessionId, name)
printOrder:list(filter, sessionId?)
printOrder:get(orderId)
printOrder:update(orderId, fields)
printOrder:addItem(orderId, fileId, width, height, qty)
printOrder:updateItem(itemId, fields)
printOrder:removeItem(itemId)
printOrder:archive(orderId)
```

**Three entry points for "Add to print order":**
1. Sorter — keyboard shortcut **O**, action button
2. Gallery — right-click context menu, image viewer toolbar
3. Print Order panel — bulk add from keeper photos

---

### Prepare Print Folder — V2.3-C 📝 *(prompt written, not yet run · issue [#33](https://github.com/muftring/frame/issues/33), sub of #32)*

| Prompt | Description |
|---|---|
| V2.3-C | `printOrder:prepareFolder(orderId)` — exports print-ready files to `~/Pictures/Frame Print Orders/[Order Name]/`. Full-resolution JPEG (quality 95, 4:4:4 chroma). Uses cropped file if `crop_applied = true`, otherwise original. Streams progress events. Auto-advances order status to 'ready'. RAW file handling: finds processed JPEG alongside original (Darktable export pattern), skips with clear error if not found. Filename collision resolution. `printOrder:revealFolder` opens folder in Finder. |

**Output filename format:** `[original-name]_[W]x[H][_cropped].jpg` — example: `photo_0342_8x10_cropped.jpg`

**Staged folder location:** `~/Pictures/Frame Print Orders/[Order Name]/`

---

### Print Order Manifest Export — V2.3-D 📝 *(prompt written, not yet run · issue [#34](https://github.com/muftring/frame/issues/34), sub of #32)*

| Prompt | Description |
|---|---|
| V2.3-D | `printOrder:exportManifest(orderId, format, outputPath)` — exports Markdown (.md) or PDF. Markdown: table with checkboxes per item (filename, size, qty, status), order notes, totals. PDF: rendered via Electron's built-in `printToPDF` through an offscreen BrowserWindow — no additional library. Inline result with "Open ↗" after export. Optional: in-panel Markdown preview before export. |

**Manifest format:**
```markdown
# Print Order — [Name]
**Lab:** [lab]  ·  **Order #:** [num]  ·  **Total:** [amt]
**Folder:** ~/Pictures/Frame Print Orders/[Name]/

| ☐ | # | File | Size | Qty | Status |
|---|---|---|---|---|---|
| ☐ | 1 | photo_0342_8x10_cropped.jpg | 8×10 | 1 | ✓ Cropped |
| ☐ | 2 | photo_0187.jpg | 4×6 | 6 | ✓ Ready |

**Total prints: 7**

## Order notes
[Markdown notes from Frame]
```

---

### Stage for Upload — V2.3-E 📝 *(prompt written, not yet run · issue [#29](https://github.com/muftring/frame/issues/29))*

| Prompt | Description |
|---|---|
| V2.3-E | `uploadStagingService.js` with four export presets. `upload:stageFiles`, `upload:createFolder`, `upload:revealFolder`, `upload:getStagingRoot`, `upload:getPresets` IPC channels. `UploadStagingPanel.vue` in Publish module. Gallery multi-select → "Stage for upload" passes fileIds to panel. Settings: configurable staging root folder. RAW handling same pattern as V2.3-C. |

**Export presets:**
| Preset | Max dimension | Quality | Use case |
|---|---|---|---|
| Web optimized | 2000px | 82% | Most team sites |
| Social / mobile | 1200px | 80% | Phone viewing |
| Full resolution | None | 92% | High-quality archives |
| TeamSnap | 2048px | 85% | TeamSnap uploads |

**Staged folder location:** `~/Pictures/Frame Uploads/[Folder Name]/` (configurable in Settings)

**Distinct from Prepare Print Folder:** print folder = full resolution, print-optimized JPEG. Stage for upload = web-optimized, smaller file size, for team site sharing. Different audiences, different needs.

---

### Bay Photo API Integration — V2.3-F 📝 *(prompt written, not yet run · issue [#26](https://github.com/muftring/frame/issues/26), sub of #20 · prerequisite: Bay Photo professional account + API token)*

| Prompt | Description |
|---|---|
| V2.3-F | `bayPhotoService.js` — token-based auth, `request()` via Electron `net` module, `getProducts()`, `createOrder()`, `getOrderStatus()`, `uploadImage()` placeholder. `bayPhotoProducts.js` — product map (size+finish → product ID) and finish options. IPC channels: validateToken, syncProducts, getProducts, submitOrder, getOrderStatus. Settings Integrations section: token input (masked), validate indicator, product sync, product mapping table, default finish. `[Submit to Bay Photo]` button in PrintOrderPanel detail view with confirmation modal. Mock mode via `BAY_PHOTO_MOCK=true` env var for development without credentials. |

**Print order submission flow:**
```
Configure token → Sync products → Prepare folder (V2.3-C)
→ Submit to Bay Photo → Order number stored → Check status
```

**Two unknowns to confirm with Bay Photo when credentials arrive:**
1. Actual API base URL (placeholder: `api.bayphoto.com/v1`)
2. Image upload mechanism (multipart? URL reference?)

**Mock mode:** full UI flow testable without credentials. Enable with `BAY_PHOTO_MOCK=true` in dev script.

**IPC channels:**
```
bayPhoto:validateToken()
bayPhoto:syncProducts()
bayPhoto:getProducts()
bayPhoto:submitOrder(orderId, finish)
bayPhoto:getOrderStatus(bayOrderId)
```

---

### Snapshots 💭 *(v3.0 — due Oct 31)*
Named point-in-time capture of a single session's DB state. Lets you experiment with rollback.

**Why deferred:** Option A delete (instant un-delete) covers the common case. Auto-backup covers corruption. Snapshot UI complexity not justified until real users request it.

**When to revisit:** Users frustrated by inability to undo bulk operations.

**Rough design:** `session_snapshots` table · "Take snapshot" button in Sorter · Snapshot browser · Restore re-applies file status values (not full DB restore) · Max 5 per session.

---

### Relative Paths 💭 *(v3.0 — due Oct 31)*
Store `full_path` relative to a library root instead of absolute. Eliminates Mac migration path remapping permanently. Requires schema change. Supersedes E1 path remapping once implemented.

---

### Theme System 💭 *(v3.0 — due Oct 31)*
Three themes: **Dark Gold** (current) · **Light Editorial** (#F7F4F0 + #C4522A) · **Bold Violet** (#16111F + #E8943A)

Implementation: CSS custom property swap on `:root`. All colors already in tokens.css as variables — theme is one variable set swap.

---

### In-App Help System 💭 *(v3.0 — due Oct 31)*
Deferred until user base established. Interim: PDF quick-start + keyboard reference + website docs.

---



### Code Signing & Notarization 💭 *(v3.0 — due Oct 31)*

**The problem:** Without code signing and notarization, macOS shows "Frame is damaged and can't be opened" when launching a downloaded build. The `xattr -cr /Applications/Frame.app` workaround works for personal use but is not viable for sharing with others.

**Requirements:**
- Apple Developer account ($99/year)
- Developer ID Application certificate (for distribution outside Mac App Store)
- Hardened Runtime entitlements
- Apple notarization (automated scan, issues a ticket macOS checks on launch)

**electron-builder config additions:**
```json
"mac": {
  "hardenedRuntime": true,
  "gatekeeperAssess": false,
  "entitlements": "build/entitlements.mac.plist",
  "entitlementsInherit": "build/entitlements.mac.plist",
  "notarize": { "teamId": "YOUR_TEAM_ID" }
}
```

**entitlements.mac.plist** — minimum required for Electron:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key><true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>
  <key>com.apple.security.cs.disable-library-validation</key><true/>
</dict>
</plist>
```

**Interim workaround (personal use only):**
```bash
xattr -cr /Applications/Frame.app
```

**When to prioritize:** Before sharing Frame with any other users. The `xattr` workaround is reasonable for a solo developer but not acceptable for distribution.

---

### iCloud Photos Integration 💭 *(v3.0 — due Oct 31)*

**The insight:** Frame's curation workflow applies equally well to an existing iCloud Photos library as it does to an SD card. 40,000+ photos with no curation is the same problem at a larger scale.

**The design question — answered:**
> **Replace originals and permanently delete non-keepers.**
> Rationale: 40,000+ photos is unusable because of signal-to-noise, not storage.
> No one browses a collection that large. A curated library of 8,000 meaningful
> photos is worth more than 40,000 that never get looked at. Curation has real
> value — in usability and in iCloud storage costs.

**Deletion UX must be unambiguous (not scary, just clear):**
> "87 photos will be permanently deleted from iCloud Photos and all your devices
> after 30 days. This cannot be undone. Proceed?"
> iCloud's 30-day Recently Deleted window is the safety net — Frame doesn't need
> to add another one on top of it.

**Three possible approaches (evaluated):**

| Approach | Method | Pros | Cons |
|---|---|---|---|
| A | Read `.photoslibrary` originals folder directly | Fast, no API, works offline | Undocumented, fragile, no metadata |
| B | macOS PhotoKit framework (Swift/ObjC bridge) | Official, stable, full metadata | Requires native code, complex |
| C | Export from Photos → Frame → re-import | Works today, zero new code | Manual, temporary file duplication |

**Decision: Approach B for v3.0.** PhotoKit is the only approach that gives full metadata, album structure, and stable access. Requires a small Swift helper that Electron spawns as a child process.

**Interim workflow (Approach C — works now):**
1. In Photos: select album/date range → File → Export → Export Originals → folder on disk
2. In Frame: run existing Triage → Sort → Edit → Process → Publish workflow
3. Frame publishes keepers back to Photos via existing AppleScript integration
4. In Photos: optionally delete non-keepers

**Chunking strategy:** 40k photos is too much at once. Natural chunks:
- By album (trips, events)
- By year or date range
- By "Recently Added" (process the last few months)
Each chunk = one Frame session. Session DB is the permanent curation record.

**v3.0 feature scope (when ready):**
- iCloud Photos source: browse library, select album/date range, copy to local working folder to begin session
- Metadata import: captions, favorites, existing album membership
- Publish back: keepers return to Photos with Frame tags/captions
- Album creation: "Frame — [Session Name] — Keepers" album in Photos
- Optional deletion of non-keepers from Photos (with strong confirmation — permanent)

**Native code bridge:** Electron N-API or child_process.spawn of a compiled Swift helper.
This is the primary complexity driver — first native code in Frame.

---

### Website 💭
Hugo + Netlify + GitHub. Content: documentation → blog → photo gallery.
Note: photo release forms required before publishing player photos.

---

## Blog / Paper Outline

**Title:** Frame: A Photo Workflow Studio, Built with Claude
**Subtitle:** A case study in domain-driven software development through human-AI collaboration
**Thesis:** The quality of the outcome was determined by the quality of the problem definition, not by the AI's capabilities.
**Audience:** General tech readers (primary) · photographers · developers
**Format:** Long-form narrative (~8,000 words) + companion prompt appendix (~8-10,000 words)

| Part | Title | ~Words |
|---|---|---|
| Abstract | — | 200 |
| 1 | The Problem | 1,300 |
| 2 | Before the Code: The Design Conversation | 2,300 |
| 3 | The Build | 3,700 |
| 4 | The Features | 2,300 |
| 5 | Reflections | 1,400 |
| Appendix | Complete prompt set with annotations | 8-10k |

**Featured prompts for Section 3.3:** 1A (scaffold) · 2A (file system) · 6A (session schema) · 9A revised (Option A delete) · 11B (sequence detection) · 13A (burst compare view) · Branding A (visual spec)

---

---

## GitHub Workflow

### Recommended GitHub features to adopt

**Issues — use for:**
- Bug reports (like the dock icon centering fix)
- Feature requests (curator notes, iCloud Photos, etc.)
- Each Claude Code prompt set could be one issue
  (e.g. "Implement Curator Notes — N1, N2, N3")
- Label system: `bug` `feature` `enhancement`
  `design` `claude-code` `v3.0` etc.

**Milestones — map to version numbers:**
- v2.2 — next planned release (whatever comes after v2.1)
- v3.0 — code signing, iCloud, themes, relative paths
- Assign issues to milestones to see release progress

**Projects (GitHub Projects board):**
- A simple Kanban: Backlog → In Design → In Progress → Done
- Cards map to issues
- Useful for seeing everything in flight at once
- Particularly helpful when juggling Claude Code sessions
  (you can see what phase you're in at a glance)

**Branches — current convention:**
- `master` — stable, released code (this repo's actual default branch —
  corrected here after V2.2-B's `latest.json` fetch URL was written
  against `main` and had to be fixed to match reality)
- `feature/[name]` — new features (e.g. `feature/notes`)
- `fix/[name]` — bug fixes (e.g. `fix/dock-icon-centering`)
- Each Claude Code prompt set → its own branch → PR → merge

**PR descriptions — suggested template:**
```
## What this does
[One paragraph summary]

## Claude Code prompts
[List which prompts were run: N1, N2, N3]

## Design notes
[Link to relevant section in FRAME_DESIGN_NOTES.md]

## Testing
- [ ] Verification checklist items from the prompt
- [ ] No regressions in [affected modules]
```

**Releases — use GitHub Releases:**
- **Before tagging:** update `latest.json` at the repo root (version,
  releaseDate, releaseNotes) and commit it to `master` on its own —
  `chore: bump latest.json to vX.X.X`. Frame's auto-update check
  (v2.2) fetches this file live from `master`, so it must be in place
  *before* anyone downloads the new release, or the app will notify
  users of a version that isn't actually downloadable yet.
- Tag each version (v2.0.0, v2.1.0, etc.)
- Attach the built .dmg as a release asset
- Write a short changelog in the release notes
- This gives you a permanent download history
  and makes sharing specific versions easy

**FRAME_DESIGN_NOTES.md as the bridge:**
The design notes live in the repo and serve as the
connection between the Claude.ai design conversation
and the GitHub issue/PR workflow. Reference the design
notes section in PRs; reference the GitHub issue number
in Claude Code sessions for traceability.

---

## Roadmap & GitHub Milestones

| Milestone | Due date | Features |
|---|---|---|
| **v2.2** ✅ | August 31, 2026 | Film strip clip fix ([#17](https://github.com/muftring/frame/issues/17)), auto-update check at launch — shipped Aug 27, 2026 |
| **v2.3** 🔨 | September 30, 2026 | Resolution + aspect ratio warnings ([#28](https://github.com/muftring/frame/issues/28), merged), Print Order management ([#32](https://github.com/muftring/frame/issues/32)), Prepare print folder ([#33](https://github.com/muftring/frame/issues/33)), Manifest export ([#34](https://github.com/muftring/frame/issues/34)), Stage for upload ([#29](https://github.com/muftring/frame/issues/29)), Bay Photo API ([#26](https://github.com/muftring/frame/issues/26), pending credentials) |
| **v3.0** | October 31, 2026 | Code signing + notarization, iCloud Photos, relative paths, theme system, snapshots, in-app help |

See [GitHub Issues](https://github.com/muftring/frame/issues) and [GitHub Milestones](https://github.com/muftring/frame/milestones) for full detail.

## GitHub Issues — v2.3

Titles below are the actual issue titles as filed (verified via `gh issue view`), not paraphrased. "Status" is the GitHub issue's open/closed state — a still-open issue can have fully-merged code behind it (see #28, merged via PR #35 but left open pending the v2.3.0 tag).

| Issue | Title | Type | Status |
|---|---|---|---|
| #20 | Print integration with vendors | Parent | Open |
| #25 | Mpix integration | Sub of #20 | Open (no public API — low priority) |
| #26 | V2.3-F — Bay Photo API Integration | Sub of #20 | Open (pending credentials) |
| #27 | Shutterfly integration (lower priority) | Sub of #20 | Open (low priority) |
| #28 | V2.3-A — Resolution + Aspect Ratio Warning System | Top-level | Open (merged via PR #35, not yet tagged) |
| #29 | V2.3-E — Stage for Upload | Top-level | Open |
| #32 | V2.3-B — Print Order Management | Top-level | Open |
| #33 | V2.3-C — Prepare print folder | Sub of #32 | Open |
| #34 | V2.3-D — Print Order Manifest export | Sub of #32 | Open |

## Version History

| Version | What shipped | Status |
|---|---|---|
| v1.0.0 | Core pipeline: Triage, Sort, Edit, Process, Publish (ArchiVault + iCloud) | ✅ Shipped |
| v1.1.0 | Session model, Smart Albums, Metadata panel, Pipeline integration | ✅ Shipped |
| v1.2.0 | B&W candidate tagging and preview workflow | ✅ Shipped |
| v1.3.0 | Unified sequence detection schema and algorithm | ✅ Shipped |
| v1.4.0 | Panorama UI: Sorter, Gallery, Hugin handoff | ✅ Shipped |
| v1.5.0 | Burst UI: compare view, Gallery, composite + Settings | ✅ Shipped |
| v2.0.0 | Branding A+B + Export/Import + Auto-Backup + Design Notes | ✅ Shipped |
| v2.1.0 | Curator Notes (session/group/journal) + Obsidian export + dock icon F centering fix | ✅ Shipped |
| v2.2.0 | Film strip clip fix (PR #22), auto-update check (PR #23), latest.json date fix (PR #24) | ✅ Shipped |
| v2.3 | Resolution + aspect ratio warnings (V2.3-A, PR #35 merged), Print Order management, prepare print folder, manifest export, stage for upload, Bay Photo API | 🔨 In progress (due Sep 30) |
| v3.0 | Code signing + notarization, iCloud Photos, relative paths, themes, snapshots, in-app help | 💭 Planned (due Oct 31) |

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
  await ensureBackupsDir()
  const now  = new Date()
  const date = now.toISOString().slice(0, 10)
  const time = now.toTimeString().slice(0, 5).replace(':', '')
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
    backups.push({ filename: f, path: fp,
      sizeBytes: stat.size, createdAt: stat.birthtime.toISOString() })
  }
  return backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

async function pruneBackups(keepCount = 7) {
  const all = await listBackups()
  const regular = all.filter(b =>
    /^frame-\d{4}-\d{2}-\d{2}-\d{4}\.db$/.test(b.filename))
  const toDelete = regular.slice(keepCount)
  for (const b of toDelete) await fs.unlink(b.path).catch(() => {})
}

async function restoreBackup(backupPath) {
  await createBackup('pre-restore')
  await fs.copyFile(backupPath, DB_PATH)
}

async function validateDb(dbPath) {
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
  restoreBackup, validateDb, DB_PATH, BACKUPS_DIR
}

Wire up IPC channels in main.js:
  backup:create()          → backupService.createBackup()
  backup:list()            → backupService.listBackups()
  backup:restore(path)     → backupService.restoreBackup(path)
                             then app.relaunch(); app.exit(0)
  backup:delete(path)      → fs.unlink(path)
  backup:openFolder()      → shell.showItemInFolder(BACKUPS_DIR)

═══════════════════════════════════════════════════════════
PART 2 — THE .framelib FORMAT
═══════════════════════════════════════════════════════════

Install: npm install archiver unzipper

ZIP structure:
  manifest.json  frame.db  thumbcache/ (optional)  settings.json

manifest.json schema:
  {
    "frameVersion": "2.0.0",
    "exportDate": "2026-07-17T08:34:00.000Z",
    "hostname": "Michaels-MacBook-Pro",
    "platform": "darwin",
    "photoRoots": ["/Volumes/LacrosseDrive/2026", "/Users/michael/Pictures"],
    "sessionCount": 12,
    "fileCount": 4231,
    "includedThumbs": false,
    "thumbCount": 0
  }

photoRoots: extract unique top-level directory components from
all full_path values in files table. Group by common prefix.

═══════════════════════════════════════════════════════════
PART 3 — EXPORT IPC CHANNEL
═══════════════════════════════════════════════════════════

library:export(options)   options: { outputPath, includeThumbs }

1. validateDb(DB_PATH) — return error if fails
2. Build manifest: query session/file counts, extract photo roots
3. Read electron-store config file (~/Library/Application Support/frame/config.json)
4. Create ZIP with archiver, stream progress via ipcMain.emit('library:exportProgress')
5. Return { success, outputPath, sizeBytes }

library:getExportSize(includeThumbs)
  → { dbBytes, thumbBytes, totalBytes }

═══════════════════════════════════════════════════════════
PART 4 — IMPORT IPC CHANNELS
═══════════════════════════════════════════════════════════

library:getManifest(filePath)
  Read manifest.json from zip without full extract (unzipper single entry).
  → { success, manifest }

library:import(filePath, pathMappings)
  pathMappings: [{ oldRoot, newRoot }]

  1. Validate zip (manifest exists, frame.db exists)
  2. createBackup('pre-import') — ALWAYS, before any changes
  3. Extract to tmpDir (os.tmpdir() + '/frame-import-' + Date.now())
  4. validateDb(tmpDir/frame.db) — return error + cleanup if fails
  5. Apply path remappings to extracted db:
       UPDATE files SET full_path = newRoot || SUBSTR(full_path, LENGTH(oldRoot)+1)
       WHERE full_path LIKE oldRoot || '%'
     Also update: pano_sets.output_path, pano_sets.hugin_project,
       burst_sets.output_path, burst_sets.composite_path
  6. Copy extracted db over DB_PATH
  7. Copy thumbcache if present (force: false — don't overwrite existing)
  8. Merge settings.json into electron-store (preserve window bounds, last-used session)
  9. Cleanup tmpDir
  10. Return { success, sessionsImported, filesImported, thumbsImported }

Also add: fs:pathExists(filePath) → boolean

═══════════════════════════════════════════════════════════
PART 5 — EXPORT PANEL UI
═══════════════════════════════════════════════════════════

Create src/modules/Settings/ExportPanel.vue

Add to SettingsPanel.vue as new "Library" section above Thumbnail Cache.

Contents:
  Header: "Export Frame Library"
  Description: "Create a portable backup of your sessions, metadata,
    and settings. Use this to move Frame to a new Mac or share your library."
  Toggle: "Include thumbnail cache" (default OFF)
    Helper text with live size estimate from library:getExportSize()
  Button: "Export library…"
    → showSaveDialog({ defaultPath: 'Frame_Export_YYYY-MM-DD.framelib',
                       filters: [{ name: 'Frame Library', extensions: ['framelib'] }] })
    → show progress overlay (spinner + "Exporting… X files")
    → on complete: show file path (clickable → Finder) + size + Done button
  Warn box if DB integrity check fails on panel open.

═══════════════════════════════════════════════════════════
PART 6 — IMPORT PANEL UI (5-step modal)
═══════════════════════════════════════════════════════════

Create src/modules/Settings/ImportPanel.vue

Add to Settings Library section below Export.

Button: "Import library…" → opens 5-step modal

Step 1 — Select file (file dialog, .framelib filter)
  → library:getManifest → advance to step 2 or show error

Step 2 — Summary
  "N sessions · M photos · exported [date] · from [hostname]"
  Warning: "Importing will replace your current library. A backup will be created first."
  [Back] [Continue →]

Step 3 — Path remapping (skip if all roots exist locally)
  For each photoRoot in manifest:
    fs:pathExists → ✓ green "Found" OR ⚠ amber + folder picker + "Skip" link
  [Back] [Continue →] (disabled until all missing roots mapped or skipped)

Step 4 — Confirmation
  ✓ N sessions, M photos · ✓ thumbnails (if included) · ✓ Settings
  ✓ Current library will be backed up first · ⚠ any skipped roots
  [Back] [Import and restart]

Step 5 — Progress (checklist, each item ○ → ✓)
  Creating backup · Extracting archive · Validating database
  Applying path remappings · Copying files · Updating settings
  On success: "Import complete! Frame will restart now." → app.relaunch()
  On error: error message + "Your original library has been preserved." [Close]

═══════════════════════════════════════════════════════════
PART 7 — FILE ASSOCIATION
═══════════════════════════════════════════════════════════

electron-builder package.json:
  "fileAssociations": [{
    "ext": "framelib", "name": "Frame Library",
    "description": "Frame Photo Workflow Library",
    "icon": "build/icons/icon", "role": "Editor"
  }]

electron/main.js:
  app.on('open-file', (event, filePath) => {
    event.preventDefault()
    if (filePath.endsWith('.framelib')) global.pendingImportPath = filePath
  })
  // After ready-to-show: send 'library:triggerImport' to renderer

App.vue: listen for 'library:triggerImport', navigate to Settings, call openImport(filePath)
preload.js: expose 'library:triggerImport' listener

═══════════════════════════════════════════════════════════
VERIFICATION CHECKLIST — E1
═══════════════════════════════════════════════════════════

□ backupService.js created, all backup: channels registered
□ library:export creates valid .framelib zip
□ manifest.json photoRoots correctly extracted
□ Export size estimate shown, updates on toggle
□ library:getManifest reads without full extract
□ Pre-import backup created BEFORE any changes
□ Path remapping updates full_path + pano/burst output paths
□ Extracted db passes integrity check before copy
□ Import modal 5 steps, back/forward navigation
□ Path remapping step skipped when all roots found
□ Skip option works — import proceeds with warning
□ App restarts after successful import
□ On error: original library intact (backup preserved)
□ Double-clicking .framelib opens Frame + import modal
□ No regressions in existing Settings sections
```

---

### Prompt E2 — Auto-Backup

```
Add automatic database backup to Frame.
Run after E1 — depends on backupService.js from E1 Part 1.

═══════════════════════════════════════════════════════════
PART 1 — LAUNCH-TIME BACKUP
═══════════════════════════════════════════════════════════

In electron/main.js startup (during splash "Initializing database" step):

  async function runAutoBackup() {
    const enabled = store.get('autoBackup.enabled', true)
    if (!enabled) return { skipped: true }

    const backups = await backupService.listBackups()
    const today   = new Date().toISOString().slice(0, 10)
    const regular = backups.filter(b =>
      /^frame-\d{4}-\d{2}-\d{2}-\d{4}\.db$/.test(b.filename))
    if (regular.some(b => b.filename.startsWith('frame-' + today)))
      return { skipped: true, reason: 'already backed up today' }

    const dbExists = await require('fs/promises')
      .access(backupService.DB_PATH).then(() => true).catch(() => false)
    if (!dbExists) return { skipped: true, reason: 'no database yet' }

    const backup = await backupService.createBackup()
    await backupService.pruneBackups(7)
    return { skipped: false, backup }
  }

Rules:
  - If backup fails: log error, DO NOT prevent app startup
  - If backup succeeds: silent (no UI notification)
  - Users see backups only in Settings panel

═══════════════════════════════════════════════════════════
PART 2 — SETTINGS PANEL — LIBRARY SECTION
═══════════════════════════════════════════════════════════

In SettingsPanel.vue Library section (created by E1),
add "Auto-backup" subsection BELOW Export/Import.

AUTO-BACKUP SUBSECTION:

  Toggle: "Back up database on launch" (default ON)
    Sublabel: "A copy of your session database is saved each time
    Frame starts. Keeps the last 7 days."
    On change: settings:set('autoBackup.enabled', value)

  Note (always visible, ⓘ icon):
    "Frame backs up your session database automatically.
     Your photo files are not included — back those up
     separately using Time Machine or your preferred backup solution."

RECENT BACKUPS:
  Header: "Recent backups" + right-aligned "Open folder ↗"
    → backup:openFolder()
  Load from backup:list() on mount. Refresh after restore/delete.

  Empty state: "No backups yet. Frame will create one on next launch."

  Each backup row:
    Left: formatted date ("Today, 8:34 AM" / "Yesterday, 9:12 AM" / "Jun 14, 10:05 AM")
          + filename in text-3 color
    Right: file size + [Restore] button + [Delete] button (danger-muted)

  Date format logic:
    diffDays = Math.floor((now - createdAt) / 86400000)
    0 → "Today, HH:MM" · 1 → "Yesterday, HH:MM" · else → "Mon DD, HH:MM"

  Size format: < 1MB → "X KB" · else → "X.X MB"

RESTORE FLOW:
  Modal: "Restore from backup?"
    "This will replace your current library with the backup from [date/time].
     Any changes made since then will be lost.
     Your current library will be saved as an additional backup before restoring."
  [Cancel] [Restore and restart]
  On confirm: backup:restore(backupPath) → "Restarting Frame…" → app.relaunch()
  On error: show error, library intact

DELETE FLOW (inline, no modal):
  Replace row buttons with: "Delete this backup?" [Yes, delete] [Cancel]
  On confirm: backup:delete(backupPath), remove row immediately (optimistic)
  On error: restore row, show toast

═══════════════════════════════════════════════════════════
PART 3 — SETTINGS IPC CHANNELS
═══════════════════════════════════════════════════════════

settings:set(key, value)  → store.set(key, value) → { success }
settings:get(key, default) → store.get(key, default) → { value }

If these already exist from Phase 4A, verify signature matches.

═══════════════════════════════════════════════════════════
VERIFICATION CHECKLIST — E2
═══════════════════════════════════════════════════════════

□ Auto-backup runs silently on launch
□ Skipped if backup exists for today
□ Skipped on first launch (no db)
□ App starts normally if backup fails
□ Backups in ~/.frame/backups/ with correct filenames
□ Only 7 regular backups kept (older pruned)
□ Settings panel: toggle, backup list, Open folder
□ Toggle persists across restarts
□ Date/time and file size formatted correctly
□ Restore: modal shown, pre-restore backup created, app restarts
□ Restore: on error, library intact
□ Delete: inline confirmation, optimistic UI update
□ Note about photo files visible
□ settings:set/get channels work
□ No regressions in E1 functionality
```

---

*This document is maintained alongside the Frame codebase.*
*Design conversation: Claude.ai · Build: Claude Code*
