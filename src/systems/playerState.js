import { PLAYER_MOVE_SPEED } from '../data/progression.js'

// The player singleton. Mutated in place, never reallocated, so the frame
// loop can read it without a React subscription.
export const player = {
  // Capsule base (feet) in world space, +Y up.
  position: { x: 0, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
  grounded: true,
  facing: Math.PI, // yaw the character model faces, radians
  moveSpeed: PLAYER_MOVE_SPEED, // m/s ground speed, fixed for the whole game
  dims: { radius: 0.4, height: 1.8 },
}

export function resetPlayer(spawn = { x: 0, y: 0, z: 0 }, facing = Math.PI) {
  player.position.x = spawn.x
  player.position.y = spawn.y
  player.position.z = spawn.z
  player.velocity.x = 0
  player.velocity.y = 0
  player.velocity.z = 0
  player.grounded = true
  player.facing = facing
}
