import { create } from 'zustand'

// Shared "Press E to ..." HUD prompt. Callers: systems/scenePortals.js for
// the island's obby entry pads (Impossible Bridge, Stud Jumps, Tsunami
// Escape) — progress is 0..1, how far through the hold-to-enter gate the
// current E/USE press is — and systems/statueInteract.js for the Statue,
// which is proximity-only and never sets progress.
export const useInteractPrompt = create(() => ({ label: null, progress: 0 }))

let currentLabel = null
let currentProgress = 0

export function setInteractPrompt(label, progress = 0) {
  if (currentLabel === label && currentProgress === progress) return
  currentLabel = label
  currentProgress = progress
  useInteractPrompt.setState({ label, progress })
}
