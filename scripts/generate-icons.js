#!/usr/bin/env node
// Generates the Electron app icon set (PNGs, .icns, .ico) from
// src/assets/logo/frame-mark-contained.svg.
//
// The mark's "F" is rendered as regular SVG <text> in italic Times New
// Roman for use in the app UI (where the OS provides that font). But
// sharp's SVG rasterizer (librsvg) doesn't reliably have Times New Roman
// available at build time, and would silently fall back to a generic
// serif/sans font for the app icon. To guarantee the icon always shows
// the correct italic glyph regardless of the machine running this
// script, the F is outlined to an SVG path (via opentype.js, reading the
// actual font file) before rasterizing, so the icon's shape doesn't
// depend on font availability at all.

const fs = require('fs')
const path = require('path')
const os = require('os')
const { execSync } = require('child_process')
const sharp = require('sharp')
const opentype = require('opentype.js')

const REPO_ROOT = path.join(__dirname, '..')
const MARK_SVG_PATH = path.join(REPO_ROOT, 'src/assets/logo/frame-mark-contained.svg')
const OUTPUT_DIR = path.join(REPO_ROOT, 'build/icons')
const SIZES = [16, 32, 48, 64, 128, 256, 512, 1024]

// Matches the <text> position/size used in frame-mark-contained.svg's F.
const F_X = 50
const F_Y = 72
const F_FONT_SIZE = 76

const FONT_SEARCH_PATHS = [
  '/Library/Fonts/Times New Roman Italic.ttf',
  '/System/Library/Fonts/Supplemental/Times New Roman Italic.ttf',
  path.join(os.homedir(), 'Library/Fonts/Times New Roman Italic.ttf'),
  'C:/Windows/Fonts/timesi.ttf'
]

const FONT_FALLBACK_PATHS = [
  '/System/Library/Fonts/Supplemental/Times New Roman.ttf',
  'C:/Windows/Fonts/times.ttf'
]

function findFirstExisting(paths) {
  return paths.find(p => fs.existsSync(p)) || null
}

// Step 1 — find an italic Times New Roman font file, falling back to the
// regular weight with a simulated italic skew if no italic file exists.
function findFont() {
  const italicPath = findFirstExisting(FONT_SEARCH_PATHS)
  if (italicPath) return { path: italicPath, simulateItalic: false }

  const regularPath = findFirstExisting(FONT_FALLBACK_PATHS)
  if (regularPath) return { path: regularPath, simulateItalic: true }

  return null
}

// Step 2 — outline the F glyph to SVG path data using the real font file,
// independent of whatever fonts sharp/librsvg can see at rasterize time.
function outlineFGlyph(fontInfo) {
  const buf = fs.readFileSync(fontInfo.path)
  const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  const font = opentype.parse(arrayBuffer)
  const glyph = font.charToGlyph('F')
  const glyphPath = glyph.getPath(F_X, F_Y, F_FONT_SIZE)
  let d = glyphPath.toPathData(3)

  if (fontInfo.simulateItalic) {
    // No italic font file was found — approximate italic by skewing the
    // outlined regular-weight glyph, applied as a transform on the path
    // element itself (kept in the returned wrapper attrs, not baked into
    // the path data, since skewing raw path coordinates by hand is error
    // prone).
    return { d, transform: `skewX(-12)` }
  }
  return { d, transform: null }
}

// Step 3 — swap the mark's three <text>F</text> layers for <path> elements
// using the outlined glyph, in the same dark-gap / gold-fill / bright-rim
// order the original SVG defines them.
function buildRasterizationSvg(outline) {
  const markSvg = fs.readFileSync(MARK_SVG_PATH, 'utf8')
  const transformAttr = outline.transform ? ` transform="${outline.transform}"` : ''

  const pathVariants = [
    `<path${transformAttr} d="${outline.d}" fill="#0d0d0d" stroke="#0d0d0d" stroke-width="5" stroke-linejoin="round"/>`,
    `<path${transformAttr} d="${outline.d}" fill="#c9a84c" stroke="none"/>`,
    `<path${transformAttr} d="${outline.d}" fill="none" stroke="#ffd966" stroke-width="1.5" stroke-linejoin="round"/>`
  ]

  let variantIndex = 0
  const textElementRe = /<text\b[^>]*>F<\/text>/g
  const result = markSvg.replace(textElementRe, () => {
    const replacement = pathVariants[variantIndex]
    variantIndex++
    return replacement
  })

  if (variantIndex !== 3) {
    throw new Error(`Expected exactly 3 <text>F</text> elements in ${MARK_SVG_PATH}, found ${variantIndex}`)
  }
  return result
}

// Fallback: rasterize the mark as-is (SVG <text>), accepting whatever
// font librsvg resolves 'Times New Roman' to on this machine. Only used
// when no font file could be found at all.
function rawMarkSvg() {
  return fs.readFileSync(MARK_SVG_PATH, 'utf8')
}

// Step 4 — rasterize the prepared SVG at every required icon size.
async function rasterizeAll(svgString) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  const svgBuffer = Buffer.from(svgString, 'utf8')

  for (const size of SIZES) {
    const outPath = path.join(OUTPUT_DIR, `${size}x${size}.png`)
    await sharp(svgBuffer).resize(size, size).png().toFile(outPath)
    console.log(`  wrote ${path.relative(REPO_ROOT, outPath)}`)
  }
}

// Step 5 — macOS .icns via iconutil, from a standard .iconset folder.
function generateIcns() {
  if (process.platform !== 'darwin') {
    console.log('icns generation requires macOS — skipping (commit a .icns generated on a Mac)')
    return
  }

  const iconsetDir = path.join(OUTPUT_DIR, 'icon.iconset')
  fs.mkdirSync(iconsetDir, { recursive: true })

  const mapping = [
    ['icon_16x16.png', 16],
    ['icon_16x16@2x.png', 32],
    ['icon_32x32.png', 32],
    ['icon_32x32@2x.png', 64],
    ['icon_128x128.png', 128],
    ['icon_128x128@2x.png', 256],
    ['icon_256x256.png', 256],
    ['icon_256x256@2x.png', 512],
    ['icon_512x512.png', 512],
    ['icon_512x512@2x.png', 1024]
  ]

  for (const [iconsetName, size] of mapping) {
    fs.copyFileSync(
      path.join(OUTPUT_DIR, `${size}x${size}.png`),
      path.join(iconsetDir, iconsetName)
    )
  }

  const icnsPath = path.join(OUTPUT_DIR, 'icon.icns')
  execSync(`iconutil -c icns "${iconsetDir}" -o "${icnsPath}"`, { stdio: 'inherit' })
  console.log(`  wrote ${path.relative(REPO_ROOT, icnsPath)}`)
}

// Step 6 — Windows .ico via png-to-ico (ESM-only, hence the dynamic import).
async function generateIco() {
  const { default: pngToIco } = await import('png-to-ico')
  const inputs = [16, 32, 48, 256].map(size => path.join(OUTPUT_DIR, `${size}x${size}.png`))
  const icoBuffer = await pngToIco(inputs)
  const icoPath = path.join(OUTPUT_DIR, 'icon.ico')
  fs.writeFileSync(icoPath, icoBuffer)
  console.log(`  wrote ${path.relative(REPO_ROOT, icoPath)}`)
}

// Step 7 — plain 512px PNG for Linux / electron-builder's generic fallback.
function copyLinuxPng() {
  const src = path.join(OUTPUT_DIR, '512x512.png')
  const dest = path.join(OUTPUT_DIR, 'icon.png')
  fs.copyFileSync(src, dest)
  console.log(`  wrote ${path.relative(REPO_ROOT, dest)}`)
}

// electron/assets/appIcon.png is a separate, pre-existing asset used for
// the dev-mode dock icon and the About panel — not part of the
// electron-builder icon set, but the same "app icon" concern, so it's
// regenerated from the same outlined-glyph SVG for visual consistency.
async function updateAppIconAsset(svgString) {
  const dest = path.join(REPO_ROOT, 'electron/assets/appIcon.png')
  await sharp(Buffer.from(svgString, 'utf8')).resize(2048, 2048).png().toFile(dest)
  console.log(`  wrote ${path.relative(REPO_ROOT, dest)}`)
}

async function main() {
  console.log('Generating Frame app icons...')

  const fontInfo = findFont()
  let svgString

  if (!fontInfo) {
    console.warn('')
    console.warn('  WARNING: No Times New Roman font file found on this machine.')
    console.warn('  Falling back to SVG <text> rendering for the icon rasterization —')
    console.warn('  the F may render in a fallback font. This is acceptable for a')
    console.warn('  development build but MUST be fixed before a production release')
    console.warn('  (run this script on a machine with Times New Roman installed).')
    console.warn('')
    svgString = rawMarkSvg()
  } else {
    if (fontInfo.simulateItalic) {
      console.log(`Using regular-weight font (no italic file found) with a simulated skew: ${fontInfo.path}`)
    } else {
      console.log(`Using font: ${fontInfo.path}`)
    }
    const outline = outlineFGlyph(fontInfo)
    svgString = buildRasterizationSvg(outline)
  }

  console.log('Rasterizing PNGs...')
  await rasterizeAll(svgString)

  console.log('Generating .icns...')
  generateIcns()

  console.log('Generating .ico...')
  await generateIco()

  console.log('Copying Linux PNG...')
  copyLinuxPng()

  console.log('Updating electron/assets/appIcon.png (dev dock icon + About panel)...')
  await updateAppIconAsset(svgString)

  console.log('Done.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
