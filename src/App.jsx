import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { NoToneMapping, PCFSoftShadowMap, SRGBColorSpace } from 'three'
import GameLoop from './components/GameLoop.jsx'
import Water from './components/Water.jsx'
import Sky from './components/Sky.jsx'
import ProceduralEnvironment from './components/ProceduralEnvironment.jsx'
import Island from './components/Island.jsx'
import BonusScene from './components/BonusScene.jsx'
import StudJumpsScene from './components/StudJumpsScene.jsx'
import TsunamiScene from './components/TsunamiScene.jsx'
import Player from './components/Player.jsx'
import Hud from './components/hud/Hud.jsx'
import LoadingScreen from './components/LoadingScreen.jsx'
import { useGameStore } from './store/useGameStore.js'

// Sky gradient per scene. `bottom` doubles as the fog colour so distant
// geometry fades into the horizon instead of a mismatched haze.
const SKIES = {
  island: { top: '#3f94ea', mid: '#8fd0ff', bottom: '#cfe8ff' },
  bonus: { top: '#4fb8e0', mid: '#bde8f0', bottom: '#e6f8fb' },
  studJumps: { top: '#2a9fe0', mid: '#5ad2f4', bottom: '#b8ecfb' },
  tsunami: { top: '#4fb0dc', mid: '#b4e4f2', bottom: '#e0f5fa' },
}

export default function App() {
  const currentScene = useGameStore((s) => s.currentScene)
  const onIsland = currentScene === 'island'
  // The Bonus/Stud Jumps scenes float in open cyan sky with no water below.
  const sky = SKIES[currentScene]
  return (
    <>
      <Canvas
        shadows={{ type: PCFSoftShadowMap }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          // Filmic tone mapping desaturates the bright greens and blues this
          // toy-block look depends on, so colours pass through untouched.
          toneMapping: NoToneMapping,
          outputColorSpace: SRGBColorSpace,
        }}
        camera={{ fov: 55, near: 0.1, far: 500, position: [0, 6, 12] }}
      >
        <color attach="background" args={[sky.bottom]} />
        <fog attach="fog" args={[sky.bottom, 200, 400]} />
        <ProceduralEnvironment />
        <Sky colors={sky} />
        <hemisphereLight args={['#cfe6ff', '#bfae86', 0.85]} />
        <ambientLight intensity={0.25} />
        <directionalLight
          color="#fff1d6"
          position={[30, 45, 20]}
          intensity={2}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-45}
          shadow-camera-right={45}
          shadow-camera-top={45}
          shadow-camera-bottom={-45}
          shadow-camera-near={1}
          shadow-camera-far={160}
          shadow-bias={-0.0004}
          shadow-normalBias={0.04}
        />

        <GameLoop />
        <Suspense fallback={null}>
          {onIsland && <Water />}
          {currentScene === 'island' && <Island />}
          {currentScene === 'bonus' && <BonusScene />}
          {currentScene === 'studJumps' && <StudJumpsScene />}
          {currentScene === 'tsunami' && <TsunamiScene />}
        </Suspense>
        <Player />
      </Canvas>
      <Hud />
      <LoadingScreen />
    </>
  )
}
