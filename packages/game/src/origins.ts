import { Rng } from '@salt/sim'
import { MUTATIONS } from './mutations.js'
import type { MutationRoll } from './mutations.js'
import { rollProspect } from './prospects.js'
import type { Prospect } from './prospects.js'
import { rollOfficer } from './officers.js'
import type { Officer } from './officers.js'
import type { Squad, Warband } from './roster.js'
import { MUTANT_TYPES } from './units.js'

/**
 * Origins — docs/V0-DESIGN.md §13.
 *
 * Two, and the asymmetry between them is almost entirely DATA: starting
 * roster and a recruit price modifier. That is exactly why two origins are
 * affordable in V0 while per-House bonuses are not — one of these is a table,
 * the other is a system.
 */
export type OriginId = 'scion' | 'firstborn'

export interface Origin {
  id: OriginId
  name: string
  lineage: string
  blurb: string
  /** What the run actually plays like, said plainly. */
  detail: string
  /** Multiplier on True Kin recruit prices. */
  truekinPremium: number
  startingSalvage: number
  startingWater: number
}

/**
 * The premium is THE defining constraint of the mutant origin.
 *
 * True Kin will not readily serve under a mutant, so they cost more — which
 * makes the bionic path taxed rather than locked (§13). It stays a real
 * strategic option, just a slower and more expensive one, and mutation
 * stacking becomes the path of least resistance instead: survive, accumulate,
 * promote your own Firstborn.
 *
 * Locking it would have been easier and much worse. An origin that removes a
 * whole system is a smaller game, not a different one.
 */
export const ORIGINS: readonly Origin[] = [
  {
    id: 'scion',
    name: 'Scion of a House',
    lineage: 'True Kin',
    blurb: 'You inherited a warband and a name that means something to other Houses.',
    detail:
      'Two Officers and a levy of bodies to spend. True Kin serve you at the going rate, so the bionics path is open from the first encounter. The straightforward economy: buy quality, install what the ruins give you.',
    truekinPremium: 1,
    /*
     * More salvage than the mutant start, not less.
     *
     * §13 gives the Scion "~12 mutant fodder" against the Freed Firstborn's
     * ~16, and those roster numbers predate the encounter curve: measured
     * headless, twelve bodies lost the FIRST encounter 21.5% of the time.
     * The roster shape is the design, so the correction goes into the opening
     * purse instead — a Scion is meant to buy their warband, not inherit all
     * of it.
     */
    startingSalvage: 185,
    startingWater: 220,
  },
  {
    id: 'firstborn',
    name: 'The Freed Firstborn',
    lineage: 'Mutant',
    blurb:
      'A slave, elevated by their owner as a House affectation, who walked away and kept the title.',
    detail:
      'No Officers. You are the leader, and what you carry leaks to whoever you stand with. True Kin will not readily serve under a mutant and price themselves accordingly — a bionic core is a slow, expensive pivot rather than the default. Cheaper roster, weaker bodies, far more variance.',
    truekinPremium: 2.1,
    // Fewer bodies to water, and no Officers drinking on the payroll.
    startingSalvage: 145,
    startingWater: 190,
  },
]

export const ORIGINS_BY_ID = new Map(ORIGINS.map((o) => [o.id, o]))

/**
 * Founding mutations — the mutant origin's character-creation step.
 *
 * Where the Scion picks a commander from three rolled Officers, the Freed
 * Firstborn picks what they ARE. §13: "the True Kin start is about who leads
 * you, the mutant start is about what you are."
 *
 * It seeds the whole run, because a Firstborn leaks at FULL level — these are
 * the mutations every squad you lead will carry, so the opening choice sets
 * the build you are pushing toward rather than handing out a stat bump.
 */
export const MAX_FOUNDING_MUTATIONS = 3

/**
 * Taking fewer means taking them deeper.
 *
 * §13 asks for "narrow and deep" to be a real alternative to "wide and
 * shallow", which needs the trade to be inside the same currency — offering
 * salvage instead would make it a different decision that happens to live on
 * the same screen. One mutation at level 6 leaking to a whole squad is a
 * genuinely different opening from three at level 2.
 */
export const FOUNDING_LEVELS: Record<number, number> = {
  1: 6,
  2: 4,
  3: 2,
}

export function foundingLevel(picked: number): number {
  return FOUNDING_LEVELS[Math.max(1, Math.min(MAX_FOUNDING_MUTATIONS, picked))]
}

/**
 * The player, as a body.
 *
 * They carry the title without having earned it, which is the joke the Houses
 * were making when they coined it (see prospects.ts) — a ceremonial elevation
 * of a favoured slave, mocking their own succession rites. So `titled` is set
 * rather than the five mutations being handed over: this is a Firstborn by
 * proclamation, and the earned path stays exactly as hard as it was.
 */
export function foundingFirstborn(rng: Rng, mutationIds: string[], name: string): Prospect {
  const level = foundingLevel(mutationIds.length)
  const mutations: MutationRoll[] = mutationIds
    .filter((id) => MUTATIONS.some((m) => m.id === id))
    .map((id) => ({ id, level }))

  return {
    ...rollProspect(rng, MUTANT_TYPES[1].id, 0),
    id: 'you',
    name,
    mutations,
    titled: true,
    // Room to keep growing past what you were given.
    capacity: Math.max(5, mutations.length + 2),
    appraised: true,
  }
}

export interface StartChoice {
  origin: OriginId
  /** Scion only: the commander picked from three rolled Officers. */
  officer?: Officer
  /** Firstborn only: up to three mutation ids, and what to call yourself. */
  mutationIds?: string[]
  name?: string
}

/**
 * The starting warband, per §13.
 *
 * Scion     2 Officers + ~12 mutant fodder
 * Firstborn 1 Firstborn (you) + ~16 mutant fodder, no Officers
 *
 * The Firstborn starting with MORE bodies is the design, not an oversight:
 * they are cheaper and weaker, and the Scion's two Officers are worth more
 * than the eight fodder that would otherwise be standing next to them.
 *
 * Both are a table, not a code path. That is the whole reason two origins fit
 * in V0.
 */
export function startingWarband(rng: Rng, choice: StartChoice): Warband {
  const origin = ORIGINS_BY_ID.get(choice.origin) ?? ORIGINS[0]
  const base = {
    salvage: origin.startingSalvage,
    water: origin.startingWater,
    bionics: [] as string[],
    machines: [],
    morale: 0,
  }

  if (choice.origin === 'firstborn') {
    const you = foundingFirstborn(rng, choice.mutationIds ?? [], choice.name || 'Firstborn')
    /*
     * You and one other, and the other one matters more than it looks.
     *
     * The Scion starts with two leader slots filled. Measured headless, a
     * Firstborn start with only ONE completed 3.0% of runs against the
     * Scion's 14.0% — most of the gap was simply that every squad past the
     * first had nobody in front of it, at a mutant's 0.35 discipline.
     *
     * A second Prospect is the right lever because it is the origin's own
     * story rather than a handout: the mutant path grows its named tier
     * instead of hiring one, so it starts with the pipeline already running.
     */
    const second = rollProspect(rng, MUTANT_TYPES[3].id, 0)
    const squads: Squad[] = [
      { id: 'sq-start-1', typeId: MUTANT_TYPES[0].id, count: 10, leader: { kind: 'prospect', id: you.id } },
      { id: 'sq-start-2', typeId: MUTANT_TYPES[3].id, count: 6, leader: { kind: 'prospect', id: second.id } },
    ]
    return { ...base, squads, prospects: [you, second], officers: [] }
  }

  /*
   * Two Officers, always — §13. The first is the commander the player picked
   * on the way in; the second is the House's, rolled rather than chosen.
   *
   * Both are rolled when nothing was picked, which is what the harness and
   * any headless caller do. An earlier version pushed only the chosen one and
   * then indexed officers[1] regardless, so every headless run crashed on
   * setup while the tests stayed green — they all pass a commander.
   */
  const officers: Officer[] = [
    choice.officer ?? rollOfficer(rng, 'off-start-1'),
    rollOfficer(rng, 'off-start-2'),
  ]

  const prospect = rollProspect(rng, MUTANT_TYPES[2].id, 0)
  const squads: Squad[] = [
    { id: 'sq-start-1', typeId: MUTANT_TYPES[0].id, count: 7, leader: { kind: 'officer', id: officers[0].id } },
    { id: 'sq-start-2', typeId: MUTANT_TYPES[2].id, count: 5, leader: { kind: 'officer', id: officers[1].id } },
  ]
  return { ...base, squads, prospects: [prospect], officers }
}
