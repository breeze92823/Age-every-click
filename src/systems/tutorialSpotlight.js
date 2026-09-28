import { create } from 'zustand'

// Full-screen dim overlay that leaves one HUD element (matched by its
// data-tutorial-target attribute, e.g. ToolbarButton's targetId prop) fully
// lit, plus a rotatable action_popup.png arrow pointing at it — see
// components/hud/TutorialSpotlight.jsx. Driven by systems/tutorial.js;
// setTutorialSpotlight(null) hides it. `rotation` is degrees, clockwise,
// applied to the arrow image on top of its own default orientation — tune
// per target since the image's built-in point direction is fixed.
export const useTutorialSpotlight = create(() => ({ target: null, rotation: 0 }))

export function setTutorialSpotlight(target, rotation = 0) {
  useTutorialSpotlight.setState({ target, rotation })
}
