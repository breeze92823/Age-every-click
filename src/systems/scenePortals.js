import { OBBY } from '../data/island.js'
import { ISLAND_SCALE, SPAWN } from '../data/world.js'
import { SPAWN as BONUS_SPAWN } from '../data/bonusBridge.js'
import { EXIT_PAD as STUD_JUMPS_EXIT_PAD, SPAWN as STUD_JUMPS_SPAWN } from '../data/studJumpsScene.js'
import { EXIT_PAD as TSUNAMI_EXIT_PAD, SPAWN as TSUNAMI_SPAWN } from '../data/tsunamiScene.js'

// One-way triggers, checked each frame in playerMovement.js: the Impossible
// Bridge, Stud Jumps and Tsunami Escape obby pads each send the player into
// their own scene, and the exit pad on that scene's start platform sends
// them back to the island's SPAWN. The Bonus Scene has no branch here for
// its own exit pad — systems/bonusBridge.js's stepBonusBridge runs first
// each frame and already returns to island (with a payout) when the player
// reaches it, so this never gets a chance to fire for that pad.

const IMPOSSIBLE_BRIDGE = OBBY.pads.find((p) => p.name === 'Impossible Bridge')
const STUD_JUMPS = OBBY.pads.find((p) => p.name === 'Stud Jumps')
const TSUNAMI_ESCAPE = OBBY.pads.find((p) => p.name === 'Tsunami Escape')

// Local space (pre-ISLAND_SCALE), same convention as landmarkCollision.js:
// OBBY's pads are authored in the island's scaled group, so worldX/worldZ
// need dividing by ISLAND_SCALE before comparing against these.
const TO_BONUS = { x: OBBY.x, z: IMPOSSIBLE_BRIDGE.z, radius: 1.3 }
const TO_STUD_JUMPS = { x: OBBY.x, z: STUD_JUMPS.z, radius: 1.3 }
const TO_TSUNAMI = { x: OBBY.x, z: TSUNAMI_ESCAPE.z, radius: 1.3 }

// Returns { scene, spawn } to teleport into this frame, or null if the
// player isn't standing on any trigger.
export function checkScenePortal(worldX, worldZ, currentScene) {
  if (currentScene === 'island') {
    const lx = worldX / ISLAND_SCALE
    const lz = worldZ / ISLAND_SCALE
    const dxBonus = lx - TO_BONUS.x
    const dzBonus = lz - TO_BONUS.z
    if (dxBonus * dxBonus + dzBonus * dzBonus <= TO_BONUS.radius * TO_BONUS.radius) {
      return { scene: 'bonus', spawn: BONUS_SPAWN }
    }
    const dxStud = lx - TO_STUD_JUMPS.x
    const dzStud = lz - TO_STUD_JUMPS.z
    if (dxStud * dxStud + dzStud * dzStud <= TO_STUD_JUMPS.radius * TO_STUD_JUMPS.radius) {
      return { scene: 'studJumps', spawn: STUD_JUMPS_SPAWN }
    }
    const dxTsunami = lx - TO_TSUNAMI.x
    const dzTsunami = lz - TO_TSUNAMI.z
    if (dxTsunami * dxTsunami + dzTsunami * dzTsunami <= TO_TSUNAMI.radius * TO_TSUNAMI.radius) {
      return { scene: 'tsunami', spawn: TSUNAMI_SPAWN }
    }
  } else if (currentScene === 'studJumps') {
    const half = STUD_JUMPS_EXIT_PAD.size / 2
    if (Math.abs(worldX - STUD_JUMPS_EXIT_PAD.x) <= half && Math.abs(worldZ - STUD_JUMPS_EXIT_PAD.z) <= half) {
      return { scene: 'island', spawn: SPAWN }
    }
  } else if (currentScene === 'tsunami') {
    const half = TSUNAMI_EXIT_PAD.size / 2
    if (Math.abs(worldX - TSUNAMI_EXIT_PAD.x) <= half && Math.abs(worldZ - TSUNAMI_EXIT_PAD.z) <= half) {
      return { scene: 'island', spawn: SPAWN }
    }
  }
  return null
}
