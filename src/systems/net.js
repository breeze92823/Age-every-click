// Multiplayer presence stub. Ice-Skate's own systems/net.js talks to a
// Colyseus backend this template doesn't have; ported down to just the
// public shape components/hud/NetStatus.jsx needs. No SERVER_URL is
// configured, so netState stays 'idle' forever and NetStatus renders
// nothing — the same "connected, say nothing" steady state a real deploy
// with no backend configured would show.
export const netState = {
  status: 'idle',
  attempt: 0,
  playerCount: 0,
  everConnected: false,
  error: null,
}

const listeners = new Set()

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// Manual "Retry" from the HUD banner — a no-op with nothing configured to
// retry against, kept for parity with Ice-Skate's HUD wiring.
export function retryNow() {
  // No backend configured for this template.
}
