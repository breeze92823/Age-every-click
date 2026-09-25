import { useEffect, useReducer, useState } from 'react'
import { subscribeAuth } from '../../systems/bloxity.js'
import { subscribe as subscribeSettings } from '../../systems/settingsState.js'
import { touchState, subscribeTouchMode } from '../../systems/input.js'

// The system singletons are mutated in place, so identity never changes and
// useSyncExternalStore would not re-render. These re-render on notification
// and let the caller read the singleton directly.
function useNotifier(subscribe) {
  const [, bump] = useReducer((n) => n + 1, 0)
  useEffect(() => subscribe(() => bump()), [subscribe])
}

export function useAuth() {
  useNotifier(subscribeAuth)
}

export function useSettings() {
  useNotifier(subscribeSettings)
}

// touchState.active flips once per session and never back, so this only
// ever transitions false -> true. Used to branch HUD layouts between
// desktop and the touch/mobile control scheme.
export function useTouchMode() {
  const [on, setOn] = useState(touchState.active)
  useEffect(() => subscribeTouchMode(setOn), [])
  return on
}
