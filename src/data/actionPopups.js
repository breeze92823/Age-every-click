// Speed-gain popup tunables, ported verbatim from Ice-Skate's
// data/actionPopups.js. Every gain tick (here: every click) spawns one of
// these — the public/ui/action_popup.png badge with a "+N" readout — near
// the player. Simulated by systems/actionPopups.js, drawn by
// components/hud/ActionPopups.jsx as DOM siblings of the canvas.

export const ACTION_POPUP_POOL_SIZE = 14

export const ACTION_POPUP_LIFETIME = 0.95

export const ACTION_POPUP_FADE_IN = 0.09

export const ACTION_POPUP_POP_T = 0.24
export const ACTION_POPUP_POP_SCALE_FROM = 0.25
export const ACTION_POPUP_POP_OVERSHOOT = 2.4
export const ACTION_POPUP_HOP = 0.05

export const ACTION_POPUP_FADE_OUT_START = 0.55

export const ACTION_POPUP_ANCHOR_HEIGHT = 1.3

export const ACTION_POPUP_SPREAD_X = 0.16
export const ACTION_POPUP_SPREAD_Y = 0.12

export const ACTION_POPUP_TARGET_Y = -0.95
export const ACTION_POPUP_CENTER_PULL = 0.7

export const ACTION_POPUP_IMAGE_SIZE = 120
export const ACTION_POPUP_FONT_SIZE = 40

export const ACTION_POPUP_IMAGE_URL = '/ui/action_popup.png'
