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
    house: HOUSES[rng.int(HOUSES.length)],
    wound: null,
    bionics: [],
  }
}

export function officerTitle(o: Officer): string {
  const rank = OFFICER_RANKS_BY_ID.get(o.rankId)
  return `${rank?.rank ?? '?'} ${o.name} of ${o.house}`
}
