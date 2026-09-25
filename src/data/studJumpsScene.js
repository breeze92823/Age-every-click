import { GROUND_Y } from './world.js'

// Layout for the Stud Jumps obby, entered from OBBY's Stud Jumps pad: a
// lavender start platform with a rainbow staircase climbing toward -Z, each
// step rising "N Studs" above the last. Plain world metres (no
// ISLAND_SCALE), same convention as bonusBridge.js. Rects are [x0, z0, x1, z1].

// Metres of rise per stud. The jump apex is ~1.28 m (JUMP_SPEED/GRAVITY in
// playerMovement.js), so the 14-stud top step (~1.2 m) is still reachable.
export const STUD_HEIGHT = 0.085
export const BLOCK_BOTTOM = GROUND_Y - 1.6

export const START_RECT = [-8, -6, 8, 8]
const STAIR_X = [-1, 7]
const STEP_DEPTH = 1.8
const FIRST_STUDS = 2
const LAST_STUDS = 14
// Checkpoint flags: touching one pays out and sends the player back to the
// island. Positioned near each rewarded step's outer corner — see
// components/StudJumpsScene.jsx's CheckpointFlag for the matching visual.
const REWARDS = { 11: 100, 12: 110, 13: 125, 14: 150 }
const FLAG_OFFSET_X = 0.7
export const FLAG_RADIUS = 0.6

export const STEPS = []
{
  let top = GROUND_Y
  let z = START_RECT[1]
  for (let studs = FIRST_STUDS; studs <= LAST_STUDS; studs++) {
    top += studs * STUD_HEIGHT
    const t = (studs - FIRST_STUDS) / (LAST_STUDS - FIRST_STUDS)
    const [x0, z0, x1, z1] = [STAIR_X[0], z - STEP_DEPTH, STAIR_X[1], z]
    const reward = REWARDS[studs] ?? 0
    STEPS.push({
      studs,
      rect: [x0, z0, x1, z1],
      top,
      // Red through violet to pink, like the reference staircase.
      hue: t * 0.86,
      reward,
      flag: reward ? { x: x1 - FLAG_OFFSET_X, z: (z0 + z1) / 2 } : null,
    })
    z -= STEP_DEPTH
  }
}

export const EXIT_PAD = { x: -5, z: 5, size: 1.6 }
export const CHEAP_SIGN = { x: 1.6, z: -4.6 }
export const SPAWN = { x: 0, y: GROUND_Y, z: 3 }
export const FALL_RESET_Y = GROUND_Y - 15
