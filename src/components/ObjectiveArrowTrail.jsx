import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, PlaneGeometry } from 'three'
import { useObjectiveArrow } from '../systems/objectiveArrow.js'
import { player } from '../systems/playerState.js'
import { makeChevronTexture } from '../systems/canvasTextures.js'

// A straight line of floating chevrons from the player toward
// systems/objectiveArrow.js's current target (the Obby sign, for now),
// crawling forward like the island's conveyor chevrons to draw the eye.
// Each chevron lies flat (normal +Y, baked into the shared geometry below)
// rather than standing as a vertical billboard — the third-person camera
// trails behind and slightly above the player (see cameraOrbit.js's
// START_PITCH), the same angle the existing floor-path chevron texture
// (Island.jsx) already reads correctly from, and a flat decal has no
// front/back mirroring to worry about as the travel direction changes. Only
// rotation.y (yaw, about the always-vertical normal) is ever set at runtime,
// so there's no Euler-order/gimbal concern.
const ARROW_COUNT = 6
const ARROW_SPACING = 2.2 // m between chevrons
const ARROW_SIZE = 1.85 // 1.5x the original 1.1
const ARROW_HEIGHT = 1.6 // m above the player's feet
const ARROW_LEAD = 1.5 // m in front of the player before the first chevron
const SCROLL_SPEED = 3 // m/s the chevrons crawl toward the target
const BOB_AMPLITUDE = 0.08
const BOB_SPEED = 2.4

export default function ObjectiveArrowTrail() {
  const target = useObjectiveArrow((s) => s.target)
  const groupRef = useRef(null)
  const meshRefs = useRef([])
  const scrollRef = useRef(0)
  const timeRef = useRef(0)
  const texture = useMemo(() => makeChevronTexture({ color: '#2ecc40', count: 1 }), [])
  // Baked flat (normal +Y) so runtime code only ever sets yaw — see note above.
  const geometry = useMemo(() => new PlaneGeometry(ARROW_SIZE, ARROW_SIZE).rotateX(-Math.PI / 2), [])

  useFrame((_, dt) => {
    const group = groupRef.current
    if (!group) return
    if (!target) {
      group.visible = false
      return
    }

    const dx = target.x - player.position.x
    const dz = target.z - player.position.z
    const dist = Math.hypot(dx, dz)
    group.visible = dist > ARROW_LEAD
    if (dist <= ARROW_LEAD) return

    const dirX = dx / dist
    const dirZ = dz / dist
    const yaw = Math.atan2(-dirZ, dirX)

    scrollRef.current = (scrollRef.current + dt * SCROLL_SPEED) % ARROW_SPACING
    timeRef.current += dt

    for (let i = 0; i < ARROW_COUNT; i++) {
      const mesh = meshRefs.current[i]
      if (!mesh) continue
      const d = ARROW_LEAD + i * ARROW_SPACING + scrollRef.current
      mesh.visible = d < dist - 0.3
      mesh.position.set(
        player.position.x + dirX * d,
        player.position.y + ARROW_HEIGHT + Math.sin(timeRef.current * BOB_SPEED + i) * BOB_AMPLITUDE,
        player.position.z + dirZ * d,
      )
      mesh.rotation.y = yaw
    }
  })

  if (!target) return null

  return (
    <group ref={groupRef}>
      {Array.from({ length: ARROW_COUNT }, (_, i) => (
        <mesh key={i} ref={(el) => (meshRefs.current[i] = el)} geometry={geometry}>
          <meshBasicMaterial map={texture} transparent side={DoubleSide} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}
