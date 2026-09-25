import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Quaternion, Vector3 } from 'three'
import { player } from '../systems/playerState.js'
import { authState, getEquippedAvatar, getProportions, onAvatarChanged, onProportionsChanged } from '../systems/bloxity.js'
import { DEV_MODE } from '../data/bloxity.js'
import { isEquipped } from '../data/avatarCdn.js'
import { applyProportions, assembleAvatar } from '../systems/avatarLoader.js'
import { buildDefaultCharacter, outfitForLevel } from '../systems/defaultCharacter.js'
import { useGameStore } from '../store/useGameStore.js'
import { makeGait, updateGait, disposeGait } from '../systems/avatarAnim.js'
import { updateHair } from '../systems/hairPhysics.js'
import { useAuth } from './hud/hooks.js'

const _up = new Vector3(0, 1, 0)
const _targetQuat = new Quaternion()
const TURN_RATE = 0.001 // base of 1 - TURN_RATE^delta; smaller = snappier turn

// The game's own default character (systems/defaultCharacter.js) shows for
// guests, for signed-in players with nothing equipped, in DEV_MODE, and
// whenever the CDN avatar fails to load. Only a signed-in player who has
// actually equipped something gets their Bloxity avatar assembled from the
// CDN. Reloads whenever the player edits their avatar in the customizer.
function useBloxityAvatar(outfit) {
  useAuth()
  const [avatar, setAvatar] = useState(() => buildDefaultCharacter(outfit))
  const signedIn = !!authState.user
  const outfitRef = useRef(outfit)
  outfitRef.current = outfit
  const customRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    let current = null

    async function load() {
      const equipped = signedIn && !DEV_MODE ? getEquippedAvatar() : null
      const custom = !!equipped && Object.values(equipped).some(isEquipped)
      customRef.current = custom
      const group = (custom && (await assembleAvatar(equipped, { signal: controller.signal }))) || buildDefaultCharacter(outfitRef.current)
      if (cancelled) return
      current = group
      applyProportions(current, getProportions())
      setAvatar(group)
    }
    load()

    const offAvatar = onAvatarChanged(() => load())
    const offProportions = onProportionsChanged(() => {
      if (current) applyProportions(current, getProportions())
    })

    return () => {
      cancelled = true
      controller.abort()
      offAvatar()
      offProportions()
    }
  }, [signedIn])

  // The Age-level outfit only dresses the game's own default character — a
  // signed-in player's equipped Bloxity avatar always wins. The first run is
  // skipped: the initial load above already used the current outfit.
  const outfitApplied = useRef(outfit)
  useEffect(() => {
    if (outfitApplied.current === outfit) return
    outfitApplied.current = outfit
    if (customRef.current) return
    const group = buildDefaultCharacter(outfit)
    applyProportions(group, getProportions())
    setAvatar(group)
  }, [outfit])

  return avatar
}

// Presentation only: read the player singleton, draw the character. The
// group origin sits at the capsule base (feet), matching playerState's
// convention. No physics engine here — systems/playerMovement.js is what
// actually moves the player each frame; this component just turns toward
// player.facing rather than snapping to it.
export default function Player() {
  const ref = useRef()
  const outfit = useGameStore((s) => outfitForLevel(s.level))
  const avatar = useBloxityAvatar(outfit)
  const gaitRef = useRef(null)

  // Rebuilt per loaded avatar — the gait's cached bind-pose quaternions
  // (see avatarAnim.js) belong to one specific rig instance.
  useEffect(() => {
    gaitRef.current = null
    if (!avatar) return
    gaitRef.current = makeGait({ root: avatar, nodes: avatar.nodes || {}, clips: avatar.animations || [] })
    return () => {
      disposeGait(gaitRef.current)
      gaitRef.current = null
    }
  }, [avatar])

  useFrame((state, delta) => {
    const g = ref.current
    if (!g) return
    g.position.set(player.position.x, player.position.y, player.position.z)
    _targetQuat.setFromAxisAngle(_up, player.facing)
    g.quaternion.slerp(_targetQuat, 1 - Math.pow(TURN_RATE, delta))

    const gait = gaitRef.current
    if (gait) {
      const speed01 = Math.hypot(player.velocity.x, player.velocity.z) / player.moveSpeed
      updateGait(gait, Math.min(delta, 0.1), speed01, player.grounded)
    }
    // After the gait has posed the head, so the hair follows this frame's pose.
    updateHair(avatar, delta, state.clock.elapsedTime)
  })

  return (
    <group ref={ref}>
      <primitive object={avatar} />
    </group>
  )
}
