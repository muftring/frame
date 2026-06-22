const sharp = require('sharp')
const fs = require('fs/promises')
const path = require('path')
const crypto = require('crypto')
const os = require('os')

const CACHE_DIR = path.join(os.homedir(), '.frame', 'thumbcache')

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
      buf = await sharp(filePath)
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
    const buf = await sharp(filePath)
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
    const buf = await sharp(filePath)
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
    const meta = await sharp(filePath).metadata()
    const stat = await fs.stat(filePath)
    return {
      width: meta.width,
      height: meta.height,
      format: meta.format,
      size: stat.size,
      exif: meta.exif ? parseExifBuffer(meta.exif) : {}
    }
  } catch (err) {
    return { error: err.message }
  }
}

function parseExifBuffer(exifBuf) {
  const result = {}
  try {
    const str = exifBuf.toString('binary')
    if (str.includes('DateTimeOriginal')) {
      const idx = str.indexOf('DateTimeOriginal')
      const after = str.substring(idx + 20, idx + 40)
      const match = after.match(/(\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2})/)
      if (match) result.dateTimeOriginal = match[1]
    }
  } catch {
    // best-effort
  }
  return result
}

async function flip(filePath, direction, outputPath) {
  try {
    let pipeline = sharp(filePath)
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

module.exports = {
  ensureCacheDir,
  thumbnail,
  rotate,
  crop,
  flip,
  getMetadata
}
