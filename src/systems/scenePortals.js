import { OBBY } from '../data/island.js'
import { ISLAND_SCALE, SPAWN, SPAWN_FACING } from '../data/world.js'
import { SPAWN as BONUS_SPAWN, SPAWN_FACING as BONUS_SPAWN_FACING } from '../data/bonusBridge.js'
import { EXIT_PAD as STUD_JUMPS_EXIT_PAD, SPAWN as STUD_JUMPS_SPAWN } from '../data/studJumpsScene.js'
import { EXIT_PAD as TSUNAMI_EXIT_PAD, SPAWN as TSUNAMI_SPAWN } from '../data/tsunamiScene.js'
import { setInteractPrompt } from './interactPrompt.js'

// One-way triggers, checked each frame in playerMovement.js: the Impossible
// Bridge, Stud Jumps and Tsunami Escape obby pads each send the player into
// their own scene, and the exit pad on that scene's start platform sends
// them back to the island's SPAWN. The Bonus Scene has no branch here for
// its own exit pad — systems/bonusBridge.js's stepBonusBridge runs first
// each frame and already returns to island (with a payout) when the player
// reaches it, so this never gets a chance to fire for that pad.
//
// Entering from the island is gated behind holding E (interactHeld, from
// playerMovement.js) for HOLD_SECONDS rather than firing the instant the
// player steps onto the pad — standing on a pad only arms
// systems/interactPrompt.js's HUD prompt, and its progress field drives the
// hold-ring animation while E is held. The return trips (obby -> island exit
// pads, and the Bonus Scene's own reward/finish pads) stay collide-triggered,
// unchanged.

const IMPOSSIBLE_BRIDGE = OBBY.pads.find((p) => p.name === 'Impossible Bridge')
const STUD_JUMPS = OBBY.pads.find((p) => p.name === 'Stud Jumps')
const TSUNAMI_ESCAPE = OBBY.pads.find((p) => p.name === 'Tsunami Escape')

// Local space (pre-ISLAND_SCALE), same convention as landmarkCollision.js:
// OBBY's pads are authored in the island's scaled group, so worldX/worldZ
// need dividing by ISLAND_SCALE before comparing against these. Radius is
// well past the pads' own 2.4x2.4 footprint (island.js's Obby() box) so the
// "Hold E" prompt shows several strides out — bigger than the pads' 4-unit
// spacing is fine too, since checkScenePortal always picks whichever pad is
// nearest, so overlapping approach zones never show the wrong prompt.
const PORTAL_RADIUS = 2.8
const HOLD_SECONDS = 2 // how long E/USE must be held on a pad before it triggers, matching Ice-Skate's HOLD_MS
const PORTALS = [
  { x: OBBY.x, z: IMPOSSIBLE_BRIDGE.z, label: 'Hold E to Enter Impossible Bridge', scene: 'bonus', spawn: BONUS_SPAWN, facing: BONUS_SPAWN_FACING },
  { x: OBBY.x, z: STUD_JUMPS.z, label: 'Hold E to Enter Stud Jumps', scene: 'studJumps', spawn: STUD_JUMPS_SPAWN },
  { x: OBBY.x, z: TSUNAMI_ESCAPE.z, label: 'Hold E to Enter Tsunami Escape', scene: 'tsunami', spawn: TSUNAMI_SPAWN },
]

// Which portal's hold is currently in progress, and how far into
// HOLD_SECONDS it's gotten — module-level rather than per-call state since
// checkScenePortal is called fresh every frame from playerMovement.js.
let holdScene = null
let holdElapsed = 0

// Returns { scene, spawn, facing? } to teleport into this frame, or null if
// the player isn't near any trigger (or is, but hasn't held E long enough
// yet for an island entry pad). facing is only set where a scene wants
// something other than resetPlayer's default (Math.PI).
export function checkScenePortal(worldX, worldZ, currentScene, interactHeld, dt) {
  if (currentScene === 'island') {
    const lx = worldX / ISLAND_SCALE
    const lz = worldZ / ISLAND_SCALE
    let nearest = null
    let nearestDistSq = PORTAL_RADIUS * PORTAL_RADIUS
    for (const portal of PORTALS) {
      const dx = lx - portal.x
      const dz = lz - portal.z
      const distSq = dx * dx + dz * dz
      if (distSq <= nearestDistSq) {
        nearest = portal
        nearestDistSq = distSq
      }
    }
    if (nearest) {
      // Reset the hold clock whenever E isn't down, or it's down but aimed
      // at a different pad than the one already being held.
      if (!interactHeld || holdScene !== nearest.scene) {
        holdScene = interactHeld ? nearest.scene : null
        holdElapsed = 0
      }
      if (interactHeld) {
        holdElapsed += dt
        if (holdElapsed >= HOLD_SECONDS) {
          holdScene = null
          holdElapsed = 0
          setInteractPrompt(null)
          return { scene: nearest.scene, spawn: nearest.spawn, facing: nearest.facing }
        }
      }
      setInteractPrompt(nearest.label, holdElapsed / HOLD_SECONDS)
      return null
    }
    holdScene = null
    holdElapsed = 0
    setInteractPrompt(null)
  } else if (currentScene === 'studJumps') {
    const half = STUD_JUMPS_EXIT_PAD.size / 2
    if (Math.abs(worldX - STUD_JUMPS_EXIT_PAD.x) <= half && Math.abs(worldZ - STUD_JUMPS_EXIT_PAD.z) <= half) {
      return { scene: 'island', spawn: SPAWN, facing: SPAWN_FACING }
    }
  } else if (currentScene === 'tsunami') {
    const half = TSUNAMI_EXIT_PAD.size / 2
    if (Math.abs(worldX - TSUNAMI_EXIT_PAD.x) <= half && Math.abs(worldZ - TSUNAMI_EXIT_PAD.z) <= half) {
      return { scene: 'island', spawn: SPAWN, facing: SPAWN_FACING }
    }
  }
  return null
}
