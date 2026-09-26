// Shared roughness/metalness lookup table — every MeshStandardMaterial
// spreads one of these in rather than typing PBR values inline at the call
// site. Add one entry per new prop type as the game grows.
export const MATERIAL_PBR = {
  ISLAND_TOP: { roughness: 0.9, metalness: 0 },
  ISLAND_SIDE: { roughness: 1, metalness: 0 },
  PATH: { roughness: 0.85, metalness: 0 },
  DECOR: { roughness: 0.85, metalness: 0 },
  PROP: { roughness: 0.7, metalness: 0 },
  GLASS: { roughness: 0.05, metalness: 0 },
  WATER: { roughness: 0.35, metalness: 0 },
  PLAYER: { roughness: 0.7, metalness: 0 },
}
