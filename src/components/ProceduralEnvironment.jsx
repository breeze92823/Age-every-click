import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { PMREMGenerator } from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

// A generated image-based light, so MeshStandardMaterial surfaces get soft
// fill light and a little sheen instead of going flat grey in shadow. Built
// in code (no HDR download) and kept faint: the hemisphere/sun lights still
// carry the look.
const ENV_INTENSITY = 0.45

export default function ProceduralEnvironment() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    const pmrem = new PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const target = pmrem.fromScene(room, 0.04)
    scene.environment = target.texture
    scene.environmentIntensity = ENV_INTENSITY
    return () => {
      scene.environment = null
      target.dispose()
      pmrem.dispose()
      room.traverse((o) => {
        o.geometry?.dispose()
        o.material?.dispose()
      })
    }
  }, [gl, scene])

  return null
}
