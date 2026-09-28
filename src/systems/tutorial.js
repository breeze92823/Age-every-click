import { useGameStore } from '../store/useGameStore.js'
import { setTutorialHint } from './tutorialHints.js'
import { setObjectiveTarget } from './objectiveArrow.js'
import { setTutorialSpotlight } from './tutorialSpotlight.js'
import { onClickGain } from './clickGain.js'
import { onProgressResolved } from './net.js'
import { ageMachineSpot } from '../data/area2.js'
import { OBBY } from '../data/island.js'
import { ISLAND_SCALE } from '../data/world.js'

// Degrees clockwise applied on top of action_popup.png's own built-in
// point direction (up-left) — tune this if the Rebirth button's HUD
// position ever moves relative to where TutorialSpotlight places the arrow.
const REBIRTH_ARROW_ROTATION_DEG = -50

// New-player onboarding: a fixed sequence of TutorialHint copy + optional
// ObjectiveArrow targets, each step advancing on a real game event (a click,
// an Age milestone, finishing an obby, owning/using the Basic Age Machine, a
// first rebirth). No skip/back — this is a one-way path. The current step is
// durable (store/useGameStore.js's tutorialStep, synced like the rest of a
// signed-in player's save via systems/net.js), so a player who quits
// mid-onboarding resumes at the same step next time instead of replaying it
// from scratch or being skipped outright just for having a save — install()
// below waits on net.js's onProgressResolved() so a returning player's saved
// step (if any) has already hydrated before it enters that step. A guest, a
// fresh signed-in save, or a session where no save could be checked in time
// all just resume at step 0, same as a brand-new player.
const BASIC_AGE_MACHINE_INDEX = 0

const OBBY_TARGET = { x: OBBY.x * ISLAND_SCALE-3, z: OBBY.signZ * ISLAND_SCALE+15 }

function ageMachineTarget(index) {
  const spot = ageMachineSpot(index)
  return { x: spot.x * ISLAND_SCALE, z: spot.z * ISLAND_SCALE }
}
const BASIC_AGE_MACHINE_TARGET = ageMachineTarget(BASIC_AGE_MACHINE_INDEX)

// The three obby scenes (see App.jsx's SKIES / systems/scenePortals.js)
// currentScene visits and returns from — any one of them counts as
// "played an obby" for step 3.
const OBBY_SCENES = new Set(['bonus', 'studJumps', 'tsunami'])

const STEPS = [
  { hint: 'Click the Screen!' },
  { hint: 'Click Until You Reach Age 5!' },
  { hint: 'Great! Keep going Until You Reach Age 18!' },
  { hint: 'Awesome! Play An Obby to Earn Coins!', highlight: 'Coins!', target: OBBY_TARGET },
  {
    hint: 'Good Job! Buy Basic Age Machine to Gain Age Faster!',
    highlight: 'Basic Age Machine',
    target: BASIC_AGE_MACHINE_TARGET,
  },
  {
    hint: 'Use Your Basic Age Machine to Help Reach Age 100!',
    highlight: 'Basic Age Machine',
    target: BASIC_AGE_MACHINE_TARGET,
  },
  {
    hint: 'Buy Your First Rebirth!',
    highlight: 'Rebirth',
    spotlight: { target: 'rebirth', rotation: REBIRTH_ARROW_ROTATION_DEG },
  },
]

let installed = false
let stepIndex = -1

function enterStep(i) {
  stepIndex = i
  // Persist so a reload/reconnect resumes here instead of restarting — see
  // this module's own top comment. A no-op resend for a guest or an
  // unchanged value (net.js's onLocalStoreChangeProgress diffs before
  // scheduling a save).
  useGameStore.getState().setTutorialStep(i)
  const step = STEPS[i]
  if (!step) {
    // Past the last step — onboarding's done.
    setTutorialHint(null)
    setObjectiveTarget(null)
    setTutorialSpotlight(null)
    return
  }
  setTutorialHint(step.hint, step.highlight ?? null)
  setObjectiveTarget(step.target ?? null)
  setTutorialSpotlight(step.spotlight?.target ?? null, step.spotlight?.rotation ?? 0)
}

function advance() {
  enterStep(stepIndex + 1)
}

export function install() {
  if (installed) return
  installed = true

  // Wait for a possible existing save to hydrate (see onProgressResolved()'s
  // own comment for the guest/timeout fallbacks that keep this from stalling
  // a genuinely new player) before reading tutorialStep — a returning
  // player's saved step, if any, is already on the store by the time this
  // fires. Defaults to 0 for a guest, a fresh save, or an unresolved check.
  onProgressResolved(() => {
    enterStep(useGameStore.getState().tutorialStep)
  })

  onClickGain(() => {
    if (stepIndex === 0) advance()
  })

  let wasInObby = OBBY_SCENES.has(useGameStore.getState().currentScene)

  useGameStore.subscribe((state) => {
    const inObby = OBBY_SCENES.has(state.currentScene)
    const returnedFromObby = wasInObby && !inObby && state.currentScene === 'island'
    wasInObby = inObby

    if (stepIndex === 1 && state.speed >= 5) return advance()
    if (stepIndex === 2 && state.speed >= 18) return advance()
    if (stepIndex === 3 && returnedFromObby) return advance()
    if (stepIndex === 4 && state.ownedAgeMachines.has(BASIC_AGE_MACHINE_INDEX)) return advance()
    if (stepIndex === 5 && state.speed >= 100) return advance()
    if (stepIndex === 6 && state.rebirth > 0) return advance()
  })
}
