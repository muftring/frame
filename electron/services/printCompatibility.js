// Pure calculation module for print resolution + aspect ratio
// compatibility checks. No UI, no IPC — used by the print:* IPC
// handlers in main.js.

const PRINT_SIZES = [
  { label: '4×6',   width: 4,  height: 6  },
  { label: '5×7',   width: 5,  height: 7  },
  { label: '8×10',  width: 8,  height: 10 },
  { label: '8×12',  width: 8,  height: 12 },
  { label: '11×14', width: 11, height: 14 },
  { label: '12×18', width: 12, height: 18 },
  { label: '16×20', width: 16, height: 20 },
  { label: '20×24', width: 20, height: 24 },
  { label: '20×30', width: 20, height: 30 },
  { label: '24×36', width: 24, height: 36 },
  // Square prints
  { label: '4×4',   width: 4,  height: 4  },
  { label: '8×8',   width: 8,  height: 8  },
  { label: '10×10', width: 10, height: 10 },
  // Panoramic
  { label: '6×18',  width: 6,  height: 18 },
  { label: '8×24',  width: 8,  height: 24 },
  { label: '12×36', width: 12, height: 36 },
]

const MIN_DPI = 300            // minimum recommended print DPI
const MIN_DPI_ACCEPTABLE = 200 // below this: warn strongly

// Orients the print dimensions to match the photo's orientation before
// computing DPI — a "4×6" print of a landscape photo is produced as a
// 6"-wide by 4"-tall print, not literally 4" wide. Without this, DPI
// would be computed as if the image were rotated 90° into the print.
function checkResolution(pixelWidth, pixelHeight, printWidth, printHeight) {
  let pw = pixelWidth, ph = pixelHeight
  let printW = printWidth, printH = printHeight

  const photoLandscape = pw >= ph
  const printLandscape = printW >= printH
  if (photoLandscape !== printLandscape) {
    [printW, printH] = [printH, printW]
  }

  const dpiW = pw / printW
  const dpiH = ph / printH
  const dpi = Math.min(dpiW, dpiH) // limiting dimension

  const minPixelsW = Math.round(printW * MIN_DPI)
  const minPixelsH = Math.round(printH * MIN_DPI)
  const minMegapixels = (minPixelsW * minPixelsH / 1_000_000).toFixed(1)
  const actualMegapixels = (pw * ph / 1_000_000).toFixed(1)

  let status, message
  if (dpi >= MIN_DPI) {
    status = 'ok'
    message = `${Math.round(dpi)} DPI — excellent`
  } else if (dpi >= MIN_DPI_ACCEPTABLE) {
    status = 'warn'
    message = `${Math.round(dpi)} DPI — acceptable but not ideal`
  } else {
    status = 'error'
    message = `${Math.round(dpi)} DPI — too low for quality printing`
  }

  return {
    status,
    dpi: Math.round(dpi),
    message,
    actualMegapixels: parseFloat(actualMegapixels),
    minMegapixels: parseFloat(minMegapixels),
  }
}

function checkAspectRatio(pixelWidth, pixelHeight, printWidth, printHeight) {
  // Normalize both to landscape for comparison
  let pw = pixelWidth, ph = pixelHeight
  let pW = printWidth, pH = printHeight

  if (pw < ph) [pw, ph] = [ph, pw]
  if (pW < pH) [pW, pH] = [pH, pW]

  const photoRatio = pw / ph
  const printRatio = pW / pH

  let cropPercent
  if (photoRatio > printRatio) {
    // Photo is wider than print — sides will be cropped
    const effectiveWidth = ph * printRatio
    cropPercent = ((pw - effectiveWidth) / pw) * 100
  } else {
    // Photo is taller than print — top/bottom will be cropped
    const effectiveHeight = pw / printRatio
    cropPercent = ((ph - effectiveHeight) / ph) * 100
  }

  cropPercent = Math.round(cropPercent * 10) / 10

  let status, message, cropDescription
  if (cropPercent < 2) {
    status = 'ok'
    message = 'Perfect fit'
    cropDescription = null
  } else if (cropPercent < 8) {
    status = 'minor'
    message = `Minor crop — ${cropPercent}% trimmed`
    cropDescription = photoRatio > printRatio ? 'sides' : 'top/bottom'
  } else if (cropPercent < 15) {
    status = 'warn'
    message = `Moderate crop — ${cropPercent}% trimmed`
    cropDescription = photoRatio > printRatio ? 'sides' : 'top/bottom'
  } else {
    status = 'error'
    message = `Significant crop — ${cropPercent}% trimmed`
    cropDescription = photoRatio > printRatio ? 'sides' : 'top/bottom'
  }

  return {
    status,
    cropPercent,
    message,
    cropDescription,
    photoRatio: Math.round(photoRatio * 1000) / 1000,
    printRatio: Math.round(printRatio * 1000) / 1000,
  }
}

function checkPrintCompatibility(pixelWidth, pixelHeight, printWidth, printHeight) {
  const resolution = checkResolution(pixelWidth, pixelHeight, printWidth, printHeight)
  const aspectRatio = checkAspectRatio(pixelWidth, pixelHeight, printWidth, printHeight)

  const statusRank = { ok: 0, minor: 1, warn: 2, error: 3 }
  const overallStatus =
    statusRank[resolution.status] >= statusRank[aspectRatio.status]
      ? resolution.status
      : aspectRatio.status

  return { resolution, aspectRatio, overallStatus }
}

// Returns print sizes that are a good match for this photo (aspect
// ratio status 'ok' or 'minor' only).
function findMatchingSizes(pixelWidth, pixelHeight) {
  return PRINT_SIZES
    .map(size => {
      const ar = checkAspectRatio(pixelWidth, pixelHeight, size.width, size.height)
      const res = checkResolution(pixelWidth, pixelHeight, size.width, size.height)
      return { ...size, aspectRatio: ar, resolution: res }
    })
    .filter(s => s.aspectRatio.status === 'ok' || s.aspectRatio.status === 'minor')
    .sort((a, b) => a.aspectRatio.cropPercent - b.aspectRatio.cropPercent)
}

module.exports = {
  PRINT_SIZES,
  checkResolution,
  checkAspectRatio,
  checkPrintCompatibility,
  findMatchingSizes,
}
