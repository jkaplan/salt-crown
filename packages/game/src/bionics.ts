import type { ResolvedStats } from '@salt/sim'

/**
 * Bionics — docs/V0-DESIGN.md §3.
 *
 * The True Kin upgrade path, and the deliberate opposite of mutations:
 *
 *   Mutations  rolled, levelled 1-6, arrive on a body you did not choose.
 *              A lottery. You play what you were dealt.
 *   Bionics    found, flat, installed on purpose into a leader you picked.
 *              Build-crafting. You decide what the squad becomes.
 *
 * So bionics have no levels. Giving them a 1-6 scale would make them
 * mutations with a different name, and the whole reason the two lineages feel
 * different is that one is luck and the other is intent.
 *
 * **Mutants can never take these.** Not a balance rule — their bodies are not
 * strong enough to carry the implants. That exclusivity is load-bearing
 * (CLAUDE.md): if mutants could take both, True Kin collapse into "mutants
 * without the fun part". The type system enforces it for free here, because
 * bionics install into Officers and an Officer is always True Kin.
 *
 * Installing into the OFFICER rather than the squad mirrors the mutant path
 * exactly. A Prospect leads and leaks its mutations to the squad; an Officer
 * leads and grants its rank bonus plus its implants. One leader slot, two
 * lineages, two completely different ways of filling it.
 *
 * PLACEHOLDER NUMBERS.
 */
export interface Bionic {
  id: string
  name: string
  blurb: string
  /** Salvage to install. Finding it is free; fitting it is not. */
  cost: number
  /** Applied to the led squad's resolved stats, like an officer rank. */
  apply: (s: ResolvedStats) => void
  effect: string
}

/**
 * Scarce slots — §6's "Install" lever. Three is enough for a build to have a
 * shape and not enough to install everything you find, which is what makes
 * finding a fourth one a decision rather than an inventory update.
 */
export const BIONIC_SLOTS = 3

export const BIONICS: readonly Bionic[] = [
  {
    id: 'nerve-lattice',
    name: 'Nerve Lattice',
    blurb: 'House work. Reads the intent before the arm commits to it.',
    cost: 70,
    apply: (s) => { s.accuracy += 0.08 },
    effect: '+8% squad accuracy',
  },
  {
    id: 'bracing-struts',
    name: 'Bracing Struts',
    blurb: 'Bolted to the skeleton. Standing costs nothing now.',
    cost: 85,
    apply: (s) => { s.armor += 2 },
    effect: '+2 squad armour',
  },
  {
    id: 'carbide-edge',
    name: 'Carbide Edge',
    blurb: 'A cutting surface that does not need sharpening.',
    cost: 80,
    apply: (s) => { s.damage += 3.5 },
    effect: '+3.5 squad damage',
  },
  {
    id: 'recoil-damper',
    name: 'Recoil Damper',
    blurb: 'The second shot arrives before the first is done being surprising.',
    cost: 95,
    apply: (s) => { s.attackInterval *= 0.86 },
    effect: '14% faster squad attacks',
  },
  {
    id: 'circulatory-shunt',
    name: 'Circulatory Shunt',
    blurb: 'Keeps the pressure up long after it should have dropped.',
    cost: 75,
    apply: (s) => { s.hp += 14 },
    effect: '+14 squad HP',
  },
  {
    id: 'gait-assist',
    name: 'Gait Assist',
    blurb: 'Walks the wearer. They have learned to let it.',
    cost: 65,
    apply: (s) => { s.moveSpeed += 0.9 },
    effect: '+0.9 squad move speed',
  },
]

export const BIONICS_BY_ID = new Map(BIONICS.map((b) => [b.id, b]))

/**
 * Applies every implant an Officer is carrying.
 *
 * Deliberately NOT scaled by the officer's wound, unlike the rank bonus.
 * A wound degrades what a person can do; it does not degrade hardware bolted
 * to their skeleton. That makes a bionic build a hedge against the attrition
 * that erodes an unmodified officer, which is a real reason to take the
 * slower, more expensive path.
 */
export function applyBionics(s: ResolvedStats, installed: readonly string[]): void {
  for (const id of installed) BIONICS_BY_ID.get(id)?.apply(s)
}

/** Total salvage tied up in an officer's implants. Used for the roster readout. */
export function bionicValue(installed: readonly string[]): number {
  let total = 0
  for (const id of installed) total += BIONICS_BY_ID.get(id)?.cost ?? 0
  return total
}
