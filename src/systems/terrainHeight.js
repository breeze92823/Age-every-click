import { GROUND_Y, ISLAND_SCALE } from '../data/world.js'
import { ENCLOSURES, ENCLOSURE_BORDER, CURB_HEIGHT, BED_DEPTH, AGE_MACHINES } from '../data/island.js'

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

// Age Machines stand: a raised platform the player should step onto rather
// than pass through, same auto-step treatment as the enclosure curbs.
const AGE_MACHINES_HALF_W = (AGE_MACHINES.colors.length * AGE_MACHINES.spacing + 1) / 2
const AGE_MACHINES_HALF_D = AGE_MACHINES.standDepth / 2
// Exported so IslandLandmarks.jsx can teleport the player onto this same
// stand top when they enter a machine, without re-deriving the math.
export const AGE_MACHINES_TOP_Y = GROUND_Y + AGE_MACHINES.standHeight * ISLAND_SCALE

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
  return GROUND_Y
}
