// Speed-gain popups (a framework-free, mutable singleton pool, stepped once
// per frame from GameLoop). Spawned by the HUD's click handler's gainSpeed()
// call; step() still runs even before that fires so the pool is ready.
// components/hud/ActionPopups.jsx reads the pool each frame and draws it.
// Ported verbatim from Ice-Skate's systems/actionPopups.js.
import * as THREE from 'three'
import { player } from './playerState.js'
import { playSpeedGainPop } from './sfx.js'
import {
  ACTION_POPUP_POOL_SIZE,
  ACTION_POPUP_LIFETIME,
  ACTION_POPUP_ANCHOR_HEIGHT,
  ACTION_POPUP_SPREAD_X,
  ACTION_POPUP_SPREAD_Y,
} from '../data/actionPopups.js'

function makeSlot() {
  return { alive: false, age: 0, amount: 0, ndcX: 0, ndcY: 0, seq: 0 }
}

// Fixed pool, allocated once and reused for the life of the scene.
export const actionPopupPool = []
for (let i = 0; i < ACTION_POPUP_POOL_SIZE; i++) actionPopupPool.push(makeSlot())

let nextSlot = 0 // round-robin write cursor
let spawnSeq = 0

// Last projection of the player anchor into normalized device coords,
// refreshed by step() each frame.
const playerNdc = { x: 0, y: 0 }

// Scratch, hoisted to module scope — zero allocation per frame.
const anchor = new THREE.Vector3()

export function spawnActionPopup(amount) {
  if (!(amount > 0)) return
  playSpeedGainPop()
  const slot = actionPopupPool[nextSlot]
  nextSlot = (nextSlot + 1) % ACTION_POPUP_POOL_SIZE
  spawnSeq += 1

  slot.alive = true
  slot.age = 0
  slot.amount = amount
  slot.ndcX = playerNdc.x + (Math.random() * 2 - 1) * ACTION_POPUP_SPREAD_X
  slot.ndcY = playerNdc.y + (Math.random() * 2 - 1) * ACTION_POPUP_SPREAD_Y
  slot.seq = spawnSeq
}

export function step(dt, camera) {
  if (camera) {
    anchor.set(player.position.x, player.position.y + ACTION_POPUP_ANCHOR_HEIGHT, player.position.z)
    anchor.project(camera)
    if (anchor.z <= 1) {
      playerNdc.x = anchor.x
      playerNdc.y = anchor.y
    } else {
      playerNdc.x = 0
      playerNdc.y = 0
    }
  }

  for (let i = 0; i < ACTION_POPUP_POOL_SIZE; i++) {
    const slot = actionPopupPool[i]
    if (!slot.alive) continue
    slot.age += dt
    if (slot.age >= ACTION_POPUP_LIFETIME) slot.alive = false
  }
}
