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
  /** How many growth mutations have already been claimed. */
  growth: number
  /**
   * Capacity — how many mutations this body can ever carry.
   *
   * This is the whole worth of a mutant. Two bodies with identical stats today
   * are worth completely different amounts if one can hold six mutations and
   * the other is already finished at one.
   *
   * It also explains what a Potential *is*: not "one in a dozen is special" as
   * a spawn rule, but "almost every mutant has capacity 0". A Potential is
   * simply a mutant whose capacity is above zero. The ratio is a consequence,
   * not a rule.
   */
  capacity: number
}

/**
 * Capacity distribution. Most who show anything at all show very little; the
 * ceiling is genuinely rare, which is what makes finding one matter.
 *
 * Only capacity >= FIRSTBORN_AT_MUTATIONS can ever become a Firstborn, so the
 * top two rows are the entire Firstborn pipeline — about 2% of Potentials,
 * which is a fraction of a fraction of all mutants.
 */
const CAPACITY_TABLE: ReadonlyArray<{ upTo: number; capacity: number }> = [
  { upTo: 0.45, capacity: 1 },
  { upTo: 0.73, capacity: 2 },
  { upTo: 0.87, capacity: 3 },
  { upTo: 0.94, capacity: 4 },
  { upTo: 0.98, capacity: 5 },
  { upTo: 0.995, capacity: 6 },
  { upTo: 1.0, capacity: 7 },
]

export function rollCapacity(rng: Rng): number {
  const r = rng.float()
  for (const row of CAPACITY_TABLE) {
    if (r < row.upTo) return row.capacity
  }
  return 1
}

/** How a capacity reads to someone appraising the body. */
export function capacityGrade(capacity: number): string {
  if (capacity <= 1) return 'finished'
  if (capacity === 2) return 'shallow'
  if (capacity <= 4) return 'deep'
  if (capacity === 5) return 'rich'
  return 'unheard of'
}

/** Battles a Potential must survive to earn each new mutation. */
export const BATTLES_PER_MUTATION = 2

/** Mutations offered to choose between when one is earned. */
export const GROWTH_CHOICES = 3

/** Total mutations at which a Potential graduates to Firstborn. */
export const FIRSTBORN_AT_MUTATIONS = 5

/**
 * Growth is where the depth lives.
 *
 * Buying a Potential is a lottery — you take the roll you are offered. Growth
 * is the opposite: survive, and you *choose*. That is the only place in the
 * game where the player directs what their warband becomes rather than
 * picking from what the shop happened to produce, and it is what makes
 * keeping fodder alive pay off instead of just being cheaper than dying.
 */
export function earnedGrowth(p: Potential): number {
  return Math.floor(p.battles / BATTLES_PER_MUTATION)
}

/** Growth stops at the body's own ceiling, not a universal one. */
export function isReadyToMutate(p: Potential): boolean {
  return earnedGrowth(p) > p.growth && p.mutations.length < p.capacity
}

export function isMaxed(p: Potential): boolean {
  return p.mutations.length >= p.capacity
}

/**
 * Only a body with the capacity to hold FIRSTBORN_AT_MUTATIONS can ever get
 * there, so most Potentials plateau and stay useful rather than becoming
 * legends. That scarcity is the point.
 */
export function isFirstborn(p: Potential): boolean {
  return p.mutations.length >= FIRSTBORN_AT_MUTATIONS
}

export function canBecomeFirstborn(p: Potential): boolean {
  return p.capacity >= FIRSTBORN_AT_MUTATIONS
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

/**
 * Salvage premium per point of unused capacity. Room to grow is the thing
 * actually being bought — a finished body is just an expensive fighter.
 */
export const POTENTIAL_COST_PER_CAPACITY = 16

export function rollPotential(rng: Rng, typeId: number, encounterIndex: number): Potential {
  const capacity = rollCapacity(rng)
  // A body already at its ceiling arrives finished — which is most of them.
  const howMany = Math.min(capacity, rng.float() < 0.28 ? 2 : 1)
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
    growth: 0,
    capacity,
  }
}

export function potentialCost(p: Potential, baseCost: number): number {
  let total = baseCost
  for (const m of p.mutations) total += m.level * POTENTIAL_COST_PER_LEVEL
  // Room to grow is priced separately from what it can already do.
  total += Math.max(0, p.capacity - p.mutations.length) * POTENTIAL_COST_PER_CAPACITY
  return Math.round(total)
}

export function potentialTitle(p: Potential, typeName: string): string {
  return `${p.name} the ${typeName}`
}

/**
 * Three mutations to choose between, none of which the Potential already has.
 *
 * Levels skew higher than a shop roll: a mutation earned by surviving five
 * battles should feel better than one that came free in a crate.
 */
export function rollGrowthChoices(rng: Rng, p: Potential, encounterIndex: number): MutationRoll[] {
  const held = new Set(p.mutations.map((m) => m.id))
  const pool = MUTATIONS.filter((m) => !held.has(m.id))
  const choices: MutationRoll[] = []

  const maxLevel = Math.min(6, 3 + Math.floor(encounterIndex / 2))
  const minLevel = Math.min(maxLevel, 2)

  for (let i = 0; i < GROWTH_CHOICES && pool.length > 0; i++) {
    const pick = pool.splice(rng.int(pool.length), 1)[0]
    choices.push({
      id: pick.id,
      level: minLevel + rng.int(maxLevel - minLevel + 1),
    })
  }

  return choices
}
