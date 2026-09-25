// Level layout is data, not a Blender file. The old flat ground plane is
// now the water surface, with the hub island rising out of it — the
// walkable surface the player actually stands on. What sits on the island
// lives in data/island.js.

export const WATER_Y = 0
export const WATER_WIDTH = 200
export const WATER_DEPTH = 200

export const ISLAND_HEIGHT = 1 // island top sits this far above the water
export const ISLAND_WIDTH = 64
export const ISLAND_DEPTH = 64

// Walkable surface height/footprint — playerMovement.js clamps to this
// directly, same flat-plane approach as before, just raised onto the island.
export const GROUND_Y = WATER_Y + ISLAND_HEIGHT
export const GROUND_WIDTH = ISLAND_WIDTH
export const GROUND_DEPTH = ISLAND_DEPTH

export const SPAWN = { x: 0, y: GROUND_Y, z: -9 }
