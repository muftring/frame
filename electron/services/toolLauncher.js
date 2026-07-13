const { spawn } = require('child_process')
const fs = require('fs/promises')
const path = require('path')
const sharp = require('sharp')
const imageProcessor = require('./imageProcessor')

const TOOL_PATHS = {
  darwin: {
    darktable: [
      '/Applications/darktable.app/Contents/MacOS/darktable',
      '/usr/local/bin/darktable'
    ],
    rawtherapee: [
      '/Applications/RawTherapee.app/Contents/MacOS/rawtherapee',
      '/usr/local/bin/rawtherapee'
    ],
    hugin: [
      '/Applications/Hugin/Hugin.app/Contents/MacOS/Hugin',
      '/Applications/Hugin.app/Contents/MacOS/Hugin',
      '/usr/local/bin/hugin',
      '/opt/homebrew/bin/hugin'
    ],
    ffmpeg: [
      '/usr/local/bin/ffmpeg',
      '/opt/homebrew/bin/ffmpeg'
    ]
  },
  win32: {
    darktable: [
      'C:\\Program Files\\darktable\\bin\\darktable.exe'
    ],
    rawtherapee: [
      'C:\\Program Files\\RawTherapee\\rawtherapee.exe'
    ],
    hugin: [
      'C:\\Program Files\\Hugin\\bin\\hugin.exe',
      'C:\\Program Files (x86)\\Hugin\\bin\\hugin.exe'
    ],
    ffmpeg: [
      'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
      'C:\\ffmpeg\\bin\\ffmpeg.exe'
    ]
  }
}

// Common non-PATH install locations for Hugin's CLI companions, checked in
// addition to the directory the Hugin GUI binary itself was found in (macOS
// app bundles typically keep them alongside it in Contents/MacOS, though
// some package builds put them in Contents/Resources/bin instead).
const HUGIN_CLI_SEARCH_DIRS = {
  darwin: ['/usr/local/bin', '/opt/homebrew/bin'],
  win32: []
}

async function fileExists(p) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

async function findFirstPath(paths) {
  for (const p of paths) {
    if (await fileExists(p)) return p
  }
  return null
}

// nona/enblend/autooptimiser aren't standalone installs — they ship inside
// a Hugin installation — so we only look for them once we know where (or
// whether) Hugin itself lives, checked alongside it plus a couple of
// standard PATH locations Homebrew installs use.
async function findHuginCli(huginPath) {
  const platform = process.platform
  const exeSuffix = platform === 'win32' ? '.exe' : ''
  const searchDirs = [...(HUGIN_CLI_SEARCH_DIRS[platform] || [])]
  if (huginPath) searchDirs.unshift(path.dirname(huginPath))
  if (platform === 'darwin' && huginPath) {
    searchDirs.push(path.join(path.dirname(huginPath), '..', 'Resources', 'bin'))
    // Hugin's official Mac installer places Hugin.app, PTBatcherGUI.app, etc.
    // inside an "Hugin" folder alongside a tools_mac/ dir of symlinks back
    // into those bundles — nona/enblend live in PTBatcherGUI.app, not Hugin.app.
    searchDirs.push(path.join(path.dirname(huginPath), '..', '..', '..', 'tools_mac'))
  }

  const result = {}
  for (const name of ['nona', 'enblend', 'autooptimiser', 'cpfind']) {
    const candidates = searchDirs.map(dir => path.join(dir, name + exeSuffix))
    result[name] = await findFirstPath(candidates)
  }
  return result
}

async function findInstalled() {
  const platform = process.platform
  const paths = TOOL_PATHS[platform] || {}

  const hugin = paths.hugin ? await findFirstPath(paths.hugin) : null

  return {
    darktable: paths.darktable ? await findFirstPath(paths.darktable) : null,
    rawtherapee: paths.rawtherapee ? await findFirstPath(paths.rawtherapee) : null,
    hugin,
    huginCli: await findHuginCli(hugin),
    ffmpeg: paths.ffmpeg ? await findFirstPath(paths.ffmpeg) : null
  }
}

function checkFfmpegVersion(ffmpegPath) {
  return new Promise((resolve) => {
    try {
      const child = spawn(ffmpegPath, ['-version'], { stdio: ['ignore', 'pipe', 'pipe'] })
      let out = ''
      child.stdout.on('data', (d) => { out += d.toString() })
      child.on('error', (err) => resolve({ error: err.message }))
      child.on('close', () => {
        // First line looks like: "ffmpeg version 6.0 Copyright (c) ..."
        const match = out.match(/ffmpeg version (\S+)/)
        resolve(match ? { version: match[1] } : { error: 'Could not parse ffmpeg version' })
      })
    } catch (err) {
      resolve({ error: err.message })
    }
  })
}

function openFile(toolPath, filePath) {
  try {
    const child = spawn(toolPath, [filePath], {
      detached: true,
      stdio: 'ignore'
    })
    child.unref()
    return { success: true, pid: child.pid }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

function openFolder(toolPath, folderPath) {
  try {
    const isDarktable = path.basename(toolPath).toLowerCase().includes('darktable')
    const args = isDarktable ? ['--library', folderPath] : [folderPath]

    const child = spawn(toolPath, args, {
      detached: true,
      stdio: 'ignore'
    })
    child.unref()
    return { success: true, pid: child.pid }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

// Launches the tool with multiple files as separate arguments (e.g. opening
// several B&W candidates in Darktable's lighttable at once).
//
// styleName, if given, is appended as `--style <name>`. This is speculative:
// `--style` is documented for darktable-cli (the batch/headless exporter),
// not the interactive GUI binary launched here, so it may be silently
// ignored depending on the installed Darktable version. If the style isn't
// applied automatically, select the imported images in Darktable's
// lighttable and apply the style manually from the history stack / style
// manager.
function openFiles(toolPath, filePaths, styleName) {
  try {
    const args = [...filePaths]
    if (styleName) args.push('--style', styleName)

    const child = spawn(toolPath, args, {
      detached: true,
      stdio: 'ignore'
    })
    child.unref()
    return { success: true, pid: child.pid }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

function openHugin(huginPath, filePaths) {
  try {
    const child = spawn(huginPath, filePaths, { detached: true, stdio: 'ignore' })
    child.unref()
    return { success: true, pid: child.pid }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

// ─── Quick stitch (headless Hugin CLI pipeline) ──────────────────────────
//
// Generates a minimal Hugin .pto (Panorama Tools Optimizer) project file.
//
// .pto is a plain-text scripting format understood by Hugin's CLI tools
// (autooptimiser, nona, enblend, ...). Each non-comment line starts with a
// single letter naming its line type; the rest of the line is a run of
// whitespace-separated key/value tokens with NO space between a key letter
// and its value (e.g. `w4000`, not `w 4000`). Lines starting with `#` are
// comments, ignored by every Hugin tool.
//
// Line types used here:
//   p — panorama (output) line: projection code, output canvas size,
//       format, quality. Appears exactly once, before any image lines.
//   i — image line: one per source photo. Carries its pixel size, a
//       starting field-of-view guess, and a starting yaw/pitch/roll. These
//       starting values don't need to be accurate — autooptimiser (-a)
//       matches real control points between overlapping frames and solves
//       for the true geometry, but it needs *something* plausible to start
//       from, and needs yaw to increase roughly in shooting order so it
//       doesn't need to work out the frame ordering itself.
//   v — "variable to optimize" line: tells autooptimiser which per-image
//       parameters it's allowed to adjust. We list yaw for every image;
//       autooptimiser's own -a -m -l -s flags additionally solve other
//       parameters regardless of what's listed here, so this is a
//       deliberately small starter set, not the full optimization plan.
async function writePtoFile(inputFiles, ptoPath, { projection, outputWidth }) {
  const lines = []
  lines.push('# hugin project file generated by Frame — quick stitch')
  lines.push('# see writePtoFile() in electron/services/toolLauncher.js for a line-by-line explanation of this format')
  lines.push('#hugin_ptoversion 2')

  const proj = projection ?? 2
  const width = outputWidth || 4000
  // Canvas height is just a starting guess for the output frame — nona and
  // enblend crop the final blend to actual image content regardless.
  const height = Math.round(width / 2)
  lines.push(`p f${proj} w${width} h${height} v360 E0 R0 n"TIFF_m" q2 k0`)
  lines.push('')

  lines.push('# one line per input image (w/h = pixel size, v = initial field-of-view guess in degrees, y = starting yaw)')
  const dims = []
  for (const filePath of inputFiles) {
    const meta = await imageProcessor.getMetadata(filePath)
    dims.push({ width: meta.width || 4000, height: meta.height || 3000 })
  }
  inputFiles.forEach((filePath, i) => {
    const { width: w, height: h } = dims[i]
    // ~40 degrees/frame is a reasonable starting spread for an overlapping
    // handheld panorama sequence; autooptimiser corrects this from the
    // frames' actual overlap.
    const yaw = i * 40
    lines.push(`i w${w} h${h} f0 v50 r0 p0 y${yaw} TrX0 TrY0 TrZ0 j0 a0 b0 c0 d0 e0 g0 t0 Va1 Vb0 Vc0 Vd0 Vx0 Vy0 Vm5 n"${filePath}"`)
  })
  lines.push('')

  lines.push('# ask autooptimiser to solve yaw for every image')
  inputFiles.forEach((_, i) => lines.push(`v y${i}`))
  lines.push('')

  await fs.writeFile(ptoPath, lines.join('\n'), 'utf8')
}

// Tracks the currently-running quick-stitch child process so a separate
// tools:cancelQuickStitch IPC call (from a Cancel button) can kill it —
// runQuickStitch is one IPC round trip spanning three sequential child
// processes, so there's no other handle for the renderer to act on.
let currentStitchChild = null

function runStep(cliPath, args, cwd, sender, stepName) {
  return new Promise((resolve) => {
    try {
      const child = spawn(cliPath, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
      currentStitchChild = child
      let stderrBuf = ''

      child.stdout.on('data', (data) => {
        for (const line of data.toString().split('\n').filter(Boolean)) {
          sender?.send('tools:panoProgress', { step: stepName, line })
        }
      })
      child.stderr.on('data', (data) => {
        const text = data.toString()
        stderrBuf += text
        for (const line of text.split('\n').filter(Boolean)) {
          sender?.send('tools:panoProgress', { step: stepName, line })
        }
      })
      child.on('error', (err) => {
        currentStitchChild = null
        resolve({ success: false, error: err.message })
      })
      child.on('close', (code) => {
        currentStitchChild = null
        resolve(code === 0
          ? { success: true }
          : { success: false, error: stderrBuf.trim() || `${stepName} exited with code ${code}` })
      })
    } catch (err) {
      resolve({ success: false, error: err.message })
    }
  })
}

function cancelQuickStitch() {
  if (currentStitchChild) {
    currentStitchChild.kill()
    currentStitchChild = null
    return { success: true }
  }
  return { success: false, error: 'No stitch in progress' }
}

async function runQuickStitch(options, sender) {
  const {
    nonaPath, enblendPath, autooptimiserPath, cpfindPath,
    inputFiles, outputPath,
    projection = 2, quality = 92, outputWidth = null
  } = options

  const outputFolder = path.dirname(outputPath)
  const baseName = path.basename(outputPath, path.extname(outputPath))
  const ptoPath = path.join(outputFolder, `${baseName}_project.pto`)
  const cpFoundPtoPath = path.join(outputFolder, `${baseName}_cp.pto`)
  const optimisedPtoPath = path.join(outputFolder, `${baseName}_optimised.pto`)
  const framePrefix = path.join(outputFolder, 'frame_')
  const tifFiles = inputFiles.map((_, i) => `${framePrefix}${String(i).padStart(4, '0')}.tif`)

  try {
    sender?.send('tools:panoProgress', { step: 'pto', line: `Writing project file: ${ptoPath}` })
    await writePtoFile(inputFiles, ptoPath, { projection, outputWidth })

    // autooptimiser only solves the geometry for control points that already
    // exist in the .pto — it doesn't detect them. cpfind matches keypoints
    // between overlapping frames and writes the resulting control points
    // (`c` lines) into a new .pto, which is what autooptimiser actually optimises.
    const cpResult = await runStep(
      cpfindPath, ['-o', cpFoundPtoPath, ptoPath],
      outputFolder, sender, 'findpoints'
    )
    if (!cpResult.success) return { success: false, error: cpResult.error, step: 'findpoints' }

    const optResult = await runStep(
      autooptimiserPath, ['-a', '-m', '-l', '-s', '-o', optimisedPtoPath, cpFoundPtoPath],
      outputFolder, sender, 'optimise'
    )
    if (!optResult.success) return { success: false, error: optResult.error, step: 'optimise' }

    const nonaResult = await runStep(
      nonaPath, ['-m', 'TIFF_m', '-o', framePrefix, optimisedPtoPath],
      outputFolder, sender, 'remap'
    )
    if (!nonaResult.success) return { success: false, error: nonaResult.error, step: 'remap' }

    const enblendResult = await runStep(
      enblendPath, [`--compression=${quality}`, '-o', outputPath, ...tifFiles],
      outputFolder, sender, 'blend'
    )
    if (!enblendResult.success) return { success: false, error: enblendResult.error, step: 'blend' }

    for (const tif of tifFiles) await fs.unlink(tif).catch(() => {})
    await fs.unlink(ptoPath).catch(() => {})
    await fs.unlink(cpFoundPtoPath).catch(() => {})
    await fs.unlink(optimisedPtoPath).catch(() => {})

    return { success: true, outputPath }
  } catch (err) {
    return { success: false, error: err.message, step: 'unknown' }
  }
}

// ─── Burst composite ("Motion Super-Shot") ────────────────────────────────

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '')
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 26, g: 26, b: 26 }
}

// sharp's composite() blend option maps directly onto three of our four
// blend choices; "average" isn't a real Porter-Duff blend mode, so it's
// approximated with an 'add' blend after pre-scaling every frame's pixel
// values by 1/N — summing N frames each already divided by N converges on
// their mean instead of blowing out to white.
//   Lighten: output = max(pixel_A, pixel_B) per channel — bright subjects
//            (colored jerseys) show through against a darker background
//            (field, turf), which is why it's the default for lacrosse.
//   Screen:  output = 1 - (1-A)(1-B) — always brightens, more aggressive
//            than lighten.
const SHARP_BLEND_MODES = { lighten: 'lighten', screen: 'screen', multiply: 'multiply', average: 'add' }

async function preparedFrameBuffer(filePath, { targetW, targetH, preScale, scaleFactor }) {
  let img = sharp(filePath)
  if (preScale && targetW && targetH) img = img.resize(targetW, targetH, { fit: 'fill' })
  if (scaleFactor != null) img = img.linear(scaleFactor, 0)
  return img.toBuffer()
}

async function compositeMotionTrail(inputFiles, outputPath, { blendMode, quality, preScale }) {
  const sharpBlend = SHARP_BLEND_MODES[blendMode] || 'lighten'
  const scaleFactor = blendMode === 'average' ? 1 / inputFiles.length : null

  const baseMeta = await sharp(inputFiles[0]).metadata()
  const frameOpts = { targetW: baseMeta.width, targetH: baseMeta.height, preScale, scaleFactor }

  const baseBuf = await preparedFrameBuffer(inputFiles[0], frameOpts)
  const overlays = []
  for (let i = 1; i < inputFiles.length; i++) {
    overlays.push({ input: await preparedFrameBuffer(inputFiles[i], frameOpts), blend: sharpBlend })
  }

  const out = await sharp(baseBuf).composite(overlays).jpeg({ quality }).toBuffer()
  await fs.writeFile(outputPath, out)
}

async function compositeSequenceStrip(inputFiles, outputPath, { stripGap, stripBackground, stripLabels, stripLabelSize, stripLabelColor, quality }) {
  const metas = await Promise.all(inputFiles.map(f => sharp(f).metadata()))
  const targetH = Math.min(...metas.map(m => m.height))

  const resized = []
  const widths = []
  for (let i = 0; i < inputFiles.length; i++) {
    resized.push(await sharp(inputFiles[i]).resize({ height: targetH }).toBuffer())
    widths.push(Math.round(metas[i].width * (targetH / metas[i].height)))
  }

  const gap = stripGap || 0
  const totalWidth = widths.reduce((a, b) => a + b, 0) + gap * (inputFiles.length - 1)
  const labelColor = { white: '#ffffff', black: '#000000', accent: '#c9a84c' }[stripLabelColor] || '#ffffff'

  const composites = []
  let x = 0
  for (let i = 0; i < resized.length; i++) {
    composites.push({ input: resized[i], left: x, top: 0 })
    if (stripLabels) {
      const svg = `<svg width="${widths[i]}" height="${stripLabelSize + 10}">` +
        `<text x="4" y="${stripLabelSize}" font-size="${stripLabelSize}" fill="${labelColor}">${i + 1}</text></svg>`
      composites.push({ input: Buffer.from(svg), left: x, top: targetH - stripLabelSize - 10 })
    }
    x += widths[i] + gap
  }

  const out = await sharp({
    create: { width: totalWidth, height: targetH, channels: 3, background: hexToRgb(stripBackground) }
  }).composite(composites).jpeg({ quality }).toBuffer()
  await fs.writeFile(outputPath, out)
}

// Aligning a burst is the same control-point-then-optimize pipeline as
// panorama stitching (see writePtoFile above), except every frame starts
// at yaw 0 (they're nearly the same view, not a spread-out pano) and frame
// 0 is the alignment anchor — its yaw is deliberately left out of the `v`
// lines so autooptimiser holds it fixed and solves every other frame
// relative to it.
async function writeAlignmentPtoFile(inputFiles, ptoPath) {
  const lines = []
  lines.push('# hugin project file generated by Frame — burst alignment')
  lines.push('#hugin_ptoversion 2')

  const dims = []
  for (const filePath of inputFiles) {
    const meta = await imageProcessor.getMetadata(filePath)
    dims.push({ width: meta.width || 4000, height: meta.height || 3000 })
  }
  const { width: cw, height: ch } = dims[0]
  lines.push(`p f0 w${cw} h${ch} v50 E0 R0 n"TIFF_m" q2 k0`)
  lines.push('')

  inputFiles.forEach((filePath, i) => {
    const { width: w, height: h } = dims[i]
    lines.push(`i w${w} h${h} f0 v50 r0 p0 y0 TrX0 TrY0 TrZ0 j0 a0 b0 c0 d0 e0 g0 t0 Va1 Vb0 Vc0 Vd0 Vx0 Vy0 Vm5 n"${filePath}"`)
  })
  lines.push('')

  lines.push("# frame 0 is the alignment anchor; only later frames' yaw is solved")
  for (let i = 1; i < inputFiles.length; i++) lines.push(`v y${i}`)
  lines.push('')

  await fs.writeFile(ptoPath, lines.join('\n'), 'utf8')
}

async function runStabilizedComposite(inputFiles, outputPath, { stabilizedBlend, quality, huginPaths }, sender) {
  const outputFolder = path.dirname(outputPath)
  const baseName = path.basename(outputPath, path.extname(outputPath))
  const ptoPath = path.join(outputFolder, `${baseName}_align.pto`)
  const cpFoundPtoPath = path.join(outputFolder, `${baseName}_align_cp.pto`)
  const optimisedPtoPath = path.join(outputFolder, `${baseName}_align_optimised.pto`)
  const framePrefix = path.join(outputFolder, `${baseName}_aligned_`)
  const tifFiles = inputFiles.map((_, i) => `${framePrefix}${String(i).padStart(4, '0')}.tif`)

  sender?.send('tools:compositeProgress', { step: 'load', line: `Loading ${inputFiles.length} frames…` })
  await writeAlignmentPtoFile(inputFiles, ptoPath)

  sender?.send('tools:compositeProgress', { step: 'align', line: 'Finding control points…' })
  const cpResult = await runStep(huginPaths.cpfind, ['-o', cpFoundPtoPath, ptoPath], outputFolder, sender, 'align')
  if (!cpResult.success) return { success: false, error: cpResult.error, step: 'align' }

  // Burst frames come from nearly the same camera position (handheld
  // micro-motion, not a wide sweep), so unlike the panorama pipeline this
  // deliberately skips -s (auto-select output canvas/projection) and -m
  // (photometric optimisation) — -s lets the canvas balloon to fit
  // whatever rotation the optimiser solves, which for frames with little
  // real parallax can drift into a degenerate, distorted geometry instead
  // of the small corrective alignment we actually want.
  const optResult = await runStep(
    huginPaths.autooptimiser, ['-a', '-l', '-o', optimisedPtoPath, cpFoundPtoPath],
    outputFolder, sender, 'align'
  )
  if (!optResult.success) return { success: false, error: optResult.error, step: 'align' }

  const nonaResult = await runStep(
    huginPaths.nona, ['-m', 'TIFF_m', '-o', framePrefix, optimisedPtoPath],
    outputFolder, sender, 'align'
  )
  if (!nonaResult.success) return { success: false, error: nonaResult.error, step: 'align' }

  sender?.send('tools:compositeProgress', { step: 'blend', line: 'Blending aligned frames…' })
  try {
    if (stabilizedBlend === 'enblend' && huginPaths.enblend) {
      const enblendResult = await runStep(
        huginPaths.enblend, [`--compression=${quality}`, '-o', outputPath, ...tifFiles],
        outputFolder, sender, 'blend'
      )
      if (!enblendResult.success) return { success: false, error: enblendResult.error, step: 'blend' }
    } else {
      await compositeMotionTrail(tifFiles, outputPath, {
        blendMode: stabilizedBlend === 'average' ? 'average' : 'lighten',
        quality,
        preScale: false
      })
    }
  } catch (err) {
    return { success: false, error: err.message, step: 'blend' }
  }

  sender?.send('tools:compositeProgress', { step: 'save', line: 'Saved.' })

  for (const tif of tifFiles) await fs.unlink(tif).catch(() => {})
  await fs.unlink(ptoPath).catch(() => {})
  await fs.unlink(cpFoundPtoPath).catch(() => {})
  await fs.unlink(optimisedPtoPath).catch(() => {})

  return { success: true, outputPath }
}

async function createComposite(options, sender) {
  const {
    inputFiles, outputPath, mode, blendMode, quality,
    stripGap, stripBackground, stripLabels, stripLabelSize, stripLabelColor,
    stabilizedBlend, preScale, huginPaths = {}
  } = options

  try {
    if (mode === 'stabilized') {
      return await runStabilizedComposite(inputFiles, outputPath, { stabilizedBlend, quality, huginPaths }, sender)
    }

    sender?.send('tools:compositeProgress', { step: 'load', line: `Loading ${inputFiles.length} frames…` })
    if (mode === 'strip') {
      await compositeSequenceStrip(inputFiles, outputPath, { stripGap, stripBackground, stripLabels, stripLabelSize, stripLabelColor, quality })
    } else {
      await compositeMotionTrail(inputFiles, outputPath, { blendMode, quality, preScale })
    }
    return { success: true, outputPath }
  } catch (err) {
    return { success: false, error: err.message, step: 'blend' }
  }
}

function runBatchExport(toolPath, inputPaths, outputFolder, presetPath, sender) {
  return new Promise((resolve) => {
    try {
      const cliPath = toolPath.replace(/rawtherapee(\.exe)?$/i, 'rawtherapee-cli$1')
      const args = ['-o', outputFolder, '-p', presetPath, '-c', ...inputPaths]

      const child = spawn(cliPath, args, { stdio: ['ignore', 'pipe', 'pipe'] })

      child.stdout.on('data', (data) => {
        const lines = data.toString().split('\n').filter(Boolean)
        for (const line of lines) {
          sender.send('tools:batchProgress', line)
        }
      })

      child.stderr.on('data', (data) => {
        const lines = data.toString().split('\n').filter(Boolean)
        for (const line of lines) {
          sender.send('tools:batchProgress', line)
        }
      })

      child.on('error', (err) => {
        resolve({ success: false, error: err.message })
      })

      child.on('close', (code) => {
        resolve(code === 0
          ? { success: true }
          : { success: false, error: `Process exited with code ${code}` })
      })
    } catch (err) {
      resolve({ success: false, error: err.message })
    }
  })
}

module.exports = {
  findInstalled,
  checkFfmpegVersion,
  openFile,
  openFolder,
  openFiles,
  openHugin,
  runBatchExport,
  runQuickStitch,
  cancelQuickStitch,
  createComposite
}
