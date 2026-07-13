const sessionStore = require('./sessionStore')
const imageProcessor = require('./imageProcessor')

const DEFAULT_OPTIONS = {
  // Shared
  minFrames: 3,
  maxGapSeconds: 45,
  requireConsecutiveNames: true,

  // Panorama signals
  panoMaxShutterSpeed: 500,
  panoMaxFrames: 20,
  panoMinGapSeconds: 1.5,
  panoFocalTolerance: 5,

  // Burst signals
  burstMaxGapSeconds: 2.0,
  burstMinShutterSpeed: 250,
  burstMaxFrames: 60,
  burstMinFrames: 3,

  // Confidence thresholds
  highConfidenceThreshold: 80,
  mediumConfidenceThreshold: 50,

  // Advanced
  useHistogramComparison: false,
  histogramSimilarityMin: 0.7
}

// --- small pure helpers ---

// Trailing digit run right before the final extension, e.g.
// "DSC_0042.JPG" -> 42. Returns null if the filename doesn't end that way.
function numericSuffix(filename) {
  const m = filename.match(/(\d+)\.[^.]+$/)
  return m ? parseInt(m[1], 10) : null
}

function median(nums) {
  if (!nums.length) return null
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

// Converts an EXIF shutter-speed rational [num, den] to a "1/N" denominator
// (e.g. [1, 500] -> 500). Slower-than-1s exposures (e.g. a 2s exposure as
// [2, 1]) come out as a fraction below 1, which still orders correctly
// against fast shutters for min/max/median comparisons.
function shutterDenominator(rational) {
  if (!rational) return null
  const [num, den] = rational
  if (!num || !den) return null
  return den / num
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

// Pearson correlation between two equal-length probability distributions —
// used as the "normalized cross-correlation" luminance-histogram comparison.
// 1 = identical, -1 = inverted, 0 = uncorrelated.
function histogramSimilarity(a, b) {
  if (!a || !b) return null
  const n = a.length
  const meanA = a.reduce((s, v) => s + v, 0) / n
  const meanB = b.reduce((s, v) => s + v, 0) / n
  let num = 0, denA = 0, denB = 0
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA
    const db = b[i] - meanB
    num += da * db
    denA += da * da
    denB += db * db
  }
  if (denA === 0 || denB === 0) return 1
  return num / Math.sqrt(denA * denB)
}

// --- Step 1: load + enrich files ---

async function loadEnrichedFiles(sessionId) {
  const files = sessionStore.fileListBySession(sessionId, {})
  if (!Array.isArray(files) || !files.length) return []

  const metaBatch = await imageProcessor.getMetadataBatch(files.map(f => f.full_path))

  return files.map((f, i) => ({
    id: f.id,
    filename: f.filename,
    full_path: f.full_path,
    exif_ts: f.exif_ts,
    size_bytes: f.size_bytes,
    pano_set_id: f.pano_set_id,
    burst_set_id: f.burst_set_id,
    focalLength: metaBatch[i]?.focalLength ?? null,
    shutterSpeed: metaBatch[i]?.shutterSpeed ?? null,
    driveMode: metaBatch[i]?.driveMode ?? null
  }))
}

// --- Step 2: candidate runs ---

function buildRuns(files, options) {
  if (files.length < 2) return files.length ? [files] : []

  const runs = []
  let current = [files[0]]

  for (let i = 0; i < files.length - 1; i++) {
    const curr = files[i]
    const next = files[i + 1]
    const timeGapSeconds = (next.exif_ts - curr.exif_ts) / 1000

    const currSeq = numericSuffix(curr.filename)
    const nextSeq = numericSuffix(next.filename)
    const seqGap = (currSeq != null && nextSeq != null) ? nextSeq - currSeq : null

    const connected = timeGapSeconds <= options.maxGapSeconds &&
      (!options.requireConsecutiveNames || seqGap === 1)

    if (connected) {
      current.push(next)
    } else {
      runs.push(current)
      current = [next]
    }
  }
  runs.push(current)

  const minRunLength = Math.min(options.burstMinFrames, options.minFrames)
  return runs.filter(r => r.length >= minRunLength)
}

// --- Step 3: classify ---

function computeMetrics(run, options) {
  const gaps = []
  for (let i = 0; i < run.length - 1; i++) {
    gaps.push((run[i + 1].exif_ts - run[i].exif_ts) / 1000)
  }

  const shutters = run.map(f => shutterDenominator(f.shutterSpeed)).filter(s => s != null)
  const focalLengths = run.map(f => f.focalLength).filter(f => f != null)

  // Spec: "treat null focal lengths as matching" — with fewer than two
  // real readings there's nothing to disagree about.
  let focalLengthMatch = true
  if (focalLengths.length >= 2) {
    const spread = Math.max(...focalLengths) - Math.min(...focalLengths)
    focalLengthMatch = spread <= options.panoFocalTolerance
  }

  return {
    frameCount: run.length,
    minGapSeconds: gaps.length ? Math.min(...gaps) : 0,
    maxGapSeconds: gaps.length ? Math.max(...gaps) : 0,
    medianGapSeconds: gaps.length ? median(gaps) : 0,
    minShutter: shutters.length ? Math.min(...shutters) : null,
    maxShutter: shutters.length ? Math.max(...shutters) : null,
    medianShutter: shutters.length ? median(shutters) : null,
    focalLengthMatch,
    timeSpanSeconds: (run[run.length - 1].exif_ts - run[0].exif_ts) / 1000,
    alreadyPano: run.some(f => f.pano_set_id != null),
    alreadyBurst: run.some(f => f.burst_set_id != null)
  }
}

function confidenceLevel(score, options) {
  if (score >= options.highConfidenceThreshold) return 'high'
  if (score >= options.mediumConfidenceThreshold) return 'medium'
  return 'low'
}

// metrics.medianShutter is null when no run frame had readable shutter-speed
// EXIF. JS's null-to-0 numeric coercion would otherwise make e.g.
// `null < 250` silently true and penalize a run for evidence we don't
// actually have — every shutter-based check below explicitly guards for
// that instead of trusting the raw comparison.

function rejectPanoReasons(metrics, options) {
  const reasons = []
  if (metrics.minGapSeconds < options.panoMinGapSeconds) {
    reasons.push(`Frames too close: ${metrics.minGapSeconds.toFixed(2)}s minimum (need > ${options.panoMinGapSeconds}s)`)
  }
  if (metrics.medianShutter != null && metrics.medianShutter > options.panoMaxShutterSpeed) {
    reasons.push(`Fast shutter: 1/${metrics.medianShutter} suggests action shooting`)
  }
  if (metrics.frameCount > options.panoMaxFrames) {
    reasons.push(`Too many frames: ${metrics.frameCount} (panoramas rarely exceed ${options.panoMaxFrames})`)
  }
  return reasons
}

function rejectBurstReasons(metrics, options) {
  const reasons = []
  if (metrics.medianGapSeconds > options.burstMaxGapSeconds) {
    reasons.push(`Frames too far apart: ${metrics.medianGapSeconds.toFixed(1)}s median (bursts are typically < ${options.burstMaxGapSeconds}s)`)
  }
  if (metrics.frameCount > options.burstMaxFrames) {
    reasons.push(`Sequence unusually long: ${metrics.frameCount} frames`)
  }
  return reasons
}

function panoConfidenceScore(metrics, options) {
  let score = 100
  const flags = []

  if (metrics.minGapSeconds < 3) {
    score -= 15
    flags.push({ level: 'warn', msg: 'Some frames under 3s apart — verify not burst' })
  }
  if (metrics.medianShutter != null && metrics.medianShutter > 250 && metrics.medianShutter <= 500) {
    score -= 20
    flags.push({ level: 'warn', msg: `Shutter 1/${metrics.medianShutter} is fast for static scene` })
  }
  if (!metrics.focalLengthMatch) {
    score -= 25
    flags.push({ level: 'warn', msg: 'Focal length varies — may be separate scenes' })
  }
  if (metrics.frameCount > 12) {
    score -= 10
    flags.push({ level: 'info', msg: `${metrics.frameCount} frames is a long panorama — confirm all overlap` })
  }
  if (metrics.timeSpanSeconds < 5) {
    score -= 20
    flags.push({ level: 'warn', msg: 'Entire sequence under 5s — unusually fast for panorama' })
  }

  return { score, flags, level: confidenceLevel(score, options) }
}

function burstConfidenceScore(metrics, options) {
  let score = 100
  const flags = []

  if (metrics.medianShutter != null && metrics.medianShutter < options.burstMinShutterSpeed) {
    score -= 30
    flags.push({ level: 'warn', msg: `Slow shutter 1/${metrics.medianShutter} — unusual for sports burst` })
  }
  if (metrics.medianGapSeconds > 1.0) {
    score -= 20
    flags.push({ level: 'info', msg: `Gap of ${metrics.medianGapSeconds.toFixed(1)}s between frames — slower than typical burst` })
  }
  if (metrics.frameCount < 4) {
    score -= 15
    flags.push({ level: 'info', msg: 'Small group — may be intentional sequence, not burst' })
  }

  return { score, flags, level: confidenceLevel(score, options) }
}

function classify(rejectPano, rejectBurst, panoConfidence, burstConfidence) {
  const isPanoRejected = rejectPano.length > 0
  const isBurstRejected = rejectBurst.length > 0

  if (!isPanoRejected && isBurstRejected) return 'panorama'
  if (isPanoRejected && !isBurstRejected) return 'burst'
  if (!isPanoRejected && !isBurstRejected) {
    return panoConfidence.score >= burstConfidence.score ? 'ambiguous-pano' : 'ambiguous-burst'
  }
  return 'unclassified'
}

async function applyHistogramComparison(run, type, panoConfidence, burstConfidence, options) {
  if (!options.useHistogramComparison) return
  if (type !== 'burst' && type !== 'panorama') return

  const histograms = await Promise.all(run.map(f => imageProcessor.getLuminanceHistogram(f.full_path)))

  let minSimilarity = 1
  for (let i = 0; i < histograms.length - 1; i++) {
    const sim = histogramSimilarity(histograms[i], histograms[i + 1])
    if (sim != null && sim < minSimilarity) minSimilarity = sim
  }

  if (minSimilarity < options.histogramSimilarityMin) {
    if (type === 'burst') {
      burstConfidence.flags.push({ level: 'warn', msg: 'Scene content changes significantly between frames — may not be same subject' })
    } else {
      panoConfidence.flags.push({ level: 'warn', msg: 'Scene content very different between frames — check overlap' })
    }
  }
}

function suggestedName(type, run) {
  const first = run[0]
  if (type === 'panorama') {
    return `Panorama — ${formatDate(first.exif_ts)}  ${formatTime(first.exif_ts)}`
  }
  return `Burst — ${formatDate(first.exif_ts)}  ${formatTime(first.exif_ts)}  (${run.length} frames)`
}

function toPanoFiles(run) {
  return run.map((f, i) => ({ id: f.id, filename: f.filename, full_path: f.full_path, pano_frame_order: i }))
}

function toBurstFiles(run) {
  return run.map((f, i) => ({ id: f.id, filename: f.filename, full_path: f.full_path, burst_frame_order: i }))
}

async function detectGroups(sessionId, userOptions) {
  const options = { ...DEFAULT_OPTIONS, ...(userOptions || {}) }

  const files = await loadEnrichedFiles(sessionId)
  const runs = buildRuns(files, options)

  const panoramas = []
  const bursts = []
  const ambiguous = []
  let unclassifiedCount = 0
  let skippedExisting = 0

  for (const run of runs) {
    const metrics = computeMetrics(run, options)
    const rejectPano = rejectPanoReasons(metrics, options)
    const rejectBurst = rejectBurstReasons(metrics, options)
    const panoConfidence = panoConfidenceScore(metrics, options)
    const burstConfidence = burstConfidenceScore(metrics, options)

    const type = classify(rejectPano, rejectBurst, panoConfidence, burstConfidence)

    await applyHistogramComparison(run, type, panoConfidence, burstConfidence, options)

    if (type === 'panorama') {
      if (metrics.alreadyPano) skippedExisting++
      panoramas.push({
        type,
        suggestedName: suggestedName(type, run),
        files: toPanoFiles(run),
        metrics,
        confidence: panoConfidence,
        rejectReasons: [],
        alreadyExists: metrics.alreadyPano,
        defaultChecked: panoConfidence.level === 'high'
      })
    } else if (type === 'burst') {
      if (metrics.alreadyBurst) skippedExisting++
      bursts.push({
        type,
        suggestedName: suggestedName(type, run),
        files: toBurstFiles(run),
        metrics,
        confidence: burstConfidence,
        rejectReasons: [],
        alreadyExists: metrics.alreadyBurst,
        defaultChecked: burstConfidence.level === 'high'
      })
    } else if (type === 'ambiguous-pano' || type === 'ambiguous-burst') {
      const alreadyExists = type === 'ambiguous-pano' ? metrics.alreadyPano : metrics.alreadyBurst
      if (alreadyExists) skippedExisting++
      ambiguous.push({
        type,
        suggestedName: suggestedName(type === 'ambiguous-pano' ? 'panorama' : 'burst', run),
        files: type === 'ambiguous-pano' ? toPanoFiles(run) : toBurstFiles(run),
        metrics,
        panoConfidence,
        burstConfidence,
        rejectReasons: [],
        alreadyExists,
        defaultChecked: false
      })
    } else {
      unclassifiedCount++
    }
  }

  const summary = {
    filesScanned: files.length,
    runsFound: runs.length,
    panoramasFound: panoramas.length,
    burstsFound: bursts.length,
    ambiguousFound: ambiguous.length,
    skippedExisting,
    optionsUsed: options
  }

  sessionStore.sequenceDetectionRunCreate(sessionId, options, panoramas.length, bursts.length, ambiguous.length)

  return { panoramas, bursts, ambiguous, unclassified: unclassifiedCount, summary }
}

function getDetectionHistory(sessionId) {
  return sessionStore.sequenceDetectionRunList(sessionId)
}

module.exports = {
  detectGroups,
  getDetectionHistory
}
