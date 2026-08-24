import type { ResolvedStats } from '@salt/sim'
import type { Rng } from '@salt/sim'

/**
 * The wound ladder — docs/V0-DESIGN.md §7. Named tier only, individually:
 * Officers and Potentials, never fodder, which has no individual identity to
 * carry a wound on.
 *
 *   Healthy -> Strained -> Injured -> Crippled -> Dead
 *
 * Dead isn't represented here — that's just the Potential or Officer being
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
 * An Officer has no body to take a hit, so it can't use the Potential
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
 * Applied to a Potential's own resolved stats, by zone — docs/V0-DESIGN §7's
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
