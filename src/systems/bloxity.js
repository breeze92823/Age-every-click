// The Bloxity (Legion) SDK facade.
//
// Every SDK call in the codebase should go through this module, which is
// framework-free (systems never import React). Nothing here may throw when
// the SDK is missing — a blocked sdk.bloxity.io must leave the scene fully
// playable on the capsule/keyboard fallback and the signed-out HUD state.
// Ported from Ice-Skate's systems/bloxity.js, trimmed of avatar-CDN rig
// loading (this template's Player.jsx is a plain capsule, not driven by a
// loaded avatar) and Bux balance display specifics that don't matter here.
import { GAME_SLUG, SETTINGS } from '../data/bloxity.js'
import { setSensitivity } from './cameraOrbit.js'
import { settings, setSetting, subscribe as subscribeSettings } from './settingsState.js'
import { resetPlayer } from './playerState.js'
import { SPAWN } from '../data/world.js'
import * as session from './session.js'
import * as audio from './audio.js'
import * as sfx from './sfx.js'

export function sdk() {
  return (typeof window !== 'undefined' && window.Legion && window.Legion.SDK) || null
}

export function isAvailable() {
  return !!sdk()
}

// --- Auth state -------------------------------------------------------
// What the UI renders. `user` is only ever written from the onUserChanged
// handler, which re-reads getUser() rather than trusting a cached object.
// `guest` is the Bloxity-generated guest identity ({ username, displayName,
// pfp }) every player has before signing in; null once `user` is set, or
// when the SDK is too old to expose getGuest().
export const authState = {
  ready: false,
  user: null,
  guest: null,
  friends: [],
  balance: null,
  embedded: false,
}

const authListeners = new Set()

export function subscribeAuth(fn) {
  authListeners.add(fn)
  fn(authState)
  return () => authListeners.delete(fn)
}

function emitAuth() {
  for (const fn of authListeners) fn(authState)
}

// Guards the async fan-out against a fast logout/login flip.
let userGeneration = 0
const unsubscribers = []

// --- Settings -----------------------------------------------------------
function applySetting(key) {
  const value = settings[key]
  switch (key) {
    case 'master_volume':
      audio.setMasterVolume(value)
      break
    case 'music_volume':
      audio.setMusicVolume(value)
      break
    case 'camera_sensitivity':
      setSensitivity(value)
      break
    case 'fullscreen':
      requestFullscreen(value)
      break
    default:
      // background_transparency is read through settingsState's subscription
      // by the HUD directly.
      break
  }
}

function registerSettings(SDK) {
  for (const key of Object.keys(SETTINGS)) {
    const off = SDK.settings.listen(key, (raw) => {
      setSetting(key, raw)
      applySetting(key)
    })
    if (typeof off === 'function') unsubscribers.push(off)
  }
  SDK.settings.triggerAll()
}

// --- Auth fan-out -------------------------------------------------------
async function loadFriends(generation) {
  const SDK = sdk()
  if (!SDK) return
  try {
    const friends = await SDK.social.getFriends()
    if (generation !== userGeneration) return
    authState.friends = Array.isArray(friends) ? friends : []
    emitAuth()
  } catch {
    // Friends are non-essential; the scene plays without them.
  }
}

async function loadBalance(generation) {
  const SDK = sdk()
  if (!SDK) return
  try {
    const balance = await SDK.bux.getBalance()
    if (generation !== userGeneration) return
    authState.balance = typeof balance === 'number' ? balance : null
    emitAuth()
  } catch {
    authState.balance = null
  }
}

// Bloxity assigns every unsigned player a stable guest identity (generated
// name + pfp). Optional-chained because older SDK builds lack it.
function readGuest() {
  const SDK = sdk()
  if (!SDK || typeof SDK.auth.getGuest !== 'function') return null
  try {
    const g = SDK.auth.getGuest()
    return g && (g.username || g.displayName) ? g : null
  } catch {
    return null
  }
}

// Stable Bloxity user id for a signed-in player. Empty for a guest.
export function getStableUserId() {
  const u = authState.user
  if (!u) return ''
  const id = u._id || u.id || u.userId
  return typeof id === 'string' && id ? id : ''
}

function onUser() {
  const SDK = sdk()
  const user = SDK ? SDK.auth.getUser() : null
  const generation = ++userGeneration

  authState.ready = true
  authState.user = user
  authState.guest = user ? null : readGuest()
  authState.friends = []
  authState.balance = null
  emitAuth()

  if (!user) return
  loadFriends(generation)
  loadBalance(generation)
}

// --- Init -----------------------------------------------------------------
let initialised = false

export function init() {
  if (initialised) return
  initialised = true

  audio.install()
  sfx.preload()
  session.install()

  const SDK = sdk()
  if (!SDK) {
    authState.ready = true
    emitAuth()
    return
  }

  try {
    const onLocalhost =
      typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)
    SDK.init(onLocalhost ? { gameSlug: GAME_SLUG, portalUrl: 'https://bloxity.io' } : { gameSlug: GAME_SLUG })
    authState.embedded = !!SDK.portal.isEmbeddedInLegion()

    SDK.game.loadingStep('Starting Age Every Click')

    registerSettings(SDK)

    unsubscribers.push(SDK.auth.onUserChanged(onUser))

    // 'chat_message_sent' and 'pointer_lock_changed' have no handler because
    // this template has no chat and never requests pointer lock; only
    // 'respawn_request' (fired by the portal's own pause-menu button) maps
    // to something real here.
    unsubscribers.push(
      SDK.player.onEvent((event) => {
        if (event === 'respawn_request') resetPlayer(SPAWN)
      }),
    )

    unsubscribers.push(
      session.subscribe((event, payload) => {
        if (event === 'room') SDK.game.updateRoom(payload.roomId, payload.partyId)
      }),
    )
    SDK.game.updateRoom(session.session.roomId, session.session.partyId)

    SDK.game.loadingStep('Ready')
  } catch (err) {
    console.warn('[bloxity] init failed; running without the SDK', err)
    authState.ready = true
    emitAuth()
  }
}

let announcedFirstFrame = false

export function notifyFirstFrame() {
  if (announcedFirstFrame) return
  announcedFirstFrame = true
  const SDK = sdk()
  if (!SDK) return
  try {
    SDK.game.loadingEnd()
    SDK.game.gameplayStart()
  } catch {
    // Non-fatal.
  }
}

export function endGameplay() {
  const SDK = sdk()
  if (!SDK) return
  try {
    SDK.game.gameplayEnd()
  } catch {
    // Non-fatal.
  }
}

export function teardown() {
  for (const off of unsubscribers.splice(0)) {
    try {
      off()
    } catch {
      // Ignore: we are tearing down anyway.
    }
  }
  endGameplay()
}

// --- Auth actions ---------------------------------------------------------
export async function login() {
  const SDK = sdk()
  if (!SDK) return null
  try {
    return await SDK.auth.showAuthPopup()
  } catch (err) {
    console.warn('[bloxity] showAuthPopup failed', err)
    return null
  }
}

export function logout() {
  const SDK = sdk()
  if (SDK) SDK.auth.logout()
}

export function toggleCustomizer() {
  const SDK = sdk()
  if (!SDK) return
  SDK.avatar.toggleCustomizer()
}

// Current equipped-item ids ({ hatId, backId, skinId, headId, armLId,
// armRId, legLId, legRId, torsoId }) — components/Player.jsx feeds this
// straight into systems/avatarLoader.js's assembleAvatar(). Null when the
// SDK is unavailable or the call throws, same as every other accessor here.
export function getEquippedAvatar() {
  const SDK = sdk()
  if (!SDK) return null
  try {
    return SDK.avatar.getEquipped()
  } catch {
    return null
  }
}

// Fires whenever the player changes anything in the avatar customizer, so
// Player.jsx can reload the 3D avatar in place. No-op unsubscribe if the SDK
// or this listener isn't available, so callers never need to branch.
export function onAvatarChanged(fn) {
  const SDK = sdk()
  if (!SDK || typeof SDK.avatar.onAvatarChanged !== 'function') return () => {}
  try {
    return SDK.avatar.onAvatarChanged(fn)
  } catch {
    return () => {}
  }
}

// { height, shoulderWidth, armLength, legOffsetX, torsoScaleX, neckHeight,
// headScale }, all normalised around 1.0. systems/avatarLoader.js's
// applyProportions() is what actually rescales the loaded rig.
export function getProportions() {
  const SDK = sdk()
  if (!SDK) return null
  try {
    return SDK.avatar.getProportions()
  } catch {
    return null
  }
}

// Fires when the player adjusts a proportion slider in the customizer.
// Deliberately doesn't pass the callback's payload through — same rule as
// auth: callers re-read via getProportions() instead of trusting a cached
// value. No-op unsubscribe if the SDK or listener isn't available.
export function onProportionsChanged(fn) {
  const SDK = sdk()
  if (!SDK || typeof SDK.avatar.onProportionsChanged !== 'function') return () => {}
  try {
    return SDK.avatar.onProportionsChanged(() => fn())
  } catch {
    return () => {}
  }
}

// --- Social ---------------------------------------------------------------
export async function inviteFriend(userId) {
  const SDK = sdk()
  if (!SDK) return false
  try {
    SDK.game.updateRoom(session.session.roomId, session.session.partyId)
    return await SDK.social.inviteFriend(userId)
  } catch {
    return false
  }
}

export function getInviteLink() {
  const SDK = sdk()
  if (!SDK) return ''
  try {
    return SDK.social.getInviteFriendsLink({
      gameSlug: GAME_SLUG,
      roomId: session.session.roomId,
      partyId: session.session.partyId,
    })
  } catch {
    return ''
  }
}

export async function refreshFriends() {
  return loadFriends(userGeneration)
}

// No "find a user" API is exposed anywhere in the SDK, so nothing in this
// template can source a userId to call this with yet — kept ready for
// whenever a friend-search UI exists, same as getStableUserId above.
export async function sendFriendRequest(userId) {
  const SDK = sdk()
  if (!SDK) return { success: false, error: 'sdk unavailable' }
  try {
    return await SDK.social.sendFriendRequest(userId)
  } catch (err) {
    return { success: false, error: err?.message || 'request failed' }
  }
}

export async function refreshBalance() {
  return loadBalance(userGeneration)
}

// --- Portal -----------------------------------------------------------
export function showMenu() {
  const SDK = sdk()
  if (!SDK) return
  try {
    SDK.portal.showMenu(true)
  } catch {
    // Ignore.
  }
}

export function requestFullscreen(on) {
  const SDK = sdk()
  if (!SDK) return
  try {
    if (on) SDK.portal.requestFullscreen()
    else SDK.portal.exitFullscreen()
  } catch {
    // Ignore.
  }
}

export function isInIframe() {
  const SDK = sdk()
  return SDK ? !!SDK.portal.isInIframe() : false
}

export { subscribeSettings, settings }
