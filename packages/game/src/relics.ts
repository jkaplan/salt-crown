import type { Lineage, ResolvedStats } from '@salt/sim'

/**
 * Relics — the cut leak mechanic's replacement, docs/ROADMAP.md's post-M4
 * entry: *"Squad-wide buffs are deferred to V0.1 relics/perks, which can
 * explain themselves — carrying a totem or a banner leaking effect to a
 * formation has a mechanism a body's own biology does not."*
 *
 * Bionics install into an OFFICER (True Kin only, one leader, one body).
 * Relics bind to a SQUAD directly — any squad, any lineage, leaderless
 * fodder included, because a totem doesn't care whose hands are on the
 * pole. That is the whole point: it is the first thing in the game that can
 * make a bare mutant squad stronger without a Prospect leading it or a
 * mutation lottery landing well.
 *
 * Found on expeditions only, same door bionics come through — see
 * expeditions.ts. Not sold; "finding relics" was the request, not "buying"
 * them.
 *
 * Some are flat, same shape as a bionic. A few read the squad they're bound
 * to — lineage, body count — and reward a specific pairing over a universal
 * number. That is where "choosing perks that synergize" actually lives:
 * Iron Ward multiplies EXISTING armour, so it does nothing on a Chaff squad
 * and a real amount on a Thornback line. The choice is which squad gets it,
 * not whether to take it.
 *
 * PLACEHOLDER NUMBERS.
 */
export interface RelicContext {
  lineage: Lineage
  count: number
}

export interface Relic {
  id: string
  name: string
  blurb: string
  /** Salvage to bind. Finding it is free; binding it to a squad is not. */
  cost: number
  apply: (s: ResolvedStats, ctx: RelicContext) => void
  /** One-line effect summary — the general shape, not the exact resolved number. */
  effect: string
}

export const RELICS: readonly Relic[] = [
  {
    id: 'salt-idol',
    name: 'Salt Idol',
    blurb: 'Carried at the front since before anyone remembers why. It still works.',
    cost: 60,
    apply: (s) => { s.armor += 1.5 },
    effect: '+1.5 squad armour',
  },
  {
    id: 'marrow-horn',
    name: 'Marrow Horn',
    blurb: 'One note, and the whole line leans forward.',
    cost: 65,
    apply: (s) => { s.damage += 2.5 },
    effect: '+2.5 squad damage',
  },
  {
    id: 'cistern-ward',
    name: 'Cistern Ward',
    blurb: 'Sealed water, older than the House that sealed it.',
    cost: 55,
    apply: (s) => { s.hp += 10 },
    effect: '+10 squad HP',
  },
  {
    id: 'vat-brand',
    name: 'Vat-Brand',
    blurb: "A maker's mark, branded into every body from the same batch. It only means something to the bred.",
    cost: 70,
    // The one lineage with no other equipment path at all — no bionics
    // (mutants can't carry implants), no per-body mutation guarantee. Near-
    // useless bound to a True Kin squad on purpose: this is a mutant relic.
    apply: (s, ctx) => { if (ctx.lineage === 'mutant') s.damage += 6 },
    effect: '+6 squad damage — mutant squads only, does nothing on True Kin',
  },
  {
    id: 'swarm-banner',
    name: 'Swarm Banner',
    blurb: 'Meant to be seen from the back of a very long line.',
    cost: 60,
    // Rewards a big squad over a small one — the Chaff-swarm read, not the
    // elite-line read. Capped so it doesn't run away on an oversized mob.
    apply: (s, ctx) => { s.evade += Math.min(0.12, ctx.count * 0.002) },
    effect: '+evade scaling with squad size, up to +12%',
  },
  {
    id: 'iron-ward',
    name: 'Iron Ward',
    blurb: "Doesn't add protection. Makes what's already there hold.",
    cost: 75,
    // Multiplies rather than adds — the actual "combos with what you
    // already have" relic. Zero on an unarmoured squad, real on one built
    // around armour identity (Thornback, Shieldbearer, Dense Bone).
    apply: (s) => { s.armor *= 1.18 },
    effect: '+18% to existing squad armour — nothing on an unarmoured squad',
  },
]

export const RELICS_BY_ID = new Map(RELICS.map((r) => [r.id, r]))

export function applyRelic(s: ResolvedStats, relicId: string | null | undefined, ctx: RelicContext): void {
  if (!relicId) return
  RELICS_BY_ID.get(relicId)?.apply(s, ctx)
}
