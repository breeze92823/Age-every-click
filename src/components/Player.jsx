import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Quaternion, Vector3 } from 'three'
import { player } from '../systems/playerState.js'
import { MATERIAL_PBR } from '../data/materials.js'
import { authState, getEquippedAvatar, getProportions, onAvatarChanged, onProportionsChanged } from '../systems/bloxity.js'
import { DEV_MODE } from '../data/bloxity.js'
import { applyProportions, assembleAvatar } from '../systems/avatarLoader.js'
import { makeGait, updateGait, disposeGait } from '../systems/avatarAnim.js'
import { useAuth } from './hud/hooks.js'

const _up = new Vector3(0, 1, 0)
const _targetQuat = new Quaternion()
const TURN_RATE = 0.001 // base of 1 - TURN_RATE^delta; smaller = snappier turn

// Sentinel "nothing equipped" ids (see avatarCdn.js's isEquipped) — passing
// this to assembleAvatar loads just the bare base rig from the CDN, which is
// the Bloxity default character shown to guests and to signed-in players who
// haven't equipped anything.
const DEFAULT_EQUIPPED = {
  hatId: null,
  backId: null,
  skinId: '-1',
  headId: '-1',
  armLId: '-1',
  armRId: '-1',
  legLId: '-1',
  legRId: '-1',
  torsoId: '-1',
}

// The plain capsule + facing nub — the last-resort fallback for when even
// the bare Bloxity base rig can't be loaded (SDK unavailable, CDN blocked,
// offline dev), so the scene is never left with no player mesh at all.
function DefaultCharacter() {
  const { radius, height } = player.dims
  const cylinder = height - radius * 2
  return (
    <>
      <mesh position-y={height / 2} castShadow>
        <capsuleGeometry args={[radius, cylinder, 4, 12]} />
        <meshStandardMaterial color="#4fb3ff" {...MATERIAL_PBR.PLAYER} />
      </mesh>
      {/* nub marking the facing direction */}
      <mesh position={[0, height * 0.62, radius]} castShadow>
        <boxGeometry args={[0.14, 0.14, 0.28]} />
        <meshStandardMaterial color="#ffd36b" {...MATERIAL_PBR.PLAYER} />
      </mesh>
    </>
  )
}

// Loads the Bloxity avatar in place of the fallback capsule: the signed-in
// player's real equipped avatar, or the bare default rig (DEFAULT_EQUIPPED)
// for a guest. Reloads whenever the player edits their avatar in the
// customizer. Stays null (capsule keeps showing) before the load finishes or
// if it fails outright — see systems/avatarLoader.js's own fallback rules
// for why a partial/failed load still resolves rather than throwing.
function useBloxityAvatar() {
  useAuth()
  const [avatar, setAvatar] = useState(null)
  const signedIn = !!authState.user

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    let current = null

    async function load() {
      // DEV_MODE skips static.bloxity.io entirely (a separate host from the
      // SDK script) so local dev never waits on it — capsule stays shown.
      if (DEV_MODE) return
      const equipped = (signedIn && getEquippedAvatar()) || DEFAULT_EQUIPPED
      const group = await assembleAvatar(equipped, { signal: controller.signal })
      if (cancelled || !group) return
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

  return avatar
}

// Presentation only: read the player singleton, draw the character. The
// group origin sits at the capsule base (feet), matching playerState's
// convention. No physics engine here — systems/playerMovement.js is what
// actually moves the player each frame; this component just turns toward
// player.facing rather than snapping to it.
export default function Player() {
  const ref = useRef()
  const avatar = useBloxityAvatar()
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

  useFrame((_state, delta) => {
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
  })

  return <group ref={ref}>{avatar ? <primitive object={avatar} /> : <DefaultCharacter />}</group>
}
