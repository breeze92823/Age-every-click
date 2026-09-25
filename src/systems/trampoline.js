import { GROUND_Y, ISLAND_SCALE } from '../data/world.js'
import { TRAMPOLINE } from '../data/island.js'

// The island trampoline: a solid cylinder from the side (walked into, the
// player is pushed out) and a bounce pad from above. Consecutive bounces
// each rise BOUNCE_GROWTH times the last one, up to MAX_BOUNCE_HEIGHT;
// landing anywhere else resets the chain.

const FIRST_BOUNCE_HEIGHT = 3 // m, apex above the bed on the first bounce
const BOUNCE_GROWTH = 1.3
const MAX_BOUNCE_HEIGHT = 12 // m
const EDGE_TOLERANCE = 0.05 // m below the top that still counts as "above"

// Local (pre-ISLAND_SCALE) geometry matches IslandLandmarks.jsx's
// Trampoline: bed at 0.5 m, rim torus of tube radius 0.2 around `radius`.
const OUTER_RADIUS = (TRAMPOLINE.radius + 0.2) * ISLAND_SCALE
const CENTER_X = TRAMPOLINE.x * ISLAND_SCALE
const CENTER_Z = TRAMPOLINE.z * ISLAND_SCALE
export const TRAMPOLINE_TOP_Y = GROUND_Y + 0.525 * ISLAND_SCALE

let lastBounceHeight = 0
let lastBounceAt = -Infinity

// When the most recent bounce fired (performance.now() ms), so the view can
// dip the bed in sync.
export function getLastBounceAt() {
  return lastBounceAt
}

function overlaps(x, z, reach) {
  return Math.hypot(x - CENTER_X, z - CENTER_Z) < OUTER_RADIUS + reach
}

// Pushes the player out horizontally if they were below the top last frame,
// i.e. they're beside the trampoline rather than coming down onto it.
export function resolveTrampolineWall(prevY, p, radius) {
  if (prevY >= TRAMPOLINE_TOP_Y - EDGE_TOLERANCE) return
  const dx = p.x - CENTER_X
  const dz = p.z - CENTER_Z
  const dist = Math.hypot(dx, dz)
  const minDist = OUTER_RADIUS + radius
  if (dist >= minDist || dist < 1e-6) return
  p.x = CENTER_X + (dx / dist) * minDist
  p.z = CENTER_Z + (dz / dist) * minDist
}

// Surface height under the player if they're over the trampoline and were
// above its top last frame; null otherwise.
export function trampolineGroundAt(prevY, x, z) {
  if (prevY < TRAMPOLINE_TOP_Y - EDGE_TOLERANCE) return null
  return overlaps(x, z, 0) ? TRAMPOLINE_TOP_Y : null
}

// Upward launch speed for the next bounce in the chain; `gravity` is the
// magnitude (m/s^2) the player falls under.
export function bounceSpeed(gravity) {
  const height =
    lastBounceHeight > 0 ? Math.min(lastBounceHeight * BOUNCE_GROWTH, MAX_BOUNCE_HEIGHT) : FIRST_BOUNCE_HEIGHT
  lastBounceHeight = height
  lastBounceAt = performance.now()
  return Math.sqrt(2 * gravity * height)
}

export function resetBounceChain() {
  lastBounceHeight = 0
}
