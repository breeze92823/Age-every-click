// One AudioContext, unlocked on the first user gesture — mobile browsers
// refuse to start one otherwise. Exists so the portal's master/music volume
// settings drive something real. sfx.js pools synthesized/decoded one-shots
// on top of these gain nodes. Ported from Ice-Skate's systems/audio.js.
let ctx = null
let masterGain = null
let musicGain = null

// Remembered while the context is still locked, applied on unlock.
let masterLevel = 0.8
let musicLevel = 0.8

function applyLevels() {
  if (!ctx) return
  masterGain.gain.setTargetAtTime(masterLevel, ctx.currentTime, 0.01)
  musicGain.gain.setTargetAtTime(musicLevel, ctx.currentTime, 0.01)
}

export function unlock() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  }
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  masterGain = ctx.createGain()
  masterGain.connect(ctx.destination)
  musicGain = ctx.createGain()
  musicGain.connect(masterGain)
  applyLevels()
  return ctx
}

export function install() {
  const once = () => unlock()
  window.addEventListener('pointerdown', once, { once: true })
  window.addEventListener('keydown', once, { once: true })
}

// 0..100 from the portal, stored 0..1.
export function setMasterVolume(v) {
  masterLevel = Math.max(0, Math.min(1, v / 100))
  applyLevels()
}

export function setMusicVolume(v) {
  musicLevel = Math.max(0, Math.min(1, v / 100))
  applyLevels()
}

export function getMusicBus() {
  return musicGain
}

export function getMasterBus() {
  return masterGain
}
