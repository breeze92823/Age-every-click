import { create } from 'zustand'

// Floating arrow trail pointing the player toward a target (ObjectiveArrow,
// components/ObjectiveArrowTrail.jsx). Hidden until systems/tutorial.js
// (or any other caller) sets a target; setObjectiveTarget(null) hides it
// again.
export const useObjectiveArrow = create(() => ({ target: null }))

export function setObjectiveTarget(target) {
  useObjectiveArrow.setState({ target })
}
