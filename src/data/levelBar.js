// HUD level-bar tunables, ported from Ice-Skate's data/levelBar.js and
// restyled to this game's "Age" theme: a big "Age: N" heading above a
// pill-shaped bar reading "Next Age Up in: N Click(s)" that fills lime ->
// teal as Speed climbs toward the next level.
//
// LEVEL_BAR_ICON_SIZE/OVERHANG/URL, LEVEL_BAR_LABEL_FONT_PX and
// LEVEL_BAR_FILL_GRADIENT are also shared by RebirthLevelBar.jsx for its own
// badge/track in the Rebirth confirm modal — leave those as-is when
// restyling the main bar; LEVEL_BAR_AGE_FILL_GRADIENT below is the main
// bar's own, separate fill colour.

export const LEVEL_BAR_POLL_MS = 100

// Overall size of the main top-of-screen bar (LevelBar.jsx only — applied
// as a CSS transform: scale, not shared with RebirthLevelBar.jsx).
export const LEVEL_BAR_SCALE = 0.75

export const LEVEL_BAR_WIDTH = 704
export const LEVEL_BAR_HEIGHT = 80
export const LEVEL_BAR_MAX_VW = 70.4

export const LEVEL_BAR_BORDER = 6
export const LEVEL_BAR_TEXT_STROKE = 4

export const LEVEL_BAR_LABEL_FONT_PX = 34

export const LEVEL_BAR_ICON_SIZE = 136
export const LEVEL_BAR_ICON_OVERHANG = 0.44

export const LEVEL_BAR_TOP = 16

export const LEVEL_BAR_TRANSITION_MS = 200

// Duration of the "pop" scale animation played on the Age and
// clicks-remaining readouts whenever their number changes.
export const LEVEL_BAR_POP_MS = 260

// RebirthLevelBar.jsx's track fill — unrelated to the main bar's own colour
// below, kept separate so restyling one never touches the other.
export const LEVEL_BAR_FILL_GRADIENT =
  'linear-gradient(180deg, #ffe24d 0%, #ff9d00 52%, #ff2d00 100%)'

// Main Age bar's pill fill — left-to-right lime -> teal.
export const LEVEL_BAR_AGE_FILL_GRADIENT =
  'linear-gradient(90deg, #8CE64B 0%, #1FAE94 100%)'

export const LEVEL_BAR_STUD_PITCH = 20

export const LEVEL_BAR_ICON_URL = '/ui/action_popup.png'

export const REBIRTH_LEVEL_BAR_TOUCH_SCALE = 0.6

// "Age: N" heading above the bar.
export const LEVEL_BAR_TITLE_FONT_PX = 44
