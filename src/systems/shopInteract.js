import { SHOP, STATUE } from '../data/island.js'
import { ISLAND_SCALE } from '../data/world.js'
import { setInteractPrompt } from './interactPrompt.js'
import { useGameStore } from '../store/useGameStore.js'

// Bottom-center "Press E to Shop" prompt for the Shop stall (components/
// IslandLandmarks.jsx's Shop). Same shape as statueInteract.js: a single
// fresh E press while near it opens the Shop popup (Hud.jsx's ShopWindow)
// via the store's openShop, which also kicks off the stall's animation.
//
// Local space (pre-ISLAND_SCALE), same convention as landmarkCollision.js.
// Radius is past the stall's own 2.0 collision radius.
const PROMPT_RADIUS = 3.6

let wasHeld = false

export function syncShopInteractHeld(held) {
  wasHeld = held
}

// Called once per frame from playerMovement.js while on the island, before
// checkStatueInteract. The Shop and Statue sit close enough that their
// prompt radii overlap, so this only claims the prompt when the Shop is the
// nearer of the two, and returns true when it did — playerMovement.js then
// skips the Statue's check for this frame.
export function checkShopInteract(worldX, worldZ, interactHeld) {
  const pressed = interactHeld && !wasHeld
  wasHeld = interactHeld
  const lx = worldX / ISLAND_SCALE
  const lz = worldZ / ISLAND_SCALE
  const shopD2 = (lx - SHOP.x) ** 2 + (lz - SHOP.z) ** 2
  const statueD2 = (lx - STATUE.x) ** 2 + (lz - STATUE.z) ** 2
  if (shopD2 > PROMPT_RADIUS * PROMPT_RADIUS || statueD2 < shopD2) return false
  setInteractPrompt('Press E to Shop')
  if (pressed) useGameStore.getState().openShop()
  return true
}
