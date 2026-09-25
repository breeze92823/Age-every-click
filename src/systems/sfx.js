// UI/feedback sound effects: real audio files where dropped in (src/data/
// sfx.js), fetched and decoded once each, then played through audio.js's
// shared AudioContext/master bus — so the portal's master_volume setting
// controls them like any other sound. The laser/wall-break sounds are wired
// for parity but never called — this project has no laser or destructible
// wall. Ported verbatim from Ice-Skate's systems/sfx.js.
import { unlock, getMasterBus } from './audio.js'
import {
  LASER_FIRE_SOUND_URL,
  LASER_FIRE_GAIN,
  LASER_BEAM_SOUND_URL,
  LASER_BEAM_GAIN,
  LASER_BEAM_FADE_IN,
  LASER_BEAM_FADE_OUT,
  SPEED_GAIN_SOUND_URL,
  SPEED_GAIN_GAIN,
  LEVEL_UP_GAIN,
  LEVEL_UP_SYNTH_NOTES_HZ,
  LEVEL_UP_SYNTH_NOTE_GAP_S,
  LEVEL_UP_SYNTH_ATTACK_S,
  LEVEL_UP_SYNTH_DECAY_S,
  LEVEL_UP_SYNTH_SHIMMER_RATIO,
  LEVEL_UP_SYNTH_SHIMMER_GAIN,
  BUTTON_CLICK_GAIN,
  BUTTON_CLICK_SYNTH_FREQ_HZ,
  BUTTON_CLICK_SYNTH_ATTACK_S,
  BUTTON_CLICK_SYNTH_DECAY_S,
  BUTTON_CLICK_SYNTH_NOISE_GAIN,
  BUTTON_CLICK_SYNTH_NOISE_DECAY_S,
  BUTTON_HOVER_GAIN,
  BUTTON_HOVER_SYNTH_FREQ_START_HZ,
  BUTTON_HOVER_SYNTH_FREQ_END_HZ,
  BUTTON_HOVER_SYNTH_ATTACK_S,
  BUTTON_HOVER_SYNTH_DECAY_S,
  ACTION_FAIL_GAIN,
  ACTION_FAIL_SYNTH_NOTES_HZ,
  ACTION_FAIL_SYNTH_NOTE_GAP_S,
  ACTION_FAIL_SYNTH_ATTACK_S,
  ACTION_FAIL_SYNTH_DECAY_S,
  WALL_BREAK_GAIN,
  WALL_BREAK_SYNTH_THUMP_FREQ_START_HZ,
  WALL_BREAK_SYNTH_THUMP_FREQ_END_HZ,
  WALL_BREAK_SYNTH_THUMP_DECAY_S,
  WALL_BREAK_SYNTH_NOISE_DECAY_S,
  WALL_BREAK_SYNTH_NOISE_FILTER_START_HZ,
  WALL_BREAK_SYNTH_NOISE_FILTER_END_HZ,
  WALL_BREAK_SYNTH_NOISE_GAIN,
} from '../data/sfx.js'

const bufferCache = new Map() // url -> Promise<AudioBuffer|null>

function loadBuffer(ctx, url) {
  if (!bufferCache.has(url)) {
    bufferCache.set(
      url,
      fetch(url)
        .then((res) => res.arrayBuffer())
        .then((data) => ctx.decodeAudioData(data))
        .catch((err) => {
          console.warn(`[sfx] failed to load ${url}`, err)
          bufferCache.delete(url)
          return null
        }),
    )
  }
  return bufferCache.get(url)
}

// Warms the decode cache so the first HUD interaction doesn't wait on a
// fetch. Safe to call at boot, well before any real user gesture —
// constructing the AudioContext and decoding into it don't need one, only
// actually producing sound does (audio.js's own gesture-triggered unlock()).
export function preload() {
  const ctx = unlock()
  if (!ctx) return
  loadBuffer(ctx, LASER_FIRE_SOUND_URL)
  loadBuffer(ctx, LASER_BEAM_SOUND_URL)
  loadBuffer(ctx, SPEED_GAIN_SOUND_URL)
  synthesizeLevelUpBuffer(ctx)
  synthesizeButtonClickBuffer(ctx)
  synthesizeButtonHoverBuffer(ctx)
  synthesizeActionFailBuffer(ctx)
  synthesizeWallBreakBuffer(ctx)
}

// Fire-and-forget: reuses the one decoded buffer, playing a fresh source
// node per call so overlapping shots never fight each other.
export function playLaserPulse() {
  const ctx = unlock()
  if (!ctx) return
  loadBuffer(ctx, LASER_FIRE_SOUND_URL).then((buffer) => {
    if (!buffer) return
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const gain = ctx.createGain()
    gain.gain.value = LASER_FIRE_GAIN
    source.connect(gain)
    gain.connect(getMasterBus())
    source.start(0)
  })
}

// Fire-and-forget "pop" for a Speed gain.
export function playSpeedGainPop() {
  const ctx = unlock()
  if (!ctx) return
  loadBuffer(ctx, SPEED_GAIN_SOUND_URL).then((buffer) => {
    if (!buffer) return
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const gain = ctx.createGain()
    gain.gain.value = SPEED_GAIN_GAIN
    source.connect(gain)
    gain.connect(getMasterBus())
    source.start(0)
  })
}

// Renders the level-up chime once via OfflineAudioContext and caches the
// resulting buffer — a short ascending arpeggio, each note a triangle
// fundamental plus a quiet detuned-octave shimmer sine, both under a
// quick-attack/exponential-decay envelope.
let levelUpBufferPromise = null

function synthesizeLevelUpBuffer(ctx) {
  if (!levelUpBufferPromise) {
    const noteMs = (LEVEL_UP_SYNTH_ATTACK_S + LEVEL_UP_SYNTH_DECAY_S) * 1000
    const totalMs =
      LEVEL_UP_SYNTH_NOTE_GAP_S * 1000 * (LEVEL_UP_SYNTH_NOTES_HZ.length - 1) + noteMs + 50
    const sampleRate = ctx.sampleRate
    const offline = new OfflineAudioContext(2, Math.ceil((totalMs / 1000) * sampleRate), sampleRate)
    LEVEL_UP_SYNTH_NOTES_HZ.forEach((freq, i) => {
      const start = i * LEVEL_UP_SYNTH_NOTE_GAP_S
      const peak = start + LEVEL_UP_SYNTH_ATTACK_S
      const end = peak + LEVEL_UP_SYNTH_DECAY_S

      const osc = offline.createOscillator()
      osc.type = 'triangle'
      osc.frequency.value = freq

      const shimmer = offline.createOscillator()
      shimmer.type = 'sine'
      shimmer.frequency.value = freq * LEVEL_UP_SYNTH_SHIMMER_RATIO

      const gain = offline.createGain()
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.9, peak)
      gain.gain.exponentialRampToValueAtTime(0.001, end)

      const shimmerGain = offline.createGain()
      shimmerGain.gain.value = LEVEL_UP_SYNTH_SHIMMER_GAIN

      osc.connect(gain)
      shimmer.connect(shimmerGain)
      shimmerGain.connect(gain)
      gain.connect(offline.destination)

      osc.start(start)
      osc.stop(end + 0.05)
      shimmer.start(start)
      shimmer.stop(end + 0.05)
    })
    levelUpBufferPromise = offline.startRendering()
  }
  return levelUpBufferPromise
}

// Fire-and-forget one-shot for a level rise.
export function playLevelUp() {
  const ctx = unlock()
  if (!ctx) return
  synthesizeLevelUpBuffer(ctx).then((buffer) => {
    if (!buffer) return
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const gain = ctx.createGain()
    gain.gain.value = LEVEL_UP_GAIN
    source.connect(gain)
    gain.connect(getMasterBus())
    source.start(0)
  })
}

// The one beam-loop voice: real audio, looped for as long as the caller
// wants it on.
let beamVoice = null

export function startLaserBeam() {
  const ctx = unlock()
  if (!ctx || beamVoice) return
  const bus = getMasterBus()

  const gain = ctx.createGain()
  gain.gain.value = 0
  gain.connect(bus)
  const token = {}
  beamVoice = { source: null, gain, token }

  loadBuffer(ctx, LASER_BEAM_SOUND_URL).then((buffer) => {
    if (!buffer || !beamVoice || beamVoice.token !== token) return
    const now = ctx.currentTime
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    source.connect(gain)
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(LASER_BEAM_GAIN, now + LASER_BEAM_FADE_IN)
    source.start(0)
    beamVoice.source = source
  })
}

export function stopLaserBeam() {
  if (!beamVoice) return
  const { source, gain } = beamVoice
  const ctx = gain.context
  const now = ctx.currentTime
  const tail = LASER_BEAM_FADE_OUT * 4
  gain.gain.cancelScheduledValues(now)
  gain.gain.setTargetAtTime(0, now, LASER_BEAM_FADE_OUT)
  if (source) source.stop(now + tail)
  setTimeout(() => {
    try {
      gain.disconnect()
    } catch {
      // already disconnected — nothing to do
    }
  }, (tail + 0.05) * 1000)
  beamVoice = null
}

// Renders the UI button-click tick once via OfflineAudioContext and caches
// it — a quick high sine tone under a fast-attack/decay envelope, layered
// with a short bandpass-filtered noise burst for tactile "click" texture.
let buttonClickBufferPromise = null

function synthesizeButtonClickBuffer(ctx) {
  if (!buttonClickBufferPromise) {
    const toneEnd = BUTTON_CLICK_SYNTH_ATTACK_S + BUTTON_CLICK_SYNTH_DECAY_S
    const totalS = Math.max(toneEnd, BUTTON_CLICK_SYNTH_NOISE_DECAY_S) + 0.02
    const sampleRate = ctx.sampleRate
    const offline = new OfflineAudioContext(1, Math.ceil(totalS * sampleRate), sampleRate)

    const osc = offline.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = BUTTON_CLICK_SYNTH_FREQ_HZ

    const toneGain = offline.createGain()
    toneGain.gain.setValueAtTime(0, 0)
    toneGain.gain.linearRampToValueAtTime(1, BUTTON_CLICK_SYNTH_ATTACK_S)
    toneGain.gain.exponentialRampToValueAtTime(0.001, toneEnd)

    const noiseLength = Math.ceil(BUTTON_CLICK_SYNTH_NOISE_DECAY_S * sampleRate)
    const noiseBuffer = offline.createBuffer(1, noiseLength, sampleRate)
    const noiseData = noiseBuffer.getChannelData(0)
    for (let i = 0; i < noiseLength; i++) noiseData[i] = Math.random() * 2 - 1

    const noiseSource = offline.createBufferSource()
    noiseSource.buffer = noiseBuffer

    const noiseFilter = offline.createBiquadFilter()
    noiseFilter.type = 'bandpass'
    noiseFilter.frequency.value = BUTTON_CLICK_SYNTH_FREQ_HZ * 3
    noiseFilter.Q.value = 1.5

    const noiseGain = offline.createGain()
    noiseGain.gain.setValueAtTime(BUTTON_CLICK_SYNTH_NOISE_GAIN, 0)
    noiseGain.gain.exponentialRampToValueAtTime(0.001, BUTTON_CLICK_SYNTH_NOISE_DECAY_S)

    osc.connect(toneGain)
    toneGain.connect(offline.destination)
    noiseSource.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(offline.destination)

    osc.start(0)
    osc.stop(toneEnd + 0.02)
    noiseSource.start(0)

    buttonClickBufferPromise = offline.startRendering()
  }
  return buttonClickBufferPromise
}

// Fire-and-forget one-shot for any HUD button press.
export function playButtonClick() {
  const ctx = unlock()
  if (!ctx) return
  synthesizeButtonClickBuffer(ctx).then((buffer) => {
    if (!buffer) return
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const gain = ctx.createGain()
    gain.gain.value = BUTTON_CLICK_GAIN
    source.connect(gain)
    gain.connect(getMasterBus())
    source.start(0)
  })
}

// Renders the hover "blip" once via OfflineAudioContext and caches it — a
// quick, quiet sine sweeping up from BUTTON_HOVER_SYNTH_FREQ_START_HZ to
// BUTTON_HOVER_SYNTH_FREQ_END_HZ under a fast-attack/decay envelope.
let buttonHoverBufferPromise = null

function synthesizeButtonHoverBuffer(ctx) {
  if (!buttonHoverBufferPromise) {
    const end = BUTTON_HOVER_SYNTH_ATTACK_S + BUTTON_HOVER_SYNTH_DECAY_S
    const sampleRate = ctx.sampleRate
    const offline = new OfflineAudioContext(1, Math.ceil((end + 0.02) * sampleRate), sampleRate)

    const osc = offline.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(BUTTON_HOVER_SYNTH_FREQ_START_HZ, 0)
    osc.frequency.exponentialRampToValueAtTime(BUTTON_HOVER_SYNTH_FREQ_END_HZ, end)

    const gain = offline.createGain()
    gain.gain.setValueAtTime(0, 0)
    gain.gain.linearRampToValueAtTime(1, BUTTON_HOVER_SYNTH_ATTACK_S)
    gain.gain.exponentialRampToValueAtTime(0.001, end)

    osc.connect(gain)
    gain.connect(offline.destination)

    osc.start(0)
    osc.stop(end + 0.02)

    buttonHoverBufferPromise = offline.startRendering()
  }
  return buttonHoverBufferPromise
}

// Fire-and-forget one-shot for the pointer hovering into a HUD button.
export function playButtonHover() {
  const ctx = unlock()
  if (!ctx) return
  synthesizeButtonHoverBuffer(ctx).then((buffer) => {
    if (!buffer) return
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const gain = ctx.createGain()
    gain.gain.value = BUTTON_HOVER_GAIN
    source.connect(gain)
    gain.connect(getMasterBus())
    source.start(0)
  })
}

// Renders the "action failed" buzz once via OfflineAudioContext and caches
// it — a short descending two-note square-wave stab.
let actionFailBufferPromise = null

function synthesizeActionFailBuffer(ctx) {
  if (!actionFailBufferPromise) {
    const noteMs = (ACTION_FAIL_SYNTH_ATTACK_S + ACTION_FAIL_SYNTH_DECAY_S) * 1000
    const totalMs =
      ACTION_FAIL_SYNTH_NOTE_GAP_S * 1000 * (ACTION_FAIL_SYNTH_NOTES_HZ.length - 1) + noteMs + 50
    const sampleRate = ctx.sampleRate
    const offline = new OfflineAudioContext(1, Math.ceil((totalMs / 1000) * sampleRate), sampleRate)

    ACTION_FAIL_SYNTH_NOTES_HZ.forEach((freq, i) => {
      const start = i * ACTION_FAIL_SYNTH_NOTE_GAP_S
      const peak = start + ACTION_FAIL_SYNTH_ATTACK_S
      const end = peak + ACTION_FAIL_SYNTH_DECAY_S

      const osc = offline.createOscillator()
      osc.type = 'square'
      osc.frequency.value = freq

      const gain = offline.createGain()
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.7, peak)
      gain.gain.exponentialRampToValueAtTime(0.001, end)

      osc.connect(gain)
      gain.connect(offline.destination)

      osc.start(start)
      osc.stop(end + 0.05)
    })
    actionFailBufferPromise = offline.startRendering()
  }
  return actionFailBufferPromise
}

// Fire-and-forget one-shot for a blocked action.
export function playActionFail() {
  const ctx = unlock()
  if (!ctx) return
  synthesizeActionFailBuffer(ctx).then((buffer) => {
    if (!buffer) return
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const gain = ctx.createGain()
    gain.gain.value = ACTION_FAIL_GAIN
    source.connect(gain)
    gain.connect(getMasterBus())
    source.start(0)
  })
}

// Renders the wall-break crash once via OfflineAudioContext and caches it —
// a falling-pitch sine thump for impact weight, layered under a
// lowpass-filtered noise burst whose cutoff sweeps from a bright crack down
// to a dull rumble as it decays. Never called in this project (no walls).
let wallBreakBufferPromise = null

function synthesizeWallBreakBuffer(ctx) {
  if (!wallBreakBufferPromise) {
    const totalS = Math.max(WALL_BREAK_SYNTH_THUMP_DECAY_S, WALL_BREAK_SYNTH_NOISE_DECAY_S) + 0.05
    const sampleRate = ctx.sampleRate
    const offline = new OfflineAudioContext(1, Math.ceil(totalS * sampleRate), sampleRate)

    const thump = offline.createOscillator()
    thump.type = 'sine'
    thump.frequency.setValueAtTime(WALL_BREAK_SYNTH_THUMP_FREQ_START_HZ, 0)
    thump.frequency.exponentialRampToValueAtTime(
      WALL_BREAK_SYNTH_THUMP_FREQ_END_HZ,
      WALL_BREAK_SYNTH_THUMP_DECAY_S,
    )

    const thumpGain = offline.createGain()
    thumpGain.gain.setValueAtTime(1, 0)
    thumpGain.gain.exponentialRampToValueAtTime(0.001, WALL_BREAK_SYNTH_THUMP_DECAY_S)

    const noiseLength = Math.ceil(WALL_BREAK_SYNTH_NOISE_DECAY_S * sampleRate)
    const noiseBuffer = offline.createBuffer(1, noiseLength, sampleRate)
    const noiseData = noiseBuffer.getChannelData(0)
    for (let i = 0; i < noiseLength; i++) noiseData[i] = Math.random() * 2 - 1

    const noiseSource = offline.createBufferSource()
    noiseSource.buffer = noiseBuffer

    const noiseFilter = offline.createBiquadFilter()
    noiseFilter.type = 'lowpass'
    noiseFilter.Q.value = 0.7
    noiseFilter.frequency.setValueAtTime(WALL_BREAK_SYNTH_NOISE_FILTER_START_HZ, 0)
    noiseFilter.frequency.exponentialRampToValueAtTime(
      WALL_BREAK_SYNTH_NOISE_FILTER_END_HZ,
      WALL_BREAK_SYNTH_NOISE_DECAY_S,
    )

    const noiseGain = offline.createGain()
    noiseGain.gain.setValueAtTime(WALL_BREAK_SYNTH_NOISE_GAIN, 0)
    noiseGain.gain.exponentialRampToValueAtTime(0.001, WALL_BREAK_SYNTH_NOISE_DECAY_S)

    thump.connect(thumpGain)
    thumpGain.connect(offline.destination)
    noiseSource.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(offline.destination)

    thump.start(0)
    thump.stop(WALL_BREAK_SYNTH_THUMP_DECAY_S + 0.02)
    noiseSource.start(0)

    wallBreakBufferPromise = offline.startRendering()
  }
  return wallBreakBufferPromise
}

// Fire-and-forget one-shot for a wall's health hitting 0. Never called in
// this project (no walls) — kept for parity.
export function playWallBreak() {
  const ctx = unlock()
  if (!ctx) return
  synthesizeWallBreakBuffer(ctx).then((buffer) => {
    if (!buffer) return
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const gain = ctx.createGain()
    gain.gain.value = WALL_BREAK_GAIN
    source.connect(gain)
    gain.connect(getMasterBus())
    source.start(0)
  })
}
