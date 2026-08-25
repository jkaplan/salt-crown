import type { ResolvedStats } from '@salt/sim'
import type { Rng } from '@salt/sim'

/**
 * The wound ladder — docs/V0-DESIGN.md §7. Named tier only, individually:
 * Officers and Prospects, never fodder, which has no individual identity to
 * carry a wound on.
 *
 *   Healthy -> Strained -> Injured -> Crippled -> Dead
 *
 * Dead isn't represented here — that's just the Prospect or Officer being
 * removed, already handled elsewhere. This module only covers the three
 * living rungs above Healthy.
 */
export const WOUND_ZONES = ['head', 'core', 'arms', 'legs'] as const
export type WoundZone = (typeof WOUND_ZONES)[number]

/** 1 = Strained, 2 = Injured, 3 = Crippled. */
export type WoundRung = 1 | 2 | 3

export interface Wound {
  zone: WoundZone
  rung: WoundRung
}

export const WOUND_RUNG_NAMES: Record<WoundRung, string> = {
  1: 'Strained',
  2: 'Injured',
  3: 'Crippled',
}

export const WOUND_ZONE_NAMES: Record<WoundZone, string> = {
  head: 'Head',
  core: 'Core',
  arms: 'Arms',
  legs: 'Legs',
}

/**
 * Fraction knocked off the affected stat(s) per rung. PLACEHOLDER NUMBERS —
 * tune with the batch-sim harness, not by argument, per docs/V0-DESIGN §14.
 */
export const WOUND_PENALTY: Record<WoundRung, number> = {
  1: 0.1,
  2: 0.22,
  3: 0.38,
}

/** Salvage cost of one paid rung of recovery. PLACEHOLDER, see above. */
export const TREAT_COST = 40

/**
 * An Officer has no body to take a hit, so it can't use the Prospect
 * trigger (survived and took damage). Proxy instead: if the squad it led
 * ended the battle COLLAPSING (docs/V0-DESIGN §7 / the report's own
 * threshold), the Officer was in the thick of a losing fight and has this
 * chance of picking up a wound too. PLACEHOLDER, see above.
 */
export const OFFICER_WOUND_CHANCE_ON_COLLAPSE = 0.35

/**
 * Free recovery rungs applied automatically each time a battle resolves —
 * docs/V0-DESIGN §7: "Free recovery between battles is one rung, Strained ->
 * Healthy only. [...] Mutants recover an extra rung free. [...] True Kin
 * recover normally." A Mutant's 2 free rungs can reach past Strained (e.g.
 * Injured -> Healthy in one window); True Kin's 1 rung only ever clears
 * Strained, same as the base case the doc describes.
 */
export const FREE_RECOVERY_MUTANT = 2
export const FREE_RECOVERY_TRUEKIN = 1

/**
 * A body that survived a battle but took damage escalates one rung. First
 * time: roll a zone and start at Strained. Already wounded: same zone, one
 * rung worse (capped at Crippled) — one escalating wound, not several
 * independent ones.
 */
export function escalateWound(current: Wound | null, rng: Rng): Wound {
  if (!current) {
    return { zone: WOUND_ZONES[rng.int(WOUND_ZONES.length)], rung: 1 }
  }
  const rung = Math.min(3, current.rung + 1) as WoundRung
  return { zone: current.zone, rung }
}

/** Applies up to `rungs` of automatic healing. Returns null once fully healed. */
export function recoverWound(current: Wound | null, rungs: number): Wound | null {
  if (!current || rungs <= 0) return current
  const rung = current.rung - rungs
  return rung <= 0 ? null : ({ zone: current.zone, rung } as Wound)
}

/**
 * Applied to a Prospect's own resolved stats, by zone — docs/V0-DESIGN §7's
 * zone table: Head -> accuracy, Core -> max HP, Arms -> damage,
 * Legs -> move and evade.
 */
export function applyWoundPenalty(s: ResolvedStats, wound: Wound | null): void {
  if (!wound) return
  const mult = 1 - WOUND_PENALTY[wound.rung]
  switch (wound.zone) {
    case 'head':
      s.accuracy *= mult
      break
    case 'core':
      s.hp *= mult
      break
    case 'arms':
      s.damage *= mult
      break
    case 'legs':
      s.moveSpeed *= mult
      s.evade *= mult
      break
  }
}

/**
 * An Officer has no body of its own — it grants a squad bonus and nothing
 * else, so it has no HP/damage/speed stat for a zone to individually target.
 * Simplification: any wound, in any zone, scales the officer's ENTIRE squad
 * bonus down by the same fraction, rather than inventing a fragile
 * per-rank-per-zone mapping for stats an Officer doesn't have. The zone still
 * matters for flavour and for what a future Officer roster screen shows.
 */
export function officerBonusMultiplier(wound: Wound | null): number {
  return wound ? 1 - WOUND_PENALTY[wound.rung] : 1
}

/**
 * Permanent injuries — dismemberment, docs/V0-DESIGN.md §15.
 *
 * Requested directly, after the ordinary wound ladder above turned out to be
 * fully recoverable end to end: every rung heals given rest or salvage, so
 * nothing in this game currently costs a body something it never gets back.
 * MAIM_CHANCE (sim) is the trigger — a Prospect's own body, about to die,
 * rolls once to survive maimed instead. This module only covers what that
 * roll leaves behind: Officers have no body of their own (§4) so they stay
 * on the proxy wound system above, unaffected; Machines already have their
 * own permanent-loss story in condition decay, so they don't get a second
 * one layered on top. Prospects only.
 *
 * Zone reuses WOUND_ZONES — the same four locations, just a permanent mark
 * on one of them rather than a temporary one. A body can carry several over
 * a long career, one per surviving-a-would-be-death roll.
 */
export type HarmKind = 'blade' | 'pierce' | 'blunt' | 'burn'

export interface PermanentInjury {
  zone: WoundZone
  harmKind: HarmKind
  /** The attacking group's label at the moment of the roll — flavour, not an id. */
  attacker: string
  encounterIndex: number
}

/**
 * What the attacker was, guessed from its battle label rather than threaded
 * through as a proper type. The sim is deliberately lineage-blind (see
 * docs/TECH.md) — it has no idea what a "Halberdier" is, only a ResolvedStats
 * — so by the time an attacker's identity reaches here, all that survives is
 * the label string the sim already prints (squadLabel/prospectTitle: the
 * unit type's own name is always a substring of it, except a promoted
 * Firstborn's, which drops the type name entirely — falls through to the
 * default below, same as any name this table has never heard of).
 */
const HARM_KIND_BY_NAME: ReadonlyArray<[string, HarmKind]> = [
  ['Chaff', 'blade'], ['Sludge-Waller', 'blunt'], ['Stiltwalker', 'blade'],
  ['Spitter', 'burn'], ['Thornback', 'blade'],
  ['Levy', 'pierce'], ['Halberdier', 'blade'], ['Marksman', 'pierce'],
  ['Shieldbearer', 'blunt'], ['Dragoon', 'blade'],
  ['Chrome Warden', 'blunt'], ['Ordnance Frame', 'blunt'], ['Sweeper', 'blade'],
  ['Hauler-Nine', 'blunt'], ['Arc Caster', 'burn'],
]

/** Falls back to 'blade' — most things in this wasteland bite or cut. */
export function harmKindFromLabel(label: string): HarmKind {
  for (const [name, kind] of HARM_KIND_BY_NAME) {
    if (label.includes(name)) return kind
  }
  return 'blade'
}

/** One line per zone/kind pair — this is the entire payoff of tracking harm kind at all. */
const INJURY_FLAVOR: Record<WoundZone, Record<HarmKind, string>> = {
  head: {
    blade: 'an ear and most of the hearing on that side, taken with it',
    pierce: 'blind in one eye, and no one has found the other half of the arrow',
    blunt: 'a dent in the skull that never quite reset',
    burn: 'scarred blind in one eye',
  },
  core: {
    blade: 'a scar the length of a forearm, and a rib that clicks',
    pierce: 'a wound that never closed all the way',
    blunt: 'ribs that healed wrong and ache before rain',
    burn: 'skin across half the chest that no longer feels anything',
  },
  arms: {
    blade: 'a hand, taken clean off',
    pierce: 'an arm that will not fully straighten again',
    blunt: 'a forearm broken and reset crooked',
    burn: 'fingers fused together by scar tissue',
  },
  legs: {
    blade: 'a leg, from the knee down',
    pierce: 'a limp that a cane never quite fixes',
    blunt: 'a knee that gives out without warning',
    burn: 'a foot with no feeling left in it',
  },
}

export function describeInjury(injury: PermanentInjury): string {
  return INJURY_FLAVOR[injury.zone][injury.harmKind]
}

/**
 * A permanent injury's own cut — smaller than an active wound's (WOUND_PENALTY
 * tops out at 0.38 for Crippled, which heals), because these stack for a
 * whole career and several of them should be a real toll, not a body that
 * stops being fieldable the second a third scar lands.
 */
export const PERMANENT_INJURY_PENALTY = 0.12

/** Same zone → stat mapping as applyWoundPenalty, applied once per injury, permanently. */
export function applyPermanentInjuries(s: ResolvedStats, injuries: readonly PermanentInjury[]): void {
  const mult = 1 - PERMANENT_INJURY_PENALTY
  for (const injury of injuries) {
    switch (injury.zone) {
      case 'head':
        s.accuracy *= mult
        break
      case 'core':
        s.hp *= mult
        break
      case 'arms':
        s.damage *= mult
        break
      case 'legs':
        s.moveSpeed *= mult
        s.evade *= mult
        break
    }
  }
}
