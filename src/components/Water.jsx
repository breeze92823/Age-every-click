import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, MeshStandardMaterial } from 'three'
import { MATERIAL_PBR } from '../data/materials.js'
import { WATER_WIDTH, WATER_DEPTH, WATER_Y } from '../data/world.js'
import { makeWaterTexture } from '../systems/canvasTextures.js'

// The old flat ground plane, now the sea the island sits in: a saturated,
// opaque plate with a slowly drifting ripple texture. Opaque on purpose — a
// translucent plate blended with the sky and read as a dull, washed-out slab.
// Purely visual, same as the ground it replaces — playerMovement.js only ever
// clamps to the island's surface.
const WATER_COLOR = '#2aa0e6'
// Metres of sea covered by one ripple tile, and how fast the ripples drift
// (tiles per second).
const RIPPLE_TILE = 12
const RIPPLE_DRIFT = { x: 0.012, y: 0.007 }

export default function Water() {
  const texture = useMemo(() => {
    const t = makeWaterTexture()
    t.repeat.set(WATER_WIDTH / RIPPLE_TILE, WATER_DEPTH / RIPPLE_TILE)
    return t
  }, [])

  const material = useMemo(
    () => new MeshStandardMaterial({ color: new Color(WATER_COLOR), map: texture, ...MATERIAL_PBR.WATER }),
    [texture],
  )

  useFrame((_state, delta) => {
    texture.offset.x = (texture.offset.x + delta * RIPPLE_DRIFT.x) % 1
    texture.offset.y = (texture.offset.y + delta * RIPPLE_DRIFT.y) % 1
  })

  // three.js does not GC GPU memory.
  useEffect(
    () => () => {
      material.dispose()
      texture.dispose()
    },
    [material, texture],
  )

  return (
    <mesh
      position={[0, WATER_Y, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
      material={material}
      renderOrder={-1}
    >
      <planeGeometry args={[WATER_WIDTH, WATER_DEPTH]} />
    </mesh>
  )
}
