import { useThree, useFrame } from '@react-three/fiber'
import { tick } from '../systems/timeScale.js'
import { step } from '../systems/playerMovement.js'
import { update as updateCamera } from '../systems/cameraOrbit.js'
import { step as stepActionPopups } from '../systems/actionPopups.js'
import { notifyFirstFrame } from '../systems/bloxity.js'

// The single simulation tick. Rendered before the view components so its
// useFrame subscribes first and runs first each frame.
export default function GameLoop() {
  const camera = useThree((s) => s.camera)

  useFrame(() => {
    const dt = tick()
    step(dt)
    updateCamera(camera, dt)
    // Projects the player to the screen and ages live "+N" popups.
    stepActionPopups(dt, camera)
    // The scene is interactive as soon as a frame is on screen. No-ops
    // after the first call.
    notifyFirstFrame()
  })

  return null
}
