import { useEffect, useMemo } from 'react'
import { MeshStandardMaterial } from 'three'
import { MATERIAL_PBR } from '../data/materials.js'
import { makeStudTexture } from '../systems/studTexture.js'
import { GROUND_WIDTH, GROUND_DEPTH } from '../data/world.js'

// A flat stud-textured ground plane — the Bloxity/LEGO-block checker look,
// baked to a CanvasTexture at build time (one texture = one draw call)
// rather than loaded from an image file, so this template has no binary
// asset dependency at all. Purely visual: systems/playerMovement.js clamps
// the player to data/world.js's GROUND_Y directly, matching Ice-Skate's
// approach of a hand-rolled kinematic capsule rather than a physics engine.
const CELL = 2 // metres per checker cell
const STUDS_PER_CELL = 4
const LIGHT = '#5b6472'
const DARK = '#454d59'

export default function Ground() {
  const texture = useMemo(
    () =>
      makeStudTexture({
        light: LIGHT,
        dark: DARK,
        studsPerCell: STUDS_PER_CELL,
        repeatX: GROUND_WIDTH / (CELL * 2),
        repeatY: GROUND_DEPTH / (CELL * 2),
      }),
    [],
  )

  const material = useMemo(
    () => new MeshStandardMaterial({ map: texture, ...MATERIAL_PBR.GROUND }),
    [texture],
  )

  // three.js does not GC GPU memory.
  useEffect(
    () => () => {
      texture.dispose()
      material.dispose()
    },
    [texture, material],
  )

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={material}>
      <planeGeometry args={[GROUND_WIDTH, GROUND_DEPTH]} />
    </mesh>
  )
}
