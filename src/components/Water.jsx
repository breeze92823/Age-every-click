import { useEffect, useMemo } from 'react'
import { Color, DoubleSide, MeshStandardMaterial } from 'three'
import { MATERIAL_PBR } from '../data/materials.js'
import { WATER_WIDTH, WATER_DEPTH, WATER_Y } from '../data/world.js'

// The old flat ground plane, now the sea the island sits in: a plain,
// slightly translucent blue plate. Purely visual, same as the ground it
// replaces — playerMovement.js only ever clamps to the island's surface.
const WATER_COLOR = '#2f79c9'

export default function Water() {
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: new Color(WATER_COLOR),
        transparent: true,
        opacity: 0.85,
        side: DoubleSide,
        ...MATERIAL_PBR.WATER,
      }),
    [],
  )

  // three.js does not GC GPU memory.
  useEffect(() => () => material.dispose(), [material])

  return (
    <mesh position={[0, WATER_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={material}>
      <planeGeometry args={[WATER_WIDTH, WATER_DEPTH]} />
    </mesh>
  )
}
