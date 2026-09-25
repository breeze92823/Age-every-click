import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { install as installInput } from './systems/input.js'
import { resetPlayer } from './systems/playerState.js'
import { syncYawToPlayer as syncCameraYaw } from './systems/cameraOrbit.js'
import { SPAWN } from './data/world.js'
import { init as initBloxity, teardown as teardownBloxity } from './systems/bloxity.js'
import { install as installPersistence } from './systems/persistence.js'
import { useGameStore } from './store/useGameStore.js'

resetPlayer(SPAWN)
syncCameraYaw()
installInput()
// Installs audio + preloads sfx as part of its own init, then wires the SDK
// if sdk.bloxity.io loaded — no-ops safely if it didn't.
initBloxity()
// Loads any saved Speed/Wins/Rebirth/Aura/Skates progress from localStorage
// and re-saves on every change — this template's stand-in for Ice-Skate's
// server-backed save.
installPersistence()

// Dev-only console access to the progression store, e.g.
// window.__gameStore.setState({ speed: 9999 }) to test the level bar/rebirth
// gate without clicking your way there.
if (import.meta.env.DEV) window.__gameStore = useGameStore

window.addEventListener('pagehide', teardownBloxity)

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
