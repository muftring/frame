const sharp = require('sharp')
const fs = require('fs/promises')
const path = require('path')
const crypto = require('crypto')
const os = require('os')
const { execFile } = require('child_process')
const { promisify } = require('util')

const execFileAsync = promisify(execFile)

const CACHE_DIR = path.join(os.homedir(), '.frame', 'thumbcache')

// macOS can't decode HEIC/HEIF through sharp's bundled libvips (no HEVC
// support in the prebuilt binary), so HEIC/HEIF sources are converted to a
// cached JPEG via the system `sips` tool before being handed to sharp.
const HEIC_CACHE_DIR = path.join(os.homedir(), '.frame', 'heiccache')
const HEIC_EXTENSIONS = new Set(['heic', 'heif'])

const PLACEHOLDER = 'data:image/svg+xml;base64,' + Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150">' +
  '<rect width="200" height="150" fill="#2e2e2e"/>' +
  '<text x="100" y="80" text-anchor="middle" fill="#666" font-size="14" font-family="sans-serif">No Preview</text>' +
  '</svg>'
).toString('base64')

async function ensureCacheDir() {
  await fs.mkdir(CACHE_DIR, { recursive: true })
}

function thumbHash(filePath, modifiedMs) {
  return crypto.createHash('sha256')
    .update(filePath + ':' + modifiedMs)
    .digest('hex')
}

function isHeic(filePath) {
  return HEIC_EXTENSIONS.has(path.extname(filePath).toLowerCase().slice(1))
}

// Resolves the path sharp should actually read: the original file, or a
// cached JPEG conversion for HEIC/HEIF sources.
async function sharpSource(filePath) {
  if (!isHeic(filePath)) return filePath

  const stat = await fs.stat(filePath)
  const hash = thumbHash(filePath, stat.mtimeMs)
  const cachePath = path.join(HEIC_CACHE_DIR, hash + '.jpg')

  try {
    await fs.access(cachePath)
    return cachePath
  } catch {
    // not cached yet
  }

  await fs.mkdir(HEIC_CACHE_DIR, { recursive: true })
  await execFileAsync('sips', ['-s', 'format', 'jpeg', filePath, '--out', cachePath])
  return cachePath
}

async function thumbnail(filePath, size) {
  try {
    const w = (size && size.width) || 200
    const h = (size && size.height) || 150

    const stat = await fs.stat(filePath)
    const hash = thumbHash(filePath, stat.mtimeMs)
    const cachePath = path.join(CACHE_DIR, hash + '.jpg')

    try {
      const cached = await fs.readFile(cachePath)
      return 'data:image/jpeg;base64,' + cached.toString('base64')
    } catch {
      // not cached
    }

    let buf
    try {
      buf = await sharp(await sharpSource(filePath))
        .rotate()
        .resize(w, h, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer()
    } catch {
      return PLACEHOLDER
    }

    await fs.writeFile(cachePath, buf).catch(() => {})
    return 'data:image/jpeg;base64,' + buf.toString('base64')
  } catch (err) {
    return PLACEHOLDER
  }
}

async function rotate(filePath, degrees, outputPath) {
  try {
    const buf = await sharp(await sharpSource(filePath))
      .rotate(degrees)
      .toBuffer()
    await fs.mkdir(path.dirname(outputPath), { recursive: true })
    await fs.writeFile(outputPath, buf)
    return { success: true, outputPath }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

async function crop(filePath, region, outputPath) {
  try {
    const buf = await sharp(await sharpSource(filePath))
      .extract({
        left: region.x,
        top: region.y,
        width: region.width,
        height: region.height
      })
      .toBuffer()
    await fs.mkdir(path.dirname(outputPath), { recursive: true })
    await fs.writeFile(outputPath, buf)
    return { success: true, outputPath }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

async function getMetadata(filePath) {
  try {
    const meta = await sharp(await sharpSource(filePath)).metadata()
    const stat = await fs.stat(filePath)
    return {
      width: meta.width,
      height: meta.height,
      format: isHeic(filePath) ? path.extname(filePath).toLowerCase().slice(1) : meta.format,
      size: stat.size,
      exif: meta.exif ? parseFullExif(meta.exif) : {}
    }
  } catch (err) {
    return { error: err.message }
  }
}

async function flip(filePath, direction, outputPath) {
  try {
    let pipeline = sharp(await sharpSource(filePath))
    if (direction === 'horizontal') pipeline = pipeline.flop()
    else pipeline = pipeline.flip()
    const buf = await pipeline.toBuffer()
    await fs.mkdir(path.dirname(outputPath), { recursive: true })
    await fs.writeFile(outputPath, buf)
    return { success: true, outputPath }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

// ─── EXIF IFD parser ─────────────────────────────────────────────────────────
// Sharp's meta.exif is the raw APP1 payload, which may or may not include the
// leading "Exif\0\0" header before the TIFF block. We detect and skip it.

function exifTiffBase(buf) {
  if (buf.length >= 6 &&
      buf.toString('ascii', 0, 4) === 'Exif' &&
      buf[4] === 0 && buf[5] === 0) return 6
  return 0
}

function u16(buf, off, le) {
  return le ? buf.readUInt16LE(off) : buf.readUInt16BE(off)
}

function u32(buf, off, le) {
  return le ? buf.readUInt32LE(off) : buf.readUInt32BE(off)
}

function parseIFD(buf, base, ifdOff, le) {
  const abs = base + ifdOff
  if (abs + 2 > buf.length) return {}
  const count = u16(buf, abs, le)
  const tags = {}
  for (let i = 0; i < count; i++) {
    const e = abs + 2 + i * 12
    if (e + 12 > buf.length) break
    const id = u16(buf, e, le)
    tags[id] = {
      type:            u16(buf, e + 2, le),
      count:           u32(buf, e + 4, le),
      valueOffset:     u32(buf, e + 8, le), // raw bytes — offset when data > 4 bytes
      valueFieldOffset: e + 8               // absolute position of the 4-byte value field
    }
  }
  return tags
}

function ifdStr(buf, base, tag, le) {
  if (tag.type !== 2 || tag.count < 1) return null
  const off = tag.count <= 4 ? tag.valueFieldOffset : base + tag.valueOffset
  if (off + tag.count > buf.length) return null
  const s = buf.toString('ascii', off, off + tag.count - 1).trim()
  return s.length ? s : null
}

function ifdShort(buf, base, tag, le) {
  if (tag.type === 3) {
    // SHORT — inline when count * 2 <= 4
    if (tag.count * 2 <= 4) {
      return le ? buf.readUInt16LE(tag.valueFieldOffset) : buf.readUInt16BE(tag.valueFieldOffset)
    }
    const off = base + tag.valueOffset
    return off + 2 <= buf.length ? u16(buf, off, le) : null
  }
  if (tag.type === 4) {
    // LONG — inline when count = 1 (4 bytes)
    if (tag.count === 1) {
      return le ? buf.readUInt32LE(tag.valueFieldOffset) : buf.readUInt32BE(tag.valueFieldOffset)
    }
    const off = base + tag.valueOffset
    return off + 4 <= buf.length ? u32(buf, off, le) : null
  }
  return null
}

function ifdRational(buf, base, tag, le) {
  const signed = tag.type === 10
  if (tag.type !== 5 && !signed) return null
  const off = base + tag.valueOffset
  if (off + 8 > buf.length) return null
  const num = signed
    ? (le ? buf.readInt32LE(off) : buf.readInt32BE(off))
    : u32(buf, off, le)
  const den = u32(buf, off + 4, le)
  return den === 0 ? null : { num, den }
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function fmtDateTime(raw) {
  if (!raw || raw.length < 10) return null
  // EXIF standard: "YYYY:MM:DD HH:MM:SS"
  let m = raw.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/)
  // ISO fallback: "YYYY-MM-DDTHH:MM:SS" (some editors write this)
  if (!m) m = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/)
  if (!m) return null
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])
  if (isNaN(d.getTime())) return null
  const date = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${date}  ${time}`
}

function fmtShutter(r) {
  if (!r || r.den === 0) return null
  const val = r.num / r.den
  if (val >= 1) return val % 1 === 0 ? `${val}s` : `${val.toFixed(1)}s`
  const den = Math.round(r.den / r.num)
  return `1/${den}`
}

function fmtAperture(r) {
  if (!r || r.den === 0) return null
  const f = r.num / r.den
  return `f/${f % 1 === 0 ? f.toFixed(0) : f.toFixed(1)}`
}

function fmtExposureProgram(v) {
  return [
    null, 'Manual', 'Program', 'Aperture priority',
    'Shutter priority', 'Creative', 'Action', 'Portrait', 'Landscape'
  ][v] ?? null
}

function fmtMeteringMode(v) {
  const map = { 1: 'Average', 2: 'Center-weighted', 3: 'Spot', 4: 'Multi-spot', 5: 'Matrix', 6: 'Partial' }
  return map[v] ?? null
}

function fmtFlash(v) {
  if (v == null) return null
  if (!(v & 0x01)) return 'Did not fire'
  const ret = (v >> 1) & 0x03
  if (ret === 2) return 'Fired, did not return'
  if (ret === 3) return 'Fired, returned'
  return 'Fired'
}

function fmtExposureComp(r) {
  if (!r || r.den === 0) return null
  const val = r.num / r.den
  if (val === 0) return '0 EV'
  const rounded = Math.round(val * 3) / 3
  const sign = rounded > 0 ? '+' : ''
  const str = Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1)
  return `${sign}${str} EV`
}

// ─── Full EXIF parse ──────────────────────────────────────────────────────────

function parseFullExif(exifBuf) {
  const empty = {
    dateTimeOriginal: null, cameraMake: null, cameraModel: null,
    lens: null, focalLength: null, focalLength35mm: null,
    aperture: null, shutterSpeed: null, iso: null,
    exposureMode: null, meteringMode: null, whiteBalance: null,
    flash: null, exposureComp: null, gps: null
  }

  try {
    const buf = exifBuf
    const base = exifTiffBase(buf)
    if (base + 8 > buf.length) return empty

    const bo = buf.toString('ascii', base, base + 2)
    if (bo !== 'II' && bo !== 'MM') return empty
    const le = bo === 'II'

    const ifd0Off = u32(buf, base + 4, le)
    const ifd0 = parseIFD(buf, base, ifd0Off, le)

    const result = { ...empty }

    // IFD0: Make, Model
    if (ifd0[0x010F]) result.cameraMake  = ifdStr(buf, base, ifd0[0x010F], le)
    if (ifd0[0x0110]) result.cameraModel = ifdStr(buf, base, ifd0[0x0110], le)

    // ExifIFD (0x8769)
    if (!ifd0[0x8769]) return result
    const exifIFD = parseIFD(buf, base, ifd0[0x8769].valueOffset, le)

    // DateTimeOriginal (0x9003) → formatted string
    if (exifIFD[0x9003]) {
      const raw = ifdStr(buf, base, exifIFD[0x9003], le)
      // Pad to 19 chars because ifdStr strips trailing null; date strings are exactly 19
      result.dateTimeOriginal = fmtDateTime(raw)
    }
    if (!result.dateTimeOriginal && exifIFD[0x9004]) {
      result.dateTimeOriginal = fmtDateTime(ifdStr(buf, base, exifIFD[0x9004], le))
    }

    // ExposureTime (0x829A) → shutter speed
    if (exifIFD[0x829A]) result.shutterSpeed = fmtShutter(ifdRational(buf, base, exifIFD[0x829A], le))

    // FNumber (0x829D) → aperture
    if (exifIFD[0x829D]) result.aperture = fmtAperture(ifdRational(buf, base, exifIFD[0x829D], le))

    // ISO (0x8827 ISOSpeedRatings — SHORT or LONG)
    if (exifIFD[0x8827]) {
      const iso = ifdShort(buf, base, exifIFD[0x8827], le)
      if (iso != null) result.iso = String(iso)
    }

    // ExposureProgram (0x8822) → exposure mode
    if (exifIFD[0x8822]) result.exposureMode = fmtExposureProgram(ifdShort(buf, base, exifIFD[0x8822], le))

    // MeteringMode (0x9207)
    if (exifIFD[0x9207]) result.meteringMode = fmtMeteringMode(ifdShort(buf, base, exifIFD[0x9207], le))

    // Flash (0x9209)
    if (exifIFD[0x9209]) result.flash = fmtFlash(ifdShort(buf, base, exifIFD[0x9209], le))

    // FocalLength (0x920A) → "200mm"
    if (exifIFD[0x920A]) {
      const r = ifdRational(buf, base, exifIFD[0x920A], le)
      if (r) result.focalLength = Math.round(r.num / r.den) + 'mm'
    }

    // FocalLengthIn35mmFilm (0xA405) → "300mm"
    if (exifIFD[0xA405]) {
      const v = ifdShort(buf, base, exifIFD[0xA405], le)
      if (v) result.focalLength35mm = v + 'mm'
    }

    // ExposureBiasValue (0x9204) — SRATIONAL
    if (exifIFD[0x9204]) result.exposureComp = fmtExposureComp(ifdRational(buf, base, exifIFD[0x9204], le))

    // WhiteBalance (0xA403) — 0=Auto, 1=Manual
    if (exifIFD[0xA403]) {
      const v = ifdShort(buf, base, exifIFD[0xA403], le)
      result.whiteBalance = v === 0 ? 'Auto' : v === 1 ? 'Manual' : null
    }

    // LensModel (0xA434)
    if (exifIFD[0xA434]) result.lens = ifdStr(buf, base, exifIFD[0xA434], le)

    // GPS IFD (0x8825) — D80 has none; result.gps stays null

    return result
  } catch {
    return empty
  }
}

// ─── Public: full metadata ────────────────────────────────────────────────────

async function getFullMetadata(filePath) {
  try {
    const source = await sharpSource(filePath)
    const [meta, stat] = await Promise.all([
      sharp(source).metadata(),
      fs.stat(filePath)
    ])

    const w = meta.width || null
    const h = meta.height || null
    const megapixels = w && h ? Math.round((w * h) / 100000) / 10 : null

    const exif = meta.exif ? parseFullExif(meta.exif) : {
      dateTimeOriginal: null, cameraMake: null, cameraModel: null,
      lens: null, focalLength: null, focalLength35mm: null,
      aperture: null, shutterSpeed: null, iso: null,
      exposureMode: null, meteringMode: null, whiteBalance: null,
      flash: null, exposureComp: null, gps: null
    }

    return {
      filename: path.basename(filePath),
      fullPath: filePath,
      sizeBytes: stat.size,
      format: isHeic(filePath) ? path.extname(filePath).toLowerCase().slice(1) : (meta.format || null),
      dimensions: { width: w, height: h, megapixels },
      exif
    }
  } catch (err) {
    return { error: err.message }
  }
}

// ─── Public: batch basic metadata for gallery tooltips ───────────────────────

async function getMetadataBatch(filePaths) {
  return Promise.all(filePaths.map(async (fp) => {
    try {
      const meta = await sharp(await sharpSource(fp)).metadata()
      let dateTimeOriginal = null
      let iso = null
      let aperture = null
      let shutterSpeed = null

      if (meta.exif) {
        const parsed = parseFullExif(meta.exif)
        dateTimeOriginal = parsed.dateTimeOriginal
        iso              = parsed.iso
        aperture         = parsed.aperture
        shutterSpeed     = parsed.shutterSpeed
      }

      return {
        filename: path.basename(fp),
        width:    meta.width  || null,
        height:   meta.height || null,
        dateTimeOriginal,
        iso,
        aperture,
        shutterSpeed
      }
    } catch {
      return { filename: path.basename(fp), width: null, height: null,
               dateTimeOriginal: null, iso: null, aperture: null, shutterSpeed: null }
    }
  }))
}

module.exports = {
  ensureCacheDir,
  thumbnail,
  rotate,
  crop,
  flip,
  getMetadata,
  getFullMetadata,
  getMetadataBatch
}
