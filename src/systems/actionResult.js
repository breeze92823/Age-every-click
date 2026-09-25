import { playActionFail } from './sfx.js'

// Shared trigger for the top-center ActionResult HUD popup
// (components/hud/ActionResult.jsx) — a framework-free singleton. `id`
// increments on every call so Hud.jsx's poll can detect a fresh trigger
// even when back-to-back messages share the same text. Ported verbatim from
// Ice-Skate's systems/actionResult.js.
export const actionResultState = {
  text: '',
  success: true,
  id: 0,
}

export function showActionResult(text, success) {
  actionResultState.text = text
  actionResultState.success = success
  actionResultState.id++
  if (!success) playActionFail()
}
