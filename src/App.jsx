import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace } from 'three'
import GameLoop from './components/GameLoop.jsx'
import Water from './components/Water.jsx'
import Island from './components/Island.jsx'
import BonusScene from './components/BonusScene.jsx'
import StudJumpsScene from './components/StudJumpsScene.jsx'
import TsunamiScene from './components/TsunamiScene.jsx'
import Player from './components/Player.jsx'
import Hud from './components/hud/Hud.jsx'
import { useGameStore } from './store/useGameStore.js'

export default function App() {
  const currentScene = useGameStore((s) => s.currentScene)
  const onIsland = currentScene === 'island'
  // The Bonus/Stud Jumps scenes float in open cyan sky with no water below.
  const sky = { island: '#a9c8e6', bonus: '#bde8f0', studJumps: '#5ad2f4', tsunami: '#b4e4f2' }[currentScene]
  return (
    <>
      <Canvas
        shadows={{ type: PCFSoftShadowMap }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          toneMapping: ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
          outputColorSpace: SRGBColorSpace,
        }}
        camera={{ fov: 55, near: 0.1, far: 500, position: [0, 6, 12] }}
      >
        <color attach="background" args={[sky]} />
        <fog attach="fog" args={[sky, 200, 400]} />
        <hemisphereLight args={['#dce8f2', '#a89a80', 1.05]} />
        <directionalLight
          position={[30, 45, 20]}
          intensity={1.8}
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
    </>
  )
}
