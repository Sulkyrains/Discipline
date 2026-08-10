export interface GardenBreakdown {
  seedlings: number
  smallTrees: number
  bigTrees: number
}

/**
 * Focus garden growth: every unit is one seedling. Three seedlings combine
 * into one small tree, three small trees combine into one big tree, and
 * seedlings keep generating (units never stop accumulating).
 */
export function gardenBreakdown(units: number): GardenBreakdown {
  const n = Math.max(0, Math.floor(units))
  return {
    bigTrees: Math.floor(n / 9),
    smallTrees: Math.floor((n % 9) / 3),
    seedlings: n % 3
  }
}
