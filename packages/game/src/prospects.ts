import { Rng } from '@salt/sim'
import { MUTATIONS } from './mutations.js'
import type { MutationRoll } from './mutations.js'
import type { PermanentInjury, Wound } from './wounds.js'

/**
 * A Prospect: a mutant that came out of the vats with something useful.
 *
 * Mutation is random and individual, so a batch of twenty produces one or two
 * standouts and eighteen bodies. Squad-wide mutations were wrong — twenty
 * identically-mutated fighters is not how a random process works, and it made
 * the recruit screen unreadable.
 *
 * "Prospect" is the True Kin's word, and it means exactly what it sounds
 * like: worth watching, possibly worth elevating. A Prospect that keeps
 * surviving is what becomes a Firstborn (M2).
 */
export interface Prospect {
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
   * It also explains what a Prospect *is*: not "one in a dozen is special" as
   * a spawn rule, but "almost every mutant has capacity 0". A Prospect is
   * simply a mutant whose capacity is above zero. The ratio is a consequence,
   * not a rule.
   */
  capacity: number
  /**
   * Whether the player knows the capacity.
   *
   * Hidden capacity is the entire market. An unappraised body is priced on the
   * AVERAGE capacity, so buying blind is roughly break-even in expectation and
   * wildly variable in fact — which is what makes it speculation rather than
   * shopping. Paying an Assayer converts variance into certainty, at a price.
   */
  appraised: boolean
  /**
   * Whether this body takes the field.
   *
   * Unfielded Prospects are stock: they do not deploy, do not accrue battles
   * towards Firstborn, and cannot die. Benching a wounded one to recover, or
   * holding a graded one to sell, is the point of having a reserve at all.
   */
  fielded: boolean
  /** Wound ladder state — docs/V0-DESIGN.md §7. null = Healthy. */
  wound: Wound | null
  /**
   * Carries the title without having earned it.
   *
   * Exactly one body in a run can: the Freed Firstborn origin's player
   * character, elevated by their owner as a House affectation. That IS the
   * joke the Houses were making when they coined the word — a ceremonial
   * promotion of a favoured slave, mocking their own succession rites.
   *
   * Set rather than handing over five mutations, so the earned path stays
   * exactly as hard as it was.
   */
  titled?: boolean
  /**
   * Permanent maimings — docs/V0-DESIGN.md §15. Unlike `wound` above, these
   * never heal; a body carries them for the rest of its career. Empty for
   * almost every Prospect, same as capacity being 0 for almost every mutant —
   * this is meant to read as a real event, not routine wear.
   */
  permanentInjuries: PermanentInjury[]
  /**
   * Every enemy Prospect this one has personally maimed rather than killed —
   * the trophy side of the same roll. Only credited when THIS Prospect's own
   * body threw the blow (an anonymous squad landing the same kind of hit
   * credits no one; there's nobody specific to credit). Requested directly
   * alongside the injuries themselves: "track how many dismembers each
   * important character has... and who they dismember."
   */
  dismemberments: { victim: string; encounterIndex: number }[]
  /**
   * Quickened — docs/V0-DESIGN.md §15: "an 'excited genome' that increases
   * the mutation level at a rapid speed." A rare trait, not a roll in
   * MUTATIONS: it changes how fast and how deep growth reaches, not what a
   * body already has. Optional, same reason `titled` is — most Prospects
   * never carry it, so there is nothing to remember at any construction
   * site. Hidden until appraised, same as `capacity`.
   */
  quickened?: boolean
}

/**
 * Capacity distribution. Most who show anything at all show very little; the
 * ceiling is genuinely rare, which is what makes finding one matter.
 *
 * Only capacity >= FIRSTBORN_AT_MUTATIONS can ever become a Firstborn, so the
 * top two rows are the entire Firstborn pipeline — about 2% of Prospects,
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

/**
 * What an unappraised body is priced as. Roughly the mean of the table above,
 * so the seller is not leaking the answer through the price tag.
 */
export const ASSUMED_CAPACITY = 2

/** Salvage an Assayer charges to read a body's capacity. */
export const APPRAISAL_COST = 45

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

/** Battles a Prospect must survive to earn each new mutation. */
export const BATTLES_PER_MUTATION = 2

/** A Quickened body earns growth in half the time. */
export const QUICKENED_BATTLES_PER_MUTATION = 1

/**
 * How rare Quickened is. Roughly capacity-6-or-better rare (§14's own
 * CAPACITY_TABLE puts that at ~0.7%) — this is meant to be found, not
 * expected, same as a deep capacity roll is.
 */
export const QUICKENED_CHANCE = 0.02

/** The ordinary level ceiling every mutation roll is bound by. */
export const MAX_MUTATION_LEVEL = 6

/**
 * A Quickened body's own ceiling climbs past the ordinary one — "mutation
 * levels could scale past" the cap, tied directly to the same trait rather
 * than raised for everyone, which would just move the cap and change
 * nothing about what makes a roll exceptional.
 */
export const QUICKENED_MAX_MUTATION_LEVEL = 8

/** Mutations offered to choose between when one is earned. */
export const GROWTH_CHOICES = 3

/** Total mutations at which a Prospect graduates to Firstborn. */
export const FIRSTBORN_AT_MUTATIONS = 5

/**
 * Growth is where the depth lives.
 *
 * Buying a Prospect is a lottery — you take the roll you are offered. Growth
 * is the opposite: survive, and you *choose*. That is the only place in the
 * game where the player directs what their warband becomes rather than
 * picking from what the shop happened to produce, and it is what makes
 * keeping fodder alive pay off instead of just being cheaper than dying.
 */
export function earnedGrowth(p: Prospect): number {
  const per = p.quickened ? QUICKENED_BATTLES_PER_MUTATION : BATTLES_PER_MUTATION
  return Math.floor(p.battles / per)
}

/** Growth stops at the body's own ceiling, not a universal one. */
export function isReadyToMutate(p: Prospect): boolean {
  return earnedGrowth(p) > p.growth && p.mutations.length < p.capacity
}

export function isMaxed(p: Prospect): boolean {
  return p.mutations.length >= p.capacity
}

/**
 * Only a body with the capacity to hold FIRSTBORN_AT_MUTATIONS can ever get
 * there, so most Prospects plateau and stay useful rather than becoming
 * legends. That scarcity is the point.
 */
export function isFirstborn(p: Prospect): boolean {
  return p.titled === true || p.mutations.length >= FIRSTBORN_AT_MUTATIONS
}

export function canBecomeFirstborn(p: Prospect): boolean {
  return p.titled === true || p.capacity >= FIRSTBORN_AT_MUTATIONS
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

/** Prospects are the ones who got noticed, so they are a little harder to kill. */
export const PROSPECT_HP_MULT = 2.2

/**
 * A Firstborn has survived ten battles and filled a body deep enough to hold
 * five mutations. It should read as a different class of thing, not a
 * slightly better Prospect.
 */
export const FIRSTBORN_HP_MULT = 3.4

/** A squad led by a legend holds past the point where mutants normally fold. */
export const FIRSTBORN_DISCIPLINE_BONUS = 0.2

/** Salvage premium per mutation level. A good roll is worth paying for. */
export const PROSPECT_COST_PER_LEVEL = 9

/**
 * Salvage premium per point of unused capacity. Room to grow is the thing
 * actually being bought — a finished body is just an expensive fighter.
 */
export const PROSPECT_COST_PER_CAPACITY = 16

export function rollProspect(rng: Rng, typeId: number, encounterIndex: number): Prospect {
  const capacity = rollCapacity(rng)
  // A body already at its ceiling arrives finished — which is most of them.
  const howMany = Math.min(capacity, rng.float() < 0.28 ? 2 : 1)
  const maxLevel = Math.min(MAX_MUTATION_LEVEL, 2 + Math.floor(encounterIndex / 1.6))

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
    appraised: false,
    fielded: true,
    wound: null,
    permanentInjuries: [],
    dismemberments: [],
    quickened: rng.float() < QUICKENED_CHANCE,
  }
}

/**
 * Price a body.
 *
 * What it can already do is observable, so that part is priced honestly. Room
 * to grow is only priced on the TRUE capacity if somebody has actually read
 * it — otherwise both the seller and the buyer are working from the average,
 * which is exactly the gap a speculator lives in.
 */
export function prospectCost(p: Prospect, baseCost: number): number {
  let total = baseCost
  for (const m of p.mutations) total += m.level * PROSPECT_COST_PER_LEVEL

  const capacity = p.appraised ? p.capacity : ASSUMED_CAPACITY
  total += Math.max(0, capacity - p.mutations.length) * PROSPECT_COST_PER_CAPACITY
  // Certainty is worth paying for; a graded body costs more than a blind one.
  if (p.appraised) total *= 1.15

  return Math.round(total)
}

/**
 * A body that has stopped growing has told you its capacity, whether or not
 * you ever paid to find out.
 */
export function revealIfMaxed(p: Prospect): Prospect {
  return !p.appraised && p.mutations.length >= p.capacity ? { ...p, appraised: true } : p
}

/**
 * The Houses coined "Firstborn" as a joke — a ceremonial elevation of a
 * favoured slave, mocking their own succession rites. Outside the caste
 * system it came to mean the one who survived, and the mutants took the word
 * and meant it.
 *
 * So the title *replaces* the unit type rather than decorating it. A promoted
 * mutant stops being "Rust the Chaff" and becomes "Rust, Firstborn" — it is
 * no longer described by the stock it came from.
 */
export function prospectTitle(p: Prospect, typeName: string): string {
  return isFirstborn(p) ? `${p.name}, Firstborn` : `${p.name} the ${typeName}`
}

/**
 * Three mutations to choose between, none of which the Prospect already has.
 *
 * Levels skew higher than a shop roll: a mutation earned by surviving five
 * battles should feel better than one that came free in a crate.
 */
export function rollGrowthChoices(rng: Rng, p: Prospect, encounterIndex: number): MutationRoll[] {
  const held = new Set(p.mutations.map((m) => m.id))
  const pool = MUTATIONS.filter((m) => !held.has(m.id))
  const choices: MutationRoll[] = []

  // A Quickened body's own ceiling climbs past the ordinary one — the "one
  // exceptional mutation on an exceptional body" reading of raising the cap,
  // rather than raising it for everyone and moving what "exceptional" means.
  const cap = p.quickened ? QUICKENED_MAX_MUTATION_LEVEL : MAX_MUTATION_LEVEL
  const maxLevel = Math.min(cap, 3 + Math.floor(encounterIndex / 2))
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

/**
 * How many Prospects can take the field at once.
 *
 * Comparable games cap what you *field*, not what you *own* — Battle Brothers
 * fields 12 from a roster of 20, precisely so the wounded and exhausted can
 * sit out. See docs/V0-DESIGN.md §5b.
 *
 * The gap between owned and fielded is where this stops being a collection
 * and starts being a business: bodies you are not fighting with are stock,
 * and stock is for grading, holding, or selling.
 */
export const MAX_FIELDED_PROSPECTS = 6

/**
 * What a body fetches, as a fraction of what it is worth.
 *
 * The spread is the point. Without it, buy-appraise-sell is an infinite money
 * loop; with it, a blind buy that grades out deep is genuinely profitable and
 * one that grades out finished is a genuine loss. That is the speculation.
 */
export const SELL_RATE = 0.6

/** Bodies currently taking the field. */
export function fieldedCount(prospects: Prospect[]): number {
  return prospects.filter((p) => p.fielded).length
}

export function sellValue(p: Prospect, baseCost: number): number {
  return Math.max(1, Math.round(prospectCost(p, baseCost) * SELL_RATE))
}
