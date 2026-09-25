import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Quaternion, Vector3 } from 'three'
import { player } from '../systems/playerState.js'
import { MATERIAL_PBR } from '../data/materials.js'

const _up = new Vector3(0, 1, 0)
const _targetQuat = new Quaternion()
const TURN_RATE = 0.001 // base of 1 - TURN_RATE^delta; smaller = snappier turn

// Presentation only: read the player singleton, draw the character. The
// group origin sits at the capsule base (feet), matching playerState's
// convention. No physics engine here — systems/playerMovement.js is what
// actually moves the player each frame; this component just turns toward
// player.facing rather than snapping to it.
export default function Player() {
  const ref = useRef()

  useFrame((_state, delta) => {
    const g = ref.current
    if (!g) return
    g.position.set(player.position.x, player.position.y, player.position.z)
    _targetQuat.setFromAxisAngle(_up, player.facing)
    g.quaternion.slerp(_targetQuat, 1 - Math.pow(TURN_RATE, delta))
  })

  const { radius, height } = player.dims
  const cylinder = height - radius * 2

  return (
    <group ref={ref}>
      <mesh position-y={height / 2} castShadow>
        <capsuleGeometry args={[radius, cylinder, 4, 12]} />
        <meshStandardMaterial color="#4fb3ff" {...MATERIAL_PBR.PLAYER} />
      </mesh>
      {/* nub marking the facing direction */}
      <mesh position={[0, height * 0.62, radius]} castShadow>
        <boxGeometry args={[0.14, 0.14, 0.28]} />
        <meshStandardMaterial color="#ffd36b" {...MATERIAL_PBR.PLAYER} />
      </mesh>
    </group>
  )
}
