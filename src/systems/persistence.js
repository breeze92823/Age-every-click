// Local stand-in for Ice-Skate's server save/load (systems/net.js's
// progressPayload/hydrate, sent over its Colyseus connection). Disabled for
// now — progress always starts from useGameStore's defaults — until this
// is wired up to fetch/save through a real server. store.hydrate() stays
// the entry point that wiring will call.
export function install() {}
