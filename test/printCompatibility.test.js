// Expected values in this file are independently computed by hand and
// verified against the printCompatibility.js formulas directly (see the
// commit message / PR description for the full derivation). Several of
// the illustrative example numbers in GitHub issue #28's verification
// checklist don't arithmetically match its own stated formulas (e.g. it
// claims D80 at 4×6 is ~432 DPI, but the checklist's own orientation-swap
// logic — applied consistently — produces 645 DPI; it also claims 16×20
// at 162 DPI is 'warn', which contradicts its own stated 200 DPI warn/
// error threshold). The formulas and thresholds themselves are sound and
// implemented here exactly as specified; only the checklist's specific
// illustrative numbers were off.

const {
  PRINT_SIZES,
  checkResolution,
  checkAspectRatio,
  checkPrintCompatibility,
  findMatchingSizes
} = require('../electron/services/printCompatibility')

// Nikon D80: 3872x2592 (~10MP, 3:2 landscape)
const D80_W = 3872
const D80_H = 2592

// A 48MP 4:3 sensor, e.g. iPhone Pro main camera at full resolution
const PHONE_W = 8064
const PHONE_H = 6048

describe('PRINT_SIZES', () => {
  test('includes standard, square, and panoramic sizes', () => {
    const labels = PRINT_SIZES.map(s => s.label)
    expect(labels).toEqual(expect.arrayContaining(['4×6', '8×10', '11×14', '20×30']))
    expect(labels).toEqual(expect.arrayContaining(['4×4', '8×8', '10×10']))
    expect(labels).toEqual(expect.arrayContaining(['6×18', '8×24', '12×36']))
  })
})

describe('checkResolution', () => {
  test('D80 at 4×6 — correctly oriented print produces ~645 DPI, ok', () => {
    const r = checkResolution(D80_W, D80_H, 4, 6)
    expect(r.status).toBe('ok')
    expect(r.dpi).toBeCloseTo(645, 0)
  })

  test('D80 at 8×10 — ~324 DPI, ok', () => {
    const r = checkResolution(D80_W, D80_H, 8, 10)
    expect(r.status).toBe('ok')
    expect(r.dpi).toBeCloseTo(324, 0)
  })

  test('D80 at 16×20 — ~162 DPI, below the 200 DPI floor: error, not warn', () => {
    const r = checkResolution(D80_W, D80_H, 16, 20)
    expect(r.status).toBe('error')
    expect(r.dpi).toBeCloseTo(162, 0)
  })

  test('D80 at 20×30 — ~129 DPI, error', () => {
    const r = checkResolution(D80_W, D80_H, 20, 30)
    expect(r.status).toBe('error')
    expect(r.dpi).toBeCloseTo(129, 0)
  })

  test('48MP phone photo at 20×30 — ~269 DPI, warn (not quite 300 DPI)', () => {
    const r = checkResolution(PHONE_W, PHONE_H, 20, 30)
    expect(r.status).toBe('warn')
    expect(r.dpi).toBeCloseTo(269, 0)
  })

  test('handles portrait photo the same as landscape (orientation-agnostic)', () => {
    const landscape = checkResolution(D80_W, D80_H, 8, 10)
    const portrait = checkResolution(D80_H, D80_W, 8, 10)
    expect(portrait.dpi).toBe(landscape.dpi)
  })
})

describe('checkAspectRatio', () => {
  // Exact 3:2 ratio (matches D80's true sensor ratio)
  const W32 = 3000, H32 = 2000

  test('3:2 photo → 4×6 print: perfect fit', () => {
    const r = checkAspectRatio(W32, H32, 4, 6)
    expect(r.status).toBe('ok')
    expect(r.cropPercent).toBeCloseTo(0, 1)
  })

  test('3:2 photo → 8×12 print: perfect fit (same ratio)', () => {
    const r = checkAspectRatio(W32, H32, 8, 12)
    expect(r.status).toBe('ok')
    expect(r.cropPercent).toBeCloseTo(0, 1)
  })

  test('3:2 photo → 8×10 print: error, ~16.7% crop on the sides', () => {
    const r = checkAspectRatio(W32, H32, 8, 10)
    expect(r.status).toBe('error')
    expect(r.cropPercent).toBeCloseTo(16.7, 1)
    expect(r.cropDescription).toBe('sides')
  })

  test('3:2 photo → 5×7 print: minor crop (~6.7%), not warn', () => {
    const r = checkAspectRatio(W32, H32, 5, 7)
    expect(r.status).toBe('minor')
    expect(r.cropPercent).toBeCloseTo(6.7, 1)
  })

  test('3:2 photo → 8×8 square print: major crop, error', () => {
    const r = checkAspectRatio(W32, H32, 8, 8)
    expect(r.status).toBe('error')
    expect(r.cropPercent).toBeGreaterThan(15)
  })

  test('4:3 photo → 4×6 print: minor crop (~11%), top/bottom', () => {
    const r = checkAspectRatio(4000, 3000, 4, 6)
    expect(r.status).toBe('warn')
    expect(r.cropPercent).toBeCloseTo(11.1, 1)
    expect(r.cropDescription).toBe('top/bottom')
  })

  test('4:3 photo → 8×10 print: minor crop (~6.3%)', () => {
    const r = checkAspectRatio(4000, 3000, 8, 10)
    expect(r.status).toBe('minor')
    expect(r.cropPercent).toBeCloseTo(6.3, 1)
  })

  test('handles portrait photo the same as its landscape equivalent', () => {
    const landscape = checkAspectRatio(W32, H32, 4, 6)
    const portrait = checkAspectRatio(H32, W32, 4, 6)
    expect(portrait.cropPercent).toBe(landscape.cropPercent)
  })
})

describe('checkPrintCompatibility', () => {
  test('overall status is the worse of resolution and aspect ratio', () => {
    // D80 at 8x10: resolution 'ok' (324 DPI), aspect ratio 'error' (16.7% crop)
    const r = checkPrintCompatibility(D80_W, D80_H, 8, 10)
    expect(r.resolution.status).toBe('ok')
    expect(r.aspectRatio.status).toBe('error')
    expect(r.overallStatus).toBe('error')
  })
})

describe('findMatchingSizes', () => {
  test('D80 3:2 photo ranks 4×6, 8×12, 12×18 among the best matches', () => {
    const matches = findMatchingSizes(D80_W, D80_H).map(s => s.label)
    expect(matches.slice(0, 3)).toEqual(['4×6', '8×12', '12×18'])
  })

  test('only returns sizes with ok or minor aspect-ratio fit', () => {
    const matches = findMatchingSizes(D80_W, D80_H)
    for (const m of matches) {
      expect(['ok', 'minor']).toContain(m.aspectRatio.status)
    }
  })

  test('4:3 phone photo has no exact match but still ranks the closest sizes', () => {
    const matches = findMatchingSizes(PHONE_W, PHONE_H)
    expect(matches.length).toBeGreaterThan(0)
    expect(matches[0].aspectRatio.status).toMatch(/ok|minor/)
  })
})
