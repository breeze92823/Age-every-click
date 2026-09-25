import { ENCLOSURES, ENCLOSURE_BORDER } from '../data/island.js'
import { ISLAND_SCALE } from '../data/world.js'

// Metres per second a standing player is carried along the curb, in the same
// direction its chevrons visually scroll (see Island.jsx's CHEVRON_SPEED).
export const CONVEYOR_SPEED = 3.5

// The curb ring as a pinwheel of four non-overlapping bands, so the chevrons
// (and the push direction) never disagree at the corners. Directions run
// clockwise seen from above. Shared by Island.jsx (render strips) and
// conveyorPushAt below (gameplay), so the two can't drift apart.
export function curbStrips([x0, z0, x1, z1], b) {
  return [
    { rect: [x0, z0, x1 - b, z0 + b], dir: 0 },
    { rect: [x1 - b, z0, x1, z1 - b], dir: -Math.PI / 2 },
    { rect: [x0 + b, z1 - b, x1, z1], dir: Math.PI },
    { rect: [x0, z0 + b, x0 + b, z1], dir: Math.PI / 2 },
  ]
}

// World-space push velocity for a player standing at (worldX, worldZ), or
// null off the curb. Island.jsx's rects are authored pre-ISLAND_SCALE, so
// world position is divided down to that local space before testing, same
// as terrainHeight.js.
export function conveyorPushAt(worldX, worldZ) {
  const lx = worldX / ISLAND_SCALE
  const lz = worldZ / ISLAND_SCALE
  for (const rect of ENCLOSURES) {
    const [x0, z0, x1, z1] = rect
    if (lx < x0 || lx > x1 || lz < z0 || lz > z1) continue
    const inBed = lx > x0 + ENCLOSURE_BORDER && lx < x1 - ENCLOSURE_BORDER && lz > z0 + ENCLOSURE_BORDER && lz < z1 - ENCLOSURE_BORDER
    if (inBed) return null
    for (const { rect: [bx0, bz0, bx1, bz1], dir } of curbStrips(rect, ENCLOSURE_BORDER)) {
      if (lx >= bx0 && lx <= bx1 && lz >= bz0 && lz <= bz1) {
        return { x: Math.cos(dir) * CONVEYOR_SPEED, z: -Math.sin(dir) * CONVEYOR_SPEED }
      }
    }
  }
  return null
}
