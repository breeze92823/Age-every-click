import { create } from 'zustand'

// Bottom-center tutorial tip bar (TutorialHint, components/hud/TutorialHint.jsx).
// systems/tutorial.js drives this as the player progresses through the
// onboarding steps — starts empty until it installs. `highlight` is an
// optional substring of `text` (e.g. "Coins!", "Rebirth") TutorialHint
// renders in yellow instead of white.
export const useTutorialHint = create(() => ({ text: null, highlight: null }))

export function setTutorialHint(text, highlight = null) {
  useTutorialHint.setState({ text, highlight })
}
