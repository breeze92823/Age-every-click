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
export const PLAYER_MOVE_SPEED = 6

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
const AGE_GROWTH_RATIO = Math.pow(
  AGE_MAX / AGE_SEED_MILESTONES[AGE_SEED_LEVEL_MAX],
  1 / (LEVEL_MAX - AGE_SEED_LEVEL_MAX),
)

// The whole-Age threshold at which `level` is reached. ageMilestone(0) === 0.
export function ageMilestone(level) {
  const n = clamp(Math.floor(level), LEVEL_MIN, LEVEL_MAX)
  if (n <= AGE_SEED_LEVEL_MAX) return AGE_SEED_MILESTONES[n]
  if (n >= LEVEL_MAX) return AGE_MAX
  return Math.round(AGE_SEED_MILESTONES[AGE_SEED_LEVEL_MAX] * Math.pow(AGE_GROWTH_RATIO, n - AGE_SEED_LEVEL_MAX))
}

// Inverse of ageMilestone: the highest level whose milestone Age has already
// been reached.
export function levelForAge(age) {
  const a = clamp(Math.floor(age), 0, AGE_MAX)
  if (a < AGE_SEED_MILESTONES[AGE_SEED_LEVEL_MAX]) {
    let n = 0
    for (let i = AGE_SEED_LEVEL_MAX; i >= 0; i--) {
      if (a >= AGE_SEED_MILESTONES[i]) {
        n = i
        break
      }
    }
    return n
  }
  let n = AGE_SEED_LEVEL_MAX + Math.floor(Math.log(a / AGE_SEED_MILESTONES[AGE_SEED_LEVEL_MAX]) / Math.log(AGE_GROWTH_RATIO))
  n = clamp(n, AGE_SEED_LEVEL_MAX, LEVEL_MAX)
  // ageMilestone rounds, so the log-based estimate can land one level off —
  // nudge it back onto the milestone that actually brackets `a`.
  while (n < LEVEL_MAX && ageMilestone(n + 1) <= a) n++
  while (n > AGE_SEED_LEVEL_MAX && ageMilestone(n) > a) n--
  return n
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
