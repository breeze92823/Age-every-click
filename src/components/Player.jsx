import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Quaternion, Vector3 } from 'three'
import { player } from '../systems/playerState.js'
import { MATERIAL_PBR } from '../data/materials.js'
import { authState, getEquippedAvatar, getProportions, onAvatarChanged, onProportionsChanged } from '../systems/bloxity.js'
import { applyProportions, assembleAvatar } from '../systems/avatarLoader.js'
import { useAuth } from './hud/hooks.js'

const _up = new Vector3(0, 1, 0)
const _targetQuat = new Quaternion()
const TURN_RATE = 0.001 // base of 1 - TURN_RATE^delta; smaller = snappier turn

// The plain capsule + facing nub — always the signed-out character, and the
// signed-in one too until (or unless) its real Bloxity avatar finishes
// loading.
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

// Loads the signed-in player's real Bloxity avatar in place of the default
// capsule, and reloads it whenever they edit it in the customizer. Stays
// null (default capsule keeps showing) when signed out, before the load
// finishes, or if it fails — see systems/avatarLoader.js's own fallback
// rules for why a partial/failed load still resolves rather than throwing.
function useBloxityAvatar() {
  useAuth()
  const [avatar, setAvatar] = useState(null)
  const signedIn = !!authState.user

  useEffect(() => {
    if (!signedIn) {
      setAvatar(null)
      return
    }

    let cancelled = false
    const controller = new AbortController()
    let current = null

    async function load() {
      const equipped = getEquippedAvatar()
      if (!equipped) return
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

  useFrame((_state, delta) => {
    const g = ref.current
    if (!g) return
    g.position.set(player.position.x, player.position.y, player.position.z)
    _targetQuat.setFromAxisAngle(_up, player.facing)
    g.quaternion.slerp(_targetQuat, 1 - Math.pow(TURN_RATE, delta))
  })

  return <group ref={ref}>{avatar ? <primitive object={avatar} /> : <DefaultCharacter />}</group>
}
