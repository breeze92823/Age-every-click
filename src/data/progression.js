// Progression balance constants. Pure constants and pure functions of
// primitives only — no React, no store import — so both the store and the
// HUD can depend on this without depending on each other. Ported from
// Ice-Skate's data/progression.js, trimmed of playtime/AFK-hold constants
// this template has no system for.

// Vite only exposes VITE_-prefixed vars, and always as strings, so an
// override needs explicit numeric parsing with a fallback to the hardcoded
// default when the var is unset, blank, or not a number.
export function envInt(name, fallback) {
  const raw = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name]
  const parsed = raw != null ? Number(raw) : NaN
  return Number.isFinite(parsed) ? parsed : fallback
}

export const SPEED_INITIAL = envInt('VITE_SPEED_INITIAL', 0)
export const SPEED_MIN = 0
export const SPEED_MAX = 1_000_000_000_000

// The player's physical walk speed (m/s), for the whole game. Fixed —
// unrelated to skate tier, level, or rebirth, and never changed by any
// system. Read directly by systems/playerMovement.js and used to seed
// systems/playerState.js's initial value. Unrelated to the Speed stat/level
// above.
export const PLAYER_MOVE_SPEED = 9

export const LEVEL_INITIAL = 0
export const LEVEL_MIN = 0
export const LEVEL_MAX = 50_000

// Age is the raw click-earned total itself (Speed), starting at 0 — not a
// derived level number. "Level" below is just the index of the highest Age
// milestone the player has crossed, used for the rebirth gate and the
// LEVEL UP banner. Milestones start with this hand-picked early curve (small,
// game-feel-tuned gaps) and then grow geometrically so level LEVEL_MAX lands
// exactly on AGE_MAX — a smooth idle-game curve rather than 50,000 more
// hand-picked numbers.
export const AGE_MAX = 40_000_000_000
const AGE_SEED_MILESTONES = [0, 5, 18, 30, 45, 100]
const AGE_SEED_LEVEL_MAX = AGE_SEED_MILESTONES.length - 1

// A constant-ratio (`round(100 * ratio^n)`) curve grows so slowly right
// after level 5 that dozens of consecutive levels round to the exact same
// Age (100) before the exponential catches up — bad two ways: (a) those
// levels get crossed in one silent jump instead of feeling like a
// continuation of the hand-picked pattern, and (b) forcing a minimum +1-Age
// step to fix that starves the *next* several thousand levels of any real
// growth instead (the whole budget from 100 to AGE_MAX is only ~4·10^8x
// spread over ~50,000 levels — a constant ratio has no room to start big).
//
// A power-law curve (`100 * x^p`) has no such flat spot: its *relative*
// growth per level tapers smoothly and continuously from big early jumps
// (level 6 lands a few hundred past 100, echoing the seed's own 45→100
// jump) down toward tiny long-tail steps, while its *absolute* step size
// keeps rising (p > 1 makes it convex) — so no level ever needs a floor
// clamp, and there's no seam where the pace visibly changes gears.
const AGE_POWER = Math.log(AGE_MAX / AGE_SEED_MILESTONES[AGE_SEED_LEVEL_MAX]) / Math.log(LEVEL_MAX - AGE_SEED_LEVEL_MAX + 1)

// Precomputed whole-Age threshold for every level 0..LEVEL_MAX: the seed
// curve up to level 5 (age 100), then the power-law growth above, capped to
// land exactly on AGE_MAX at LEVEL_MAX. Built once at module load so
// ageMilestone/levelForAge are cheap O(1)/O(log n) lookups instead of
// recomputing the curve on every call. `Math.max(v, prev + 1)` is a
// defensive backstop only — the power law is monotonic by construction and
// never needs it — kept in case AGE_POWER is ever tuned close to 1.
const AGE_MILESTONES = (() => {
  const arr = new Array(LEVEL_MAX + 1)
  for (let n = 0; n <= AGE_SEED_LEVEL_MAX; n++) arr[n] = AGE_SEED_MILESTONES[n]
  for (let n = AGE_SEED_LEVEL_MAX + 1; n < LEVEL_MAX; n++) {
    const x = n - AGE_SEED_LEVEL_MAX + 1
    const v = Math.round(AGE_SEED_MILESTONES[AGE_SEED_LEVEL_MAX] * Math.pow(x, AGE_POWER))
    arr[n] = Math.max(v, arr[n - 1] + 1)
  }
  arr[LEVEL_MAX] = AGE_MAX
  return arr
})()

// The whole-Age threshold at which `level` is reached. ageMilestone(0) === 0.
export function ageMilestone(level) {
  const n = clamp(Math.floor(level), LEVEL_MIN, LEVEL_MAX)
  return AGE_MILESTONES[n]
}

// Inverse of ageMilestone: the highest level whose milestone Age has already
// been reached.
export function levelForAge(age) {
  const a = clamp(Math.floor(age), 0, AGE_MAX)
  let lo = 0
  let hi = LEVEL_MAX
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (AGE_MILESTONES[mid] <= a) lo = mid
    else hi = mid - 1
  }
  return lo
}

export const REBIRTH_INITIAL = envInt('VITE_REBIRTH_INITIAL', 0)
export const REBIRTH_MIN = 0
export const REBIRTH_MAX = 5000
export const REBIRTH_LEVEL_BASE = 100 // requirement(rebirth) = REBIRTH_LEVEL_BASE * REBIRTH_LEVEL_RATIO ^ rebirth
export const REBIRTH_LEVEL_RATIO = 5

export const COINS_INITIAL = envInt('VITE_COINS_INITIAL', 0)
export const COINS_MIN = 0
export const COINS_MAX = 1_000_000_000_000

export const SPEED_PER_GAIN_INITIAL = 1
export const SPEED_PER_GAIN_MIN = 1
export const SPEED_PER_GAIN_MAX = 3500

// Continuous walking (movement input held) re-fires a Speed gain every
// this-many seconds — systems/speedGain.js.
export const WALK_GAIN_INTERVAL = 2

export function clamp(n, min, max) {
  return n < min ? min : n > max ? max : n
}

export function rebirthRequirement(rebirth) {
  return REBIRTH_LEVEL_BASE * Math.pow(REBIRTH_LEVEL_RATIO, rebirth)
}

// Where the given Age (Speed) sits between its last-crossed milestone and
// the next one, for the HUD level bar: `into` Age earned toward `span`
// (the gap between milestones) needed for the next Age-up, and `frac`
// (0..1) for the fill width. `total` is the player's whole Age and `needed`
// the whole-Age threshold that trips the next level. At LEVEL_MAX the bar
// reads full and `needed` equals `total`.
export function levelProgress(speed) {
  const level = levelForAge(speed)
  const total = Math.floor(speed)
  if (level >= LEVEL_MAX) {
    return { level, into: 0, span: 0, frac: 1, total, needed: total }
  }
  const prev = ageMilestone(level)
  const next = ageMilestone(level + 1)
  const into = total - prev
  const span = next - prev
  return {
    level,
    into,
    span,
    frac: clamp(span > 0 ? into / span : 1, 0, 1),
    total,
    needed: next,
  }
}

// Clicks still needed — at the given whole-number Speed gain per click — for
// `speed` to reach the next level. Drives the HUD level bar's "Next Age Up
// in: N Click(s)" caption. 0 once LEVEL_MAX is reached (nothing left to
// climb toward).
export function clicksToNextLevel(speed, gainPerClick) {
  const { level, total, needed } = levelProgress(speed)
  if (level >= LEVEL_MAX) return 0
  const perClick = gainPerClick > 0 ? gainPerClick : 1
  return Math.max(1, Math.ceil((needed - total) / perClick))
}

// The single source of truth for rebirth eligibility — the store's guard and
// the HUD button's visibility check both call this, so they can never disagree.
export function canAcceptRebirth(level, rebirth) {
  return rebirth < REBIRTH_MAX && level >= rebirthRequirement(rebirth)
}
