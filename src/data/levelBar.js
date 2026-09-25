// HUD level-bar tunables, ported verbatim from Ice-Skate's data/levelBar.js.
// The bar sits bottom-centre of the screen: a "<Speed> Speed" caption, a
// rounded track that fills yellow -> orange -> red as Speed climbs toward
// the next level, and "Level N" / "<into> / <span>" overlaid on it.
//
// LEVEL_BAR_ICON_SIZE/OVERHANG/URL are also shared by RebirthLevelBar.jsx
// for its own badge in the Rebirth confirm modal.

export const LEVEL_BAR_POLL_MS = 100

export const LEVEL_BAR_WIDTH = 704
export const LEVEL_BAR_HEIGHT = 80
export const LEVEL_BAR_MAX_VW = 70.4

export const LEVEL_BAR_BORDER = 6
export const LEVEL_BAR_TEXT_STROKE = 4

export const LEVEL_BAR_CAPTION_FONT_PX = 30
export const LEVEL_BAR_LABEL_FONT_PX = 34

export const LEVEL_BAR_ICON_SIZE = 136
export const LEVEL_BAR_ICON_OVERHANG = 0.44

export const LEVEL_BAR_BOTTOM = 28

export const LEVEL_BAR_TRANSITION_MS = 200

export const LEVEL_BAR_FILL_GRADIENT =
  'linear-gradient(180deg, #ffe24d 0%, #ff9d00 52%, #ff2d00 100%)'

export const LEVEL_BAR_STUD_PITCH = 20

export const LEVEL_BAR_RADIUS = 16

export const LEVEL_BAR_CAPTION_BAND =
  'linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0) 100%)'

export const LEVEL_BAR_REBIRTH_TEXT_COLOR = '#ff5fc4'

export const LEVEL_BAR_CAPTION_BAND_PAD_X = 52
export const LEVEL_BAR_CAPTION_BAND_PAD_Y = 4

export const LEVEL_BAR_ICON_URL = '/ui/action_popup.png'

export const REBIRTH_LEVEL_BAR_TOUCH_SCALE = 0.6
