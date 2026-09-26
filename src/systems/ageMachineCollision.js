import { ALL_AGE_MACHINE_CENTERS } from '../data/area2.js'
import { ISLAND_SCALE } from '../data/world.js'

// Each Age Machine's pedestal (AgeMachine's base cylinder in
// IslandLandmarks.jsx) is a solid, static obstacle: the player collides
// with it and gets pushed out, rather than walking through it.
// terrainHeight.js's AGE_MACHINES_TOP_Y handles the vertical step onto the
// shared stand; this handles horizontal blocking around each machine.
// Radius matches the base cylinder's widest (bottom) radius, local units.
// Exported so Hud.jsx's Return button can place the player just outside
// this radius when they leave a machine, instead of relying on next frame's
// push-out (which no-ops right at the center — see the distSq guard below).
export const AGE_MACHINE_RADIUS = 0.9
// Hub machines first, then Area 2's (data/area2.js).
const AGE_MACHINE_CENTERS = ALL_AGE_MACHINE_CENTERS

// Pushes (worldX, worldZ) out of any age machine pedestal it overlaps, given
// the player's own radius (world metres). Local rects/circles are authored
// pre-ISLAND_SCALE, same convention as terrainHeight.js and conveyor.js.
export function resolveAgeMachineCollision(worldX, worldZ, radius) {
  let x = worldX
  let z = worldZ
  const localRadius = AGE_MACHINE_RADIUS + radius / ISLAND_SCALE
  for (const c of AGE_MACHINE_CENTERS) {
    const lx = x / ISLAND_SCALE
    const lz = z / ISLAND_SCALE
    const dx = lx - c.x
    const dz = lz - c.z
    const distSq = dx * dx + dz * dz
    if (distSq >= localRadius * localRadius || distSq < 1e-8) continue
    const dist = Math.sqrt(distSq)
    const push = (localRadius - dist) / dist
    x += dx * push * ISLAND_SCALE
    z += dz * push * ISLAND_SCALE
  }
  return { x, z }
}
