import type { ResolvedStats } from '@salt/sim'
import type { Rng } from '@salt/sim'
import type { Wound } from './wounds.js'

/**
 * Officers are the named tier: True Kin, recruited individually, each leading
 * one squad. There are always fewer officers than squads, so assigning them is
 * a real choice.
 *
 * Firstborn — the mutant named tier, promoted rather than hired — arrive in M2.
 *
 * PLACEHOLDER NUMBERS.
 */
export interface OfficerRank {
  id: string
  rank: string
  blurb: string
  cost: number
  /**
   * Applied to the led squad's resolved stats. `mult` (0..1) scales the
   * bonus down — an Officer's wound penalty, since an Officer has no body of
   * its own for a wound zone to target; see wounds.ts's officerBonusMultiplier.
   * Defaults to 1 (unwounded) so every existing call site stays valid.
   */
  apply: (s: ResolvedStats, mult?: number) => void
  /** Reduces the squad's rout threshold penalty — higher holds longer. */
  moraleBonus: number
  effect: string
}

export const OFFICER_RANKS: readonly OfficerRank[] = [
  {
    id: 'serjeant',
    rank: 'Serjeant',
    blurb: 'Shouts until it works.',
    cost: 85,
    apply: (s, mult = 1) => { s.damage *= 1 + 0.18 * mult },
    moraleBonus: 0.05,
    effect: '+18% squad damage',
  },
  {
    id: 'warden',
    rank: 'Warden',
    blurb: 'Keeps the line where it was put.',
    cost: 90,
    apply: (s, mult = 1) => { s.armor += 2.5 * mult },
    moraleBonus: 0.12,
    effect: '+2.5 squad armour, holds much longer',
  },
  {
    id: 'marshal',
    rank: 'Marshal',
    blurb: 'Reads a field like a ledger.',
    cost: 110,
    apply: (s, mult = 1) => { s.accuracy += 0.09 * mult; s.damage *= 1 + 0.06 * mult },
    moraleBonus: 0.08,
    effect: '+9% accuracy, +6% damage',
  },
  {
    id: 'outrider',
    rank: 'Outrider',
    blurb: 'Arrives before the order does.',
    cost: 80,
    apply: (s, mult = 1) => { s.moveSpeed *= 1 + 0.25 * mult; s.evade += 0.05 * mult },
    moraleBonus: 0.04,
    effect: '+25% move speed, +5% evade',
  },
]

export const OFFICER_RANKS_BY_ID = new Map(OFFICER_RANKS.map((r) => [r.id, r]))

/**
 * The Houses. True Kin only — mutants have no caste and no traditions.
 *
 * Existed as eight interchangeable name tokens before this — every Officer
 * got one at random, and nothing distinguished "Vantry" from "Oskal" beyond
 * the label. Requested directly, as the second half of the legendary
 * creatures ask: "it might require more factions like Qud has... to really
 * add story." Identity only, not mechanics — per-House bonuses ("sub-
 * origins") are explicitly cut to V0.1 (docs/ROADMAP.md), so this stays a
 * blurb and a name, the same shape a unit type's own blurb/description is.
 */
export interface House {
  name: string
  blurb: string
}

export const HOUSES: readonly House[] = [
  {
    name: 'Vantry',
    blurb:
      "Oldest of the eight, and it never lets anyone forget it. Every other House's claim to a bloodline runs through a Vantry marriage somewhere, which is exactly the leverage it intended.",
  },
  {
    name: 'Oskal',
    blurb: 'Fields more spears than it can pay for and has never once let that stop it. Half the wars on record started as an Oskal debt.',
  },
  {
    name: 'Merethel',
    blurb:
      'Owns the roads, not the land — tolls, escorts, salvage rights. It has never needed to win a war when it can simply be the one everyone pays to reach it.',
  },
  {
    name: 'Caldrion',
    blurb:
      "Keeps the old rites nobody else bothered preserving, and insists everyone else's version is a corruption of theirs.",
  },
  {
    name: 'Thessaly',
    blurb: 'Was the largest House once. Says so constantly. What is left of it fits in one holdfast and a very long memory.',
  },
  {
    name: 'Ambrose',
    blurb:
      'Bought its seat two generations ago and has spent both of them proving it belongs there. The others let it, and never quite let it forget the difference.',
  },
  {
    name: 'Wexhall',
    blurb: 'Sealed its gates during a war nobody else remembers starting and never fully reopened them. Trades, when it trades, at the wall.',
  },
  {
    name: 'Duon',
    blurb:
      'Runs more vats than any other House and treats the arithmetic as a virtue. If the mutant flood has an author, this is the House that signs the ledger.',
  },
]

export const HOUSES_BY_NAME = new Map(HOUSES.map((h) => [h.name, h]))

const GIVEN = [
  'Aurel', 'Bel', 'Cassim', 'Doren', 'Elowen', 'Fenn', 'Gavric', 'Hest',
  'Ilva', 'Joss', 'Kestrel', 'Lorne', 'Maro', 'Nyle', 'Orrin', 'Perse',
  'Quill', 'Rhea', 'Sable', 'Torv', 'Umber', 'Vex', 'Wren', 'Yarrow',
] as const

export interface Officer {
  id: string
  rankId: string
  name: string
  house: string
  /** Wound ladder state — docs/V0-DESIGN.md §7. null = Healthy. */
  wound: Wound | null
  /**
   * Installed bionic ids, capped at BIONIC_SLOTS. The True Kin upgrade path —
   * see bionics.ts. Mutants can never carry these, which the type system gets
   * for free: implants install into Officers, and Officers are always True Kin.
   */
  bionics: string[]
}

export function rollOfficer(rng: Rng, id: string): Officer {
  const rank = OFFICER_RANKS[rng.int(OFFICER_RANKS.length)]
  return {
    id,
    rankId: rank.id,
    name: GIVEN[rng.int(GIVEN.length)],
    house: HOUSES[rng.int(HOUSES.length)].name,
    wound: null,
    bionics: [],
  }
}

export function officerTitle(o: Officer): string {
  const rank = OFFICER_RANKS_BY_ID.get(o.rankId)
  return `${rank?.rank ?? '?'} ${o.name} of ${o.house}`
}
