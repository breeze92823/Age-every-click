import { STATUE } from '../data/island.js'
import { ISLAND_SCALE } from '../data/world.js'
import { setInteractPrompt } from './interactPrompt.js'
import { useGameStore } from '../store/useGameStore.js'

// Bottom-center "Press E to Interact" prompt for the Statue (components/
// IslandLandmarks.jsx's Statue). Unlike scenePortals.js's hold-to-enter obby
// pads, a single fresh E press while near it opens the Lucky Wheel popup
// (components/hud/LuckyWheel.jsx) via the store's openWheel.
//
// Local space (pre-ISLAND_SCALE), same convention as landmarkCollision.js.
// Radius is past the statue's own 1.1 collision radius (landmarkCollision.js)
// so the prompt shows a stride or two before the player is stopped by it.
const PROMPT_RADIUS = 5

// Previous frame's E state, so only a fresh press (not E already held on the
// way in, or held through closing the wheel) opens it. playerMovement.js
// keeps this current on the frames it skips checkStatueInteract.
let wasHeld = false

export function syncStatueInteractHeld(held) {
  wasHeld = held
}

// Called once per frame from playerMovement.js while on the island, after
// checkScenePortal has already cleared/armed the shared prompt for the obby
// pads. Only touches the prompt on the positive (near statue) case — the
// negative case is left to playerMovement.js's own per-frame
// setInteractPrompt(null) reset and checkScenePortal's own clearing, so this
// never clobbers a portal prompt that's also active this frame.
export function checkStatueInteract(worldX, worldZ, interactHeld) {
  const pressed = interactHeld && !wasHeld
  wasHeld = interactHeld
  const lx = worldX / ISLAND_SCALE
  const lz = worldZ / ISLAND_SCALE
  const dx = lx - STATUE.x
  const dz = lz - STATUE.z
  if (dx * dx + dz * dz <= PROMPT_RADIUS * PROMPT_RADIUS) {
    setInteractPrompt('Press E to Interact')
    if (pressed) useGameStore.getState().openWheel()
  }
}
