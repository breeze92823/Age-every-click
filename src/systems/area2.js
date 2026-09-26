import { ISLAND_SCALE } from '../data/world.js'
import { AREA2_GATE, AFK_ZONE, BRIDGE, BRIDGE_RAIL_X, BRIDGE_RAIL_INSET } from '../data/area2.js'
import { player } from './playerState.js'
import { useGameStore } from '../store/useGameStore.js'
import { showActionResult } from './actionResult.js'
import { formatCompact } from './format.js'

// Area 2's gameplay rules (data/area2.js): the Rebirth-locked gate, the
// bridge railings, and the AFK zone's coin timer. Framework-free, same as
// the rest of systems/ — playerMovement.js and GameLoop.jsx drive it.

export function isArea2Unlocked(rebirth) {
  return rebirth >= AREA2_GATE.requiredRebirths
}

// How far past the wall line still counts as "at the gate" — a player
// already inside Area 2 (unlocked, then somehow relocked) is never yanked
// back across the whole island.
const GATE_DEPTH = 3
const GATE_HALF_THICKNESS = 0.2
const GATE_POPUP_COOLDOWN_MS = 2000
let lastGatePopupAt = 0

// Pushes the player (world position `p`, mutated) back out of the locked
// gate and keeps them between the bridge railings.
export function resolveArea2Walls(p, radius) {
  const r = radius / ISLAND_SCALE
  let lx = p.x / ISLAND_SCALE
  let lz = p.z / ISLAND_SCALE

  const wallX = AREA2_GATE.x - GATE_HALF_THICKNESS - r
  if (lx > wallX && lx < AREA2_GATE.x + GATE_DEPTH && !isArea2Unlocked(useGameStore.getState().rebirth)) {
    lx = wallX
    const now = performance.now()
    if (now - lastGatePopupAt > GATE_POPUP_COOLDOWN_MS) {
      lastGatePopupAt = now
      showActionResult(`Need ${AREA2_GATE.requiredRebirths} Rebirths for Area 2`, false)
    }
  }

  const [, z0, , z1] = BRIDGE.rect
  if (lx > BRIDGE_RAIL_X[0] && lx < BRIDGE_RAIL_X[1] && lz > z0 - 1 && lz < z1 + 1) {
    lz = Math.min(Math.max(lz, z0 + BRIDGE_RAIL_INSET + r), z1 - BRIDGE_RAIL_INSET - r)
  }

  p.x = lx * ISLAND_SCALE
  p.z = lz * ISLAND_SCALE
}

// Seconds spent standing in the AFK zone since entering it (or since the
// last payout). Leaving the zone resets it. Transient — never persisted.
export const afkState = { inside: false, elapsed: 0 }

export function afkSecondsLeft() {
  return Math.max(0, AFK_ZONE.intervalSec - afkState.elapsed)
}

export function stepAfkZone(dt) {
  const { currentScene, awardCoins } = useGameStore.getState()
  const [x0, z0, x1, z1] = AFK_ZONE.rect
  const lx = player.position.x / ISLAND_SCALE
  const lz = player.position.z / ISLAND_SCALE
  afkState.inside = currentScene === 'island' && lx >= x0 && lx <= x1 && lz >= z0 && lz <= z1
  if (!afkState.inside) {
    afkState.elapsed = 0
    return
  }
  afkState.elapsed += dt
  if (afkState.elapsed >= AFK_ZONE.intervalSec) {
    afkState.elapsed -= AFK_ZONE.intervalSec
    awardCoins(AFK_ZONE.rewardCoins)
    showActionResult(`+${formatCompact(AFK_ZONE.rewardCoins)} Coins`, true)
  }
}
