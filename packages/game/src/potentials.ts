import { Rng } from '@salt/sim'
import { MUTATIONS } from './mutations.js'
import type { MutationRoll } from './mutations.js'

/**
 * A Potential: a mutant that came out of the vats with something useful.
 *
 * Mutation is random and individual, so a batch of twenty produces one or two
 * standouts and eighteen bodies. Squad-wide mutations were wrong — twenty
 * identically-mutated fighters is not how a random process works, and it made
 * the recruit screen unreadable.
 *
 * "Potential" is the True Kin's word, and it means exactly what it sounds
 * like: worth watching, possibly worth elevating. A Potential that keeps
 * surviving is what becomes a Firstborn (M2).
 */
export interface Potential {
  id: string
  typeId: number
  name: string
  mutations: MutationRoll[]
  /** Battles lived through. The road to Firstborn. */
  battles: number
}

/**
 * Mutants have no Houses and no given names — they get called something by
 * whoever has to shout at them. Deliberately unlike the True Kin's
 * given-name-and-House construction.
 */
const NICKNAMES = [
  'Sixteen', 'Gutter', 'Salt', 'Nine-Toes', 'Kettle', 'Cinder', 'Rill',
  'Bracket', 'Sump', 'Ash', 'Pitch', 'Vent', 'Knuckle', 'Marrow', 'Tallow',
  'Grist', 'Hob', 'Slate', 'Wick', 'Drown', 'Shale', 'Crank', 'Nettle',
  'Bell', 'Rust', 'Chalk', 'Thumb', 'Quarry', 'Loam', 'Ferrule',
]

/** Potentials are the ones who got noticed, so they are a little harder to kill. */
export const POTENTIAL_HP_MULT = 2.2

/** Salvage premium per mutation level. A good roll is worth paying for. */
export const POTENTIAL_COST_PER_LEVEL = 9

export function rollPotential(rng: Rng, typeId: number, encounterIndex: number): Potential {
  const howMany = rng.float() < 0.28 ? 2 : 1
  const maxLevel = Math.min(6, 2 + Math.floor(encounterIndex / 1.6))

  const mutations: MutationRoll[] = []
  for (let i = 0; i < howMany; i++) {
    const m = MUTATIONS[rng.int(MUTATIONS.length)]
    if (mutations.some((p) => p.id === m.id)) continue
    mutations.push({ id: m.id, level: 1 + rng.int(maxLevel) })
  }

  return {
    id: `p${rng.next().toString(36)}`,
    typeId,
    name: NICKNAMES[rng.int(NICKNAMES.length)],
    mutations,
    battles: 0,
  }
}

export function potentialCost(p: Potential, baseCost: number): number {
  let total = baseCost
  for (const m of p.mutations) total += m.level * POTENTIAL_COST_PER_LEVEL
  return Math.round(total)
}

export function potentialTitle(p: Potential, typeName: string): string {
  return `${p.name} the ${typeName}`
}
