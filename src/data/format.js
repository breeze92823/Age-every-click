// Big-number and duration presentation, ported verbatim from Ice-Skate's
// data/format.js. Pure functions of primitives only, no React, no store
// import, so any HUD readout can depend on them freely.
const SUFFIXES = ['', 'K', 'M', 'B', 'T']

function packSuffix(over) {
  const hi = Math.floor(over / 26)
  const lo = over % 26
  return String.fromCharCode(97 + hi) + String.fromCharCode(97 + lo)
}

// 2480 -> "2.48K", 50 -> "50", 12_300_000 -> "12.3M".
export function formatShort(n) {
  if (!Number.isFinite(n)) return '0'
  const neg = n < 0
  let v = Math.abs(n)

  if (v < 1000) {
    const s = Number.isInteger(v) ? String(v) : v.toFixed(1)
    return neg ? `-${s}` : s
  }

  let tier = 0
  while (v >= 1000) {
    v /= 1000
    tier++
  }

  const suffix = tier < SUFFIXES.length ? SUFFIXES[tier] : packSuffix(tier - SUFFIXES.length)

  const digits = v < 10 ? 2 : v < 100 ? 1 : 0
  let mantissa = v.toFixed(digits)
  if (mantissa.includes('.')) mantissa = mantissa.replace(/\.?0+$/, '')

  return `${neg ? '-' : ''}${mantissa}${suffix}`
}
