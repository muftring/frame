const fs = require('fs/promises')
const path = require('path')

const IMAGE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'tiff', 'tif', 'bmp',
  'heic', 'heif', 'nef', 'cr2', 'arw', 'orf', 'rw2', 'dng'
])

const TIFF_RAW_EXTENSIONS = new Set([
  'tiff', 'tif', 'nef', 'cr2', 'arw', 'orf', 'rw2', 'dng'
])

function getExtension(filename) {
  return path.extname(filename).toLowerCase().slice(1)
}

// --- EXIF helpers (pure Node.js, no dependencies) ---

function readU16(buf, off, le) {
  return le ? buf.readUInt16LE(off) : buf.readUInt16BE(off)
}

function readU32(buf, off, le) {
  return le ? buf.readUInt32LE(off) : buf.readUInt32BE(off)
}

function parseExifDate(str) {
  if (!str || str.length < 19) return null
  const m = str.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/)
  if (!m) return null
  const d = new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6])
  return isNaN(d.getTime()) ? null : d.toISOString()
}

function readIFDString(buf, tiffBase, tag, le) {
  if (tag.type !== 2 || tag.count < 1) return null
  let off
  if (tag.count <= 4) {
    off = tag.valueFieldOffset
  } else {
    off = tiffBase + tag.valueOffset
  }
  if (off + tag.count > buf.length) return null
  return buf.toString('ascii', off, off + tag.count - 1)
}

function parseIFD(buf, tiffBase, ifdOffset, le) {
  const abs = tiffBase + ifdOffset
  if (abs + 2 > buf.length) return {}
  const count = readU16(buf, abs, le)
  const tags = {}
  for (let i = 0; i < count; i++) {
    const e = abs + 2 + i * 12
    if (e + 12 > buf.length) break
    const id = readU16(buf, e, le)
    tags[id] = {
      type: readU16(buf, e + 2, le),
      count: readU32(buf, e + 4, le),
      valueOffset: readU32(buf, e + 8, le),
      valueFieldOffset: e + 8
    }
  }
  return tags
}

function extractDateFromTIFF(buf, tiffBase, le) {
  const ifd0Off = readU32(buf, tiffBase + 4, le)
  const ifd0 = parseIFD(buf, tiffBase, ifd0Off, le)

  // Follow ExifIFD pointer (0x8769) for DateTimeOriginal (0x9003)
  if (ifd0[0x8769]) {
    const exifIFD = parseIFD(buf, tiffBase, ifd0[0x8769].valueOffset, le)
    if (exifIFD[0x9003]) {
      const ts = parseExifDate(readIFDString(buf, tiffBase, exifIFD[0x9003], le))
      if (ts) return ts
    }
    // DateTimeDigitized (0x9004) as secondary
    if (exifIFD[0x9004]) {
      const ts = parseExifDate(readIFDString(buf, tiffBase, exifIFD[0x9004], le))
      if (ts) return ts
    }
  }

  // DateTime in IFD0 (0x0132) as last resort
  if (ifd0[0x0132]) {
    const ts = parseExifDate(readIFDString(buf, tiffBase, ifd0[0x0132], le))
    if (ts) return ts
  }

  return null
}

function parseJpegExif(buf) {
  if (buf[0] !== 0xFF || buf[1] !== 0xD8) return null
  let off = 2
  while (off + 4 < buf.length) {
    if (buf[off] !== 0xFF) return null
    const marker = buf[off + 1]
    if (marker === 0xDA) break // start of scan
    const segLen = buf.readUInt16BE(off + 2)

    if (marker === 0xE1) {
      // APP1 — check for "Exif\0\0"
      if (off + 10 < buf.length &&
          buf.toString('ascii', off + 4, off + 8) === 'Exif' &&
          buf[off + 8] === 0 && buf[off + 9] === 0) {
        const tiffBase = off + 10
        const bo = buf.toString('ascii', tiffBase, tiffBase + 2)
        if (bo === 'II' || bo === 'MM') {
          return extractDateFromTIFF(buf, tiffBase, bo === 'II')
        }
      }
    }

    off += 2 + segLen
  }
  return null
}

function parseTiffExif(buf) {
  if (buf.length < 8) return null
  const bo = buf.toString('ascii', 0, 2)
  if (bo !== 'II' && bo !== 'MM') return null
  return extractDateFromTIFF(buf, 0, bo === 'II')
}

// --- Public API ---

async function scanFolder(folderPath) {
  try {
    const entries = await fs.readdir(folderPath, { withFileTypes: true })
    const results = []

    for (const entry of entries) {
      if (!entry.isFile()) continue
      const ext = getExtension(entry.name)
      if (!IMAGE_EXTENSIONS.has(ext)) continue

      const fullPath = path.join(folderPath, entry.name)
      const stat = await fs.stat(fullPath)
      results.push({
        name: entry.name,
        path: fullPath,
        size: stat.size,
        modifiedMs: stat.mtimeMs
      })
    }

    return results
  } catch (err) {
    return { error: err.message }
  }
}

async function readExif(filePath) {
  try {
    const ext = getExtension(filePath)
    const stat = await fs.stat(filePath)

    let timestamp = null

    if (ext === 'jpg' || ext === 'jpeg' || TIFF_RAW_EXTENSIONS.has(ext)) {
      const handle = await fs.open(filePath, 'r')
      try {
        const readSize = Math.min(stat.size, 128 * 1024)
        const buf = Buffer.alloc(readSize)
        await handle.read(buf, 0, readSize, 0)

        if (ext === 'jpg' || ext === 'jpeg') {
          timestamp = parseJpegExif(buf)
        } else {
          timestamp = parseTiffExif(buf)
        }
      } finally {
        await handle.close()
      }
    }

    if (!timestamp) {
      timestamp = new Date(stat.mtimeMs).toISOString()
    }

    return { timestamp }
  } catch (err) {
    return { timestamp: null, error: err.message }
  }
}

async function copyFile(srcPath, dstPath) {
  try {
    await fs.mkdir(path.dirname(dstPath), { recursive: true })
    await fs.copyFile(srcPath, dstPath)
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

async function moveToTrash(filePath, trashFolderPath) {
  try {
    await fs.mkdir(trashFolderPath, { recursive: true })
    const dest = path.join(trashFolderPath, path.basename(filePath))
    await fs.rename(filePath, dest)
    return { success: true, trashedPath: dest }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

async function restoreFromTrash(trashedPath, originalPath) {
  try {
    await fs.mkdir(path.dirname(originalPath), { recursive: true })
    await fs.rename(trashedPath, originalPath)
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

async function emptyTrash(trashFolderPath) {
  try {
    const entries = await fs.readdir(trashFolderPath)
    let deleted = 0
    const errors = []

    for (const name of entries) {
      try {
        await fs.unlink(path.join(trashFolderPath, name))
        deleted++
      } catch (err) {
        errors.push(`${name}: ${err.message}`)
      }
    }

    return { deleted, errors }
  } catch (err) {
    return { deleted: 0, errors: [err.message] }
  }
}

async function createDirectory(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true })
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

module.exports = {
  scanFolder,
  readExif,
  copyFile,
  moveToTrash,
  restoreFromTrash,
  emptyTrash,
  createDirectory
}
