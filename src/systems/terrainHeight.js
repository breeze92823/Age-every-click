import { GROUND_Y, ISLAND_SCALE } from '../data/world.js'
import { ENCLOSURES, ENCLOSURE_BORDER, CURB_HEIGHT, BED_DEPTH, AGE_MACHINES, GRASS_RECTS } from '../data/island.js'
import { AREA2_GRASS_RECTS, AGE_MACHINE_STANDS, BRIDGE } from '../data/area2.js'

// The curb ring around each grass enclosure is a physical step, not just a
// texture: playerMovement.js reads this instead of a flat GROUND_Y so
// walking onto the ring lifts the player onto it (auto-step, no jump
// needed) rather than clipping through the raised mesh.
//
// Island.jsx's rects/heights are authored pre-ISLAND_SCALE ("local" space);
// its group scales x/z directly and scales y about GROUND_Y, so a local
// height h maps to world GROUND_Y + (h - GROUND_Y) * ISLAND_SCALE. Player
// position is unscaled world space, so x/z go the other way (divide by
// ISLAND_SCALE) before testing against the local-space rects.
const CURB_TOP_Y = GROUND_Y + CURB_HEIGHT * ISLAND_SCALE
const BED_TOP_Y = GROUND_Y + BED_DEPTH * ISLAND_SCALE
const BRIDGE_TOP_Y = GROUND_Y + BRIDGE.deckHeight * ISLAND_SCALE
// Area 2's machine stand (the hub's is handled by AGE_MACHINES_* below).
const AREA2_STAND = AGE_MACHINE_STANDS[1]

function inRect(lx, lz, [x0, z0, x1, z1]) {
  return lx >= x0 && lx <= x1 && lz >= z0 && lz <= z1
}

// Age Machines stand: a raised platform the player should step onto rather
// than pass through, same auto-step treatment as the enclosure curbs.
const AGE_MACHINES_HALF_W = (AGE_MACHINES.colors.length * AGE_MACHINES.spacing + 1) / 2
const AGE_MACHINES_HALF_D = AGE_MACHINES.standDepth / 2
// Exported so IslandLandmarks.jsx can teleport the player onto this same
// stand top when they enter a machine, without re-deriving the math.
export const AGE_MACHINES_TOP_Y = GROUND_Y + AGE_MACHINES.standHeight * ISLAND_SCALE

// True past the island's grass edge — no ground there, just open air down
// to the water, so playerMovement.js lets gravity carry the player off it.
function offIsland(lx, lz) {
  for (const [x0, z0, x1, z1] of GRASS_RECTS) {
    if (lx >= x0 && lx <= x1 && lz >= z0 && lz <= z1) return false
  }
  for (const r of AREA2_GRASS_RECTS) if (inRect(lx, lz, r)) return false
  return true
}

export function terrainHeightAt(worldX, worldZ) {
  const lx = worldX / ISLAND_SCALE
  const lz = worldZ / ISLAND_SCALE
  for (const [x0, z0, x1, z1] of ENCLOSURES) {
    if (lx < x0 || lx > x1 || lz < z0 || lz > z1) continue
    const inBed = lx > x0 + ENCLOSURE_BORDER && lx < x1 - ENCLOSURE_BORDER && lz > z0 + ENCLOSURE_BORDER && lz < z1 - ENCLOSURE_BORDER
    return inBed ? BED_TOP_Y : CURB_TOP_Y
  }
  if (
    lx >= -AGE_MACHINES_HALF_W &&
    lx <= AGE_MACHINES_HALF_W &&
    lz >= AGE_MACHINES.z - AGE_MACHINES_HALF_D &&
    lz <= AGE_MACHINES.z + AGE_MACHINES_HALF_D
  ) {
    return AGE_MACHINES_TOP_Y
  }
  if (inRect(lx, lz, AREA2_STAND.rect)) return AREA2_STAND.topY
  if (inRect(lx, lz, BRIDGE.rect)) return BRIDGE_TOP_Y
  return offIsland(lx, lz) ? -Infinity : GROUND_Y
}
