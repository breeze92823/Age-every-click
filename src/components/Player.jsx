import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Quaternion, Vector3 } from 'three'
import { player } from '../systems/playerState.js'
import { authState, getEquippedAvatar, getProportions, onAvatarChanged, onProportionsChanged } from '../systems/bloxity.js'
import { DEV_MODE } from '../data/bloxity.js'
import { applyProportions, attachEquippedAccessories } from '../systems/avatarLoader.js'
import { buildDefaultCharacter, outfitForLevel } from '../systems/defaultCharacter.js'
import { useGameStore } from '../store/useGameStore.js'
import { makeGait, updateGait, disposeGait } from '../systems/avatarAnim.js'
import { updateHair } from '../systems/hairPhysics.js'
import { useAuth } from './hud/hooks.js'
import CharacterConfetti, { burstConfetti } from './CharacterConfetti.jsx'

const _up = new Vector3(0, 1, 0)
const _targetQuat = new Quaternion()
const TURN_RATE = 0.001 // base of 1 - TURN_RATE^delta; smaller = snappier turn

// The player is always the game's own character (systems/defaultCharacter.js),
// dressed by Age level — never the Bloxity avatar. A signed-in player's
// equipped Bloxity hat and back item are attached to it as accessories.
// Rebuilds whenever the outfit changes or the player edits their avatar in
// the customizer.
function useBloxityAvatar(outfit, gender) {
  useAuth()
  const [avatar, setAvatar] = useState(() => buildDefaultCharacter(outfit, gender))
  const signedIn = !!authState.user
  const outfitRef = useRef(outfit)
  outfitRef.current = outfit
  const genderRef = useRef(gender)
  genderRef.current = gender
  const currentRef = useRef(null)
  const firstRun = useRef(true)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    // celebrate: this rebuild is a visible character change (new outfit,
    // edited avatar, sign in/out), not the first load — pop the confetti.
    async function load(celebrate) {
      const group = buildDefaultCharacter(outfitRef.current, genderRef.current)
      const equipped = signedIn && !DEV_MODE ? getEquippedAvatar() : null
      await attachEquippedAccessories(group, equipped, { signal: controller.signal })
      if (cancelled) return
      currentRef.current = group
      applyProportions(group, getProportions())
      setAvatar(group)
      if (celebrate) burstConfetti()
    }
    // The initial state already holds the bare character for this outfit.
    const initial = firstRun.current
    firstRun.current = false
    if (!(initial && !signedIn)) load(!initial)

    const offAvatar = onAvatarChanged(() => load(true))
    const offProportions = onProportionsChanged(() => {
      if (currentRef.current) applyProportions(currentRef.current, getProportions())
    })

    return () => {
      cancelled = true
      controller.abort()
      offAvatar()
      offProportions()
    }
  }, [signedIn, outfit, gender])

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
  // null (picker still up) renders as the boy, so choosing Boy changes nothing.
  const gender = useGameStore((s) => s.gender ?? 'boy')
  const avatar = useBloxityAvatar(outfit, gender)
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
    <>
      <group ref={ref}>
        <primitive object={avatar} />
      </group>
      <CharacterConfetti />
    </>
  )
}
