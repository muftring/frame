const path = require('path')
const fs = require('fs/promises')
const sharp = require('sharp')

const UPLOAD_PRESETS = [
  {
    id: 'web',
    label: 'Web optimized',
    description: 'Good for most team sites and galleries',
    maxDimension: 2000,
    quality: 82
  },
  {
    id: 'social',
    label: 'Social / mobile',
    description: 'Smaller files, fast loading on phones',
    maxDimension: 1200,
    quality: 80
  },
  {
    id: 'full',
    label: 'Full resolution',
    description: 'Original size, compressed losslessly',
    maxDimension: null,
    quality: 92
  },
  {
    id: 'teamsnap',
    label: 'TeamSnap',
    description: 'Optimized for TeamSnap uploads',
    maxDimension: 2048,
    quality: 85
  }
]

// Same RAW-fallback convention as prepareFolder (V2.3-C) — sharp can't
// decode RAW sources, so fall back to a sibling JPEG/TIFF next to the
// original (the common Darktable/RawTherapee "export alongside" pattern).
const RAW_EXTENSIONS = new Set(['.nef', '.cr2', '.cr3', '.arw', '.orf', '.rw2', '.dng', '.raf', '.nrw'])

async function pathExists(filePath) {
  return fs.access(filePath).then(() => true).catch(() => false)
}

async function findProcessedVersion(rawPath) {
  const dir = path.dirname(rawPath)
  const base = path.basename(rawPath, path.extname(rawPath))
  for (const ext of ['.jpg', '.jpeg', '.tif', '.tiff', '.png']) {
    const candidate = path.join(dir, base + ext)
    if (await pathExists(candidate)) return candidate
  }
  return null
}

// Stages one or more files into destFolder under the given preset. Each
// file gets its own try/catch so one bad source (missing file, unreadable
// RAW) doesn't abort the rest of the batch. onProgress(current, total,
// filename), if given, fires after each file so the caller can stream a
// single IPC event per file without re-invoking stageFiles (and re-running
// fs.mkdir) per file.
//
// Collision handling is scoped to filenames written during this call only
// (usedNames), not to files already on disk — re-staging the same session
// to the same folder should refresh files in place, not pile up numbered
// duplicates each time (the same bug class caught and fixed in V2.3-C's
// prepareFolder). Two different source files that happen to share a base
// name (e.g. "IMG_0001.jpg" from two cameras) still get disambiguated
// within a single run.
async function stageFiles(files, destFolder, preset, onProgress) {
  await fs.mkdir(destFolder, { recursive: true })

  const results = []
  let successCount = 0
  let errorCount = 0
  const usedNames = new Set()

  for (const file of files) {
    try {
      const ext = path.extname(file.filename).toLowerCase()
      const base = path.basename(file.filename, ext)

      let sourcePath = file.full_path
      if (RAW_EXTENSIONS.has(ext)) {
        const processed = await findProcessedVersion(file.full_path)
        if (processed) {
          sourcePath = processed
        } else {
          results.push({ fileId: file.id, success: false, error: 'RAW file — process in Darktable first' })
          errorCount++
          if (onProgress) onProgress({ current: successCount + errorCount, total: files.length, filename: file.filename })
          continue
        }
      }

      let outName = `${base}.jpg`
      let counter = 2
      while (usedNames.has(outName)) {
        outName = `${base}_${counter}.jpg`
        counter++
      }
      usedNames.add(outName)
      const outPath = path.join(destFolder, outName)

      let pipeline = sharp(sourcePath)
      if (preset.maxDimension) {
        pipeline = pipeline.resize(preset.maxDimension, preset.maxDimension, {
          fit: 'inside',
          withoutEnlargement: true
        })
      }

      await pipeline
        .jpeg({ quality: preset.quality, chromaSubsampling: '4:2:0', mozjpeg: true })
        .toFile(outPath)

      results.push({ fileId: file.id, filename: outName, path: outPath, success: true })
      successCount++
    } catch (err) {
      results.push({ fileId: file.id, success: false, error: err.message })
      errorCount++
    }

    if (onProgress) onProgress({ current: successCount + errorCount, total: files.length, filename: file.filename })
  }

  return { successCount, errorCount, results, destFolder }
}

module.exports = {
  UPLOAD_PRESETS,
  stageFiles
}
