import { create } from 'zustand'

// Shared "Press E to ..." HUD prompt for the island's obby entry pads
// (Impossible Bridge, Stud Jumps, Tsunami Escape) — see
// systems/scenePortals.js, the only caller.
export const useInteractPrompt = create(() => ({ label: null }))

let current = null

export function setInteractPrompt(label) {
  if (current === label) return
  current = label
  useInteractPrompt.setState({ label })
}
