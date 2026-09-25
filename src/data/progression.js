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

export const SPEED_INITIAL = envInt('VITE_SPEED_INITIAL', 1)
export const SPEED_MIN = 1
export const SPEED_MAX = 1_000_000_000_000

// The player's physical walk speed (m/s), for the whole game. Fixed —
// unrelated to skate tier, level, or rebirth, and never changed by any
// system. Read directly by systems/playerMovement.js and used to seed
// systems/playerState.js's initial value. Unrelated to the Speed stat/level
// above.
export const PLAYER_MOVE_SPEED = 6

export const LEVEL_INITIAL = 1
export const LEVEL_MIN = 1
export const LEVEL_MAX = 50_000
export const SPEED_PER_LEVEL = 50 // level = floor(speed / SPEED_PER_LEVEL) + 1

export const REBIRTH_INITIAL = envInt('VITE_REBIRTH_INITIAL', 0)
export const REBIRTH_MIN = 0
export const REBIRTH_MAX = 5000
export const REBIRTH_LEVEL_STEP = 10 // requirement(rebirth) = (rebirth + 1) * REBIRTH_LEVEL_STEP

export const WINS_INITIAL = envInt('VITE_WINS_INITIAL', 0)
export const WINS_MIN = 0
export const WINS_MAX = 1_000_000_000_000

export const SPEED_PER_GAIN_INITIAL = 1
export const SPEED_PER_GAIN_MIN = 1
export const SPEED_PER_GAIN_MAX = 3500

// Continuous walking (movement input held) re-fires a Speed gain every
// this-many seconds — systems/speedGain.js.
export const WALK_GAIN_INTERVAL = 2

export function clamp(n, min, max) {
  return n < min ? min : n > max ? max : n
}

export function levelForSpeed(speed) {
  return clamp(Math.floor(speed / SPEED_PER_LEVEL) + 1, LEVEL_MIN, LEVEL_MAX)
}

export function rebirthRequirement(rebirth) {
  return (rebirth + 1) * REBIRTH_LEVEL_STEP
}

// Where the given Speed sits inside its current level, for the HUD level
// bar: `into` Speed earned toward `span` (SPEED_PER_LEVEL) needed for the
// next level, and `frac` (0..1) for the fill width. `total` is the player's
// whole Speed and `needed` the whole-Speed threshold that trips the next
// level. At LEVEL_MAX the bar reads full and `needed` equals `total`.
export function levelProgress(speed) {
  const level = levelForSpeed(speed)
  const total = Math.floor(speed)
  if (level >= LEVEL_MAX) {
    return { level, into: SPEED_PER_LEVEL, span: SPEED_PER_LEVEL, frac: 1, total, needed: total }
  }
  const into = Math.floor(speed - (level - LEVEL_MIN) * SPEED_PER_LEVEL)
  return {
    level,
    into,
    span: SPEED_PER_LEVEL,
    frac: clamp(into / SPEED_PER_LEVEL, 0, 1),
    total,
    needed: (level - LEVEL_MIN + 1) * SPEED_PER_LEVEL,
  }
}

// The single source of truth for rebirth eligibility — the store's guard and
// the HUD button's visibility check both call this, so they can never disagree.
export function canAcceptRebirth(level, rebirth) {
  return rebirth < REBIRTH_MAX && level >= rebirthRequirement(rebirth)
}
