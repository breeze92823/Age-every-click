import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { install as installInput } from './systems/input.js'
import { install as installClickGain } from './systems/clickGain.js'
import { resetPlayer } from './systems/playerState.js'
import { syncYawToPlayer as syncCameraYaw } from './systems/cameraOrbit.js'
import { SPAWN, SPAWN_FACING } from './data/world.js'
import { init as initBloxity, teardown as teardownBloxity } from './systems/bloxity.js'
import { install as installPersistence } from './systems/persistence.js'
import { init as initNet, teardown as teardownNet } from './systems/net.js'
import { useGameStore } from './store/useGameStore.js'

resetPlayer(SPAWN, SPAWN_FACING)
syncCameraYaw()
installInput()
installClickGain()
// Installs audio + preloads sfx as part of its own init, then wires the SDK
// if sdk.bloxity.io loaded — no-ops safely if it didn't.
initBloxity()
// No-op — progress load/save now goes through systems/net.js's Colyseus
// connection (Age-every-click-backend's Mongo-backed saveProgress/progress
// messages) instead of localStorage; see systems/persistence.js's own comment.
installPersistence()
// Connects to Age-every-click-backend for the Top Coins/Top Age leaderboard
// boards and cross-session save/load. No-ops forever if no server URL is
// configured (see data/net.js's SERVER_URL_MAIN) — the game stays fully
// playable solo either way.
initNet()

// Dev-only console access to the progression store, e.g.
// window.__gameStore.setState({ speed: 9999 }) to test the level bar/rebirth
// gate without clicking your way there.
if (import.meta.env.DEV) window.__gameStore = useGameStore

window.addEventListener('pagehide', () => {
  teardownBloxity()
  teardownNet()
})

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
