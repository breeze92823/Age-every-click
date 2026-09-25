// Sound-effect data, ported from Ice-Skate's data/sfx.js. Real audio files
// where noted (copied from Ice-Skate's public/audio/); drop replacements at
// these paths and Vite serves them as-is. Every path/constant here is wired
// into systems/sfx.js even where nothing in this project calls the matching
// play function yet (e.g. the laser/wall sounds — there is no laser or
// destructible wall in this project either) — kept for parity.

export const LASER_FIRE_SOUND_URL = '/audio/laser_fire.mp3'
export const LASER_FIRE_GAIN = 0.12

export const LASER_BEAM_SOUND_URL = '/audio/laser_beam.mp3'
export const LASER_BEAM_GAIN = 0.09
export const LASER_BEAM_FADE_IN = 0.04
export const LASER_BEAM_FADE_OUT = 0.06

// One-shot fired every time a click grants Speed. Pitched into the
// 1.4-2.8kHz range so it stays clear of laser_beam.mp3's sub-800Hz energy.
export const SPEED_GAIN_SOUND_URL = '/audio/power_gain.mp3'
export const SPEED_GAIN_GAIN = 0.135

// One-shot fired every time the store's `level` rises. No real file dropped
// yet, so systems/sfx.js's playLevelUp() synthesizes it via WebAudio.
export const LEVEL_UP_SOUND_URL = '/audio/level_up.mp3'
export const LEVEL_UP_GAIN = 0.12

export const LEVEL_UP_SYNTH_NOTES_HZ = [523.25, 659.25, 783.99, 1046.5] // C5 E5 G5 C6
export const LEVEL_UP_SYNTH_NOTE_GAP_S = 0.055
export const LEVEL_UP_SYNTH_ATTACK_S = 0.006
export const LEVEL_UP_SYNTH_DECAY_S = 0.22
export const LEVEL_UP_SYNTH_SHIMMER_RATIO = 2.01
export const LEVEL_UP_SYNTH_SHIMMER_GAIN = 0.18

// One-shot fired whenever systems/actionResult.js's showActionResult() is
// called with success=false. No real file dropped yet, so
// playActionFail() synthesizes it.
export const ACTION_FAIL_SOUND_URL = '/audio/action_fail.mp3'
export const ACTION_FAIL_GAIN = 0.14

export const ACTION_FAIL_SYNTH_NOTES_HZ = [220, 164.81] // A3 down to E3
export const ACTION_FAIL_SYNTH_NOTE_GAP_S = 0.09
export const ACTION_FAIL_SYNTH_ATTACK_S = 0.004
export const ACTION_FAIL_SYNTH_DECAY_S = 0.16

// Fired on every HUD button press. No real file dropped yet, so
// playButtonClick() synthesizes a short "tick".
export const BUTTON_CLICK_SOUND_URL = '/audio/button_click.mp3'
export const BUTTON_CLICK_GAIN = 0.075

export const BUTTON_CLICK_SYNTH_FREQ_HZ = 1050
export const BUTTON_CLICK_SYNTH_ATTACK_S = 0.002
export const BUTTON_CLICK_SYNTH_DECAY_S = 0.045
export const BUTTON_CLICK_SYNTH_NOISE_GAIN = 0.22
export const BUTTON_CLICK_SYNTH_NOISE_DECAY_S = 0.02

// Fired when the pointer hovers into a hover-highlighted HUD button. No
// real file dropped yet, so playButtonHover() synthesizes a soft rising
// "blip", quieter and shorter than the click so it doesn't compete with it.
export const BUTTON_HOVER_SOUND_URL = '/audio/button_hover.mp3'
export const BUTTON_HOVER_GAIN = 0.05

export const BUTTON_HOVER_SYNTH_FREQ_START_HZ = 700
export const BUTTON_HOVER_SYNTH_FREQ_END_HZ = 1150
export const BUTTON_HOVER_SYNTH_ATTACK_S = 0.003
export const BUTTON_HOVER_SYNTH_DECAY_S = 0.05

// One-shot for a wall's health hitting 0. No wall system in this project;
// kept for parity, never triggered.
export const WALL_BREAK_SOUND_URL = '/audio/wall_break.mp3'
export const WALL_BREAK_GAIN = 0.26

export const WALL_BREAK_SYNTH_THUMP_FREQ_START_HZ = 140
export const WALL_BREAK_SYNTH_THUMP_FREQ_END_HZ = 45
export const WALL_BREAK_SYNTH_THUMP_DECAY_S = 0.28
export const WALL_BREAK_SYNTH_NOISE_DECAY_S = 0.4
export const WALL_BREAK_SYNTH_NOISE_FILTER_START_HZ = 3500
export const WALL_BREAK_SYNTH_NOISE_FILTER_END_HZ = 250
export const WALL_BREAK_SYNTH_NOISE_GAIN = 0.9
