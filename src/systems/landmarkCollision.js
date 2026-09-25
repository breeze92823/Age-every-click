import {
  FREE_BOOTH,
  SIGN_BOARD,
  SHOP,
  STATUE,
  WIN_SIGN,
  PETS,
  LEADERBOARDS,
  TREES,
  BUSHES,
  ROCKS,
  OBBY,
} from '../data/island.js'
import { ISLAND_SCALE } from '../data/world.js'

// Solid landmarks and large decor (trees/bushes/rocks) are static obstacles:
// the player collides with them and gets pushed out, same horizontal
// push-out as ageMachineCollision.js. Left out on purpose because they're
// walkover platforms, not solid bodies: SpawnPad and the Trampoline, which
// has its own wall + bounce handling in trampoline.js. Also left out:
// Flowers (too small to matter) and the enclosure curbs, which conveyor.js
// already documents as walkable, not blocking.
const OBSTACLES = [
  { x: FREE_BOOTH.x, z: FREE_BOOTH.z, radius: 1.6 },
  { x: SIGN_BOARD.x, z: SIGN_BOARD.z, radius: 1.5 },
  { x: SHOP.x, z: SHOP.z, radius: 2.0 },
  { x: STATUE.x, z: STATUE.z, radius: 1.1 },
  ...WIN_SIGN.poleDx.map((dx) => ({
    x: WIN_SIGN.x + dx * WIN_SIGN.scale * Math.cos(WIN_SIGN.yaw),
    z: WIN_SIGN.z - dx * WIN_SIGN.scale * Math.sin(WIN_SIGN.yaw),
    radius: 0.25 * WIN_SIGN.scale,
  })),
  { x: PETS.x, z: PETS.z, radius: 1.1 },
  { x: PETS.x + 1.7, z: PETS.z - 1.6, radius: 0.9 },
  ...LEADERBOARDS.map((b) => ({ x: b.x, z: b.z, radius: 1.7 })),
  ...TREES.map((t) => ({ x: t.x, z: t.z, radius: 1.3 * t.scale })),
  ...BUSHES.map((b) => ({ x: b.x, z: b.z, radius: 0.75 * b.scale })),
  ...ROCKS.map((r) => ({ x: r.x, z: r.z, radius: 0.6 * r.scale })),
]

// The Obby entry pads (Impossible Bridge/Stud Jumps/Tsunami Escape) are
// square, so they get an axis-aligned box instead of the circle
// approximation above — a 1.2 half-extent matching the pad's own 2.4x2.4
// footprint (IslandLandmarks.jsx's Obby() box), well under scenePortals.js's
// PORTAL_RADIUS (2.8) so the hold-E prompt still arms before the player is
// stopped, since nothing requires actually standing on the pad.
const BOX_OBSTACLES = [...OBBY.pads.map((p) => ({ x: OBBY.x, z: p.z, halfX: 1.2, halfZ: 1.2 }))]

// Pushes (worldX, worldZ) out of any landmark/decor obstacle it overlaps,
// given the player's own radius (world metres). Local circles/boxes are
// authored pre-ISLAND_SCALE, same convention as ageMachineCollision.js.
export function resolveLandmarkCollision(worldX, worldZ, radius) {
  let x = worldX
  let z = worldZ
  const r = radius / ISLAND_SCALE
  for (const o of OBSTACLES) {
    const localRadius = o.radius + r
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
  // Box obstacles are resolved the standard "expand by player radius, push
  // out along the shallower axis" way — treating the player as a point
  // against the expanded box is a close enough approximation of a circle
  // vs. box test for how small `r` is next to these pads.
  for (const o of BOX_OBSTACLES) {
    const halfX = o.halfX + r
    const halfZ = o.halfZ + r
    const lx = x / ISLAND_SCALE
    const lz = z / ISLAND_SCALE
    const dx = lx - o.x
    const dz = lz - o.z
    if (Math.abs(dx) >= halfX || Math.abs(dz) >= halfZ) continue
    const penX = halfX - Math.abs(dx)
    const penZ = halfZ - Math.abs(dz)
    if (penX < penZ) {
      x += Math.sign(dx || 1) * penX * ISLAND_SCALE
    } else {
      z += Math.sign(dz || 1) * penZ * ISLAND_SCALE
    }
  }
  return { x, z }
}
