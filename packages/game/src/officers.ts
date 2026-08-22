import type { ResolvedStats } from '@salt/sim'
import type { Rng } from '@salt/sim'

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
  /** Applied to the led squad's resolved stats. */
  apply: (s: ResolvedStats) => void
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
    apply: (s) => { s.damage *= 1.18 },
    moraleBonus: 0.05,
    effect: '+18% squad damage',
  },
  {
    id: 'warden',
    rank: 'Warden',
    blurb: 'Keeps the line where it was put.',
    cost: 90,
    apply: (s) => { s.armor += 2.5 },
    moraleBonus: 0.12,
    effect: '+2.5 squad armour, holds much longer',
  },
  {
    id: 'marshal',
    rank: 'Marshal',
    blurb: 'Reads a field like a ledger.',
    cost: 110,
    apply: (s) => { s.accuracy += 0.09; s.damage *= 1.06 },
    moraleBonus: 0.08,
    effect: '+9% accuracy, +6% damage',
  },
  {
    id: 'outrider',
    rank: 'Outrider',
    blurb: 'Arrives before the order does.',
    cost: 80,
    apply: (s) => { s.moveSpeed *= 1.25; s.evade += 0.05 },
    moraleBonus: 0.04,
    effect: '+25% move speed, +5% evade',
  },
]

export const OFFICER_RANKS_BY_ID = new Map(OFFICER_RANKS.map((r) => [r.id, r]))

/** The Houses. True Kin only — mutants have no caste and no traditions. */
export const HOUSES = [
  'Vantry', 'Oskal', 'Merethel', 'Caldrion',
  'Thessaly', 'Ambrose', 'Wexhall', 'Duon',
] as const

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
}

export function rollOfficer(rng: Rng, id: string): Officer {
  const rank = OFFICER_RANKS[rng.int(OFFICER_RANKS.length)]
  return {
    id,
    rankId: rank.id,
    name: GIVEN[rng.int(GIVEN.length)],
    house: HOUSES[rng.int(HOUSES.length)],
  }
}

export function officerTitle(o: Officer): string {
  const rank = OFFICER_RANKS_BY_ID.get(o.rankId)
  return `${rank?.rank ?? '?'} ${o.name} of ${o.house}`
}
