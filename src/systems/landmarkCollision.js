import { FREE_BOOTH, SIGN_BOARD, SHOP, STATUE, PETS, LEADERBOARDS, TREES, BUSHES, ROCKS } from '../data/island.js'
import { ISLAND_SCALE } from '../data/world.js'

// Solid landmarks and large decor (trees/bushes/rocks) are static obstacles:
// the player collides with them and gets pushed out, same horizontal
// push-out as ageMachineCollision.js. Left out on purpose because they're
// walkover platforms, not solid bodies: SpawnPad, the Obby pads (the course
// only works if you can stand on them) and the Trampoline, which has its own
// wall + bounce handling in trampoline.js. Also left out: Flowers (too small to matter) and the enclosure
// curbs, which conveyor.js already documents as walkable, not blocking.
const OBSTACLES = [
  { x: FREE_BOOTH.x, z: FREE_BOOTH.z, radius: 1.6 },
  { x: SIGN_BOARD.x, z: SIGN_BOARD.z, radius: 1.5 },
  { x: SHOP.x, z: SHOP.z, radius: 2.0 },
  { x: STATUE.x, z: STATUE.z, radius: 1.1 },
  { x: PETS.x, z: PETS.z, radius: 1.1 },
  { x: PETS.x + 1.7, z: PETS.z - 1.6, radius: 0.9 },
  ...LEADERBOARDS.map((b) => ({ x: b.x, z: b.z, radius: 1.7 })),
  ...TREES.map((t) => ({ x: t.x, z: t.z, radius: 1.3 * t.scale })),
  ...BUSHES.map((b) => ({ x: b.x, z: b.z, radius: 0.75 * b.scale })),
  ...ROCKS.map((r) => ({ x: r.x, z: r.z, radius: 0.6 * r.scale })),
]

// Pushes (worldX, worldZ) out of any landmark/decor obstacle it overlaps,
// given the player's own radius (world metres). Local circles are authored
// pre-ISLAND_SCALE, same convention as ageMachineCollision.js.
export function resolveLandmarkCollision(worldX, worldZ, radius) {
  let x = worldX
  let z = worldZ
  for (const o of OBSTACLES) {
    const localRadius = o.radius + radius / ISLAND_SCALE
    const lx = x / ISLAND_SCALE
    const lz = z / ISLAND_SCALE
    const dx = lx - o.x
    const dz = lz - o.z
    const distSq = dx * dx + dz * dz
    if (distSq >= localRadius * localRadius || distSq < 1e-8) continue
    const dist = Math.sqrt(distSq)
    const push = (localRadius - dist) / dist
    x += dx * push * ISLAND_SCALE
    z += dz * push * ISLAND_SCALE
  }
  return { x, z }
}
