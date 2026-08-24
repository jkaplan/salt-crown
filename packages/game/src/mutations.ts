import type { ResolvedStats } from '@salt/sim'

/**
 * Mutations are the depth system. Positioning, in-battle input and counters
 * are all cut, so composition has to carry the game — and this is what makes
 * one Chaff squad different from another.
 *
 * Levels are Qud-style: 1-6, effect scales with level. A level 6 roll is a
 * genuine find, which is what makes the recruit screen a lottery rather than
 * a price comparison.
 *
 * True Kin never take these. Their bodies carry bionics instead (M3); mutant
 * bodies aren't strong enough for implants. That exclusivity is what keeps
 * the two lineages distinct — see docs/V0-DESIGN.md §3.
 *
 * PLACEHOLDER NUMBERS.
 */
export interface Mutation {
  id: string
  name: string
  blurb: string
  /** Applied in place to a group's resolved stats. */
  apply: (s: ResolvedStats, level: number) => void
  /** One-line effect summary for the UI. */
  describe: (level: number) => string
}

export const MUTATIONS: readonly Mutation[] = [
  {
    id: 'horns',
    name: 'Horns',
    blurb: 'Bone, forward.',
    apply: (s, l) => { s.damage += l * 1.5 },
    describe: (l) => `+${(l * 1.5).toFixed(1)} damage`,
  },
  {
    id: 'carapace',
    name: 'Carapace',
    blurb: 'A shell, of sorts.',
    apply: (s, l) => { s.armor += l * 0.8 },
    describe: (l) => `+${(l * 0.8).toFixed(1)} armour`,
  },
  {
    id: 'bulging-sacs',
    name: 'Bulging Sacs',
    blurb: 'More of it to kill.',
    apply: (s, l) => { s.hp += l * 7 },
    describe: (l) => `+${l * 7} HP`,
  },
  {
    id: 'adrenal-glands',
    name: 'Adrenal Glands',
    blurb: 'Always at a run.',
    apply: (s, l) => { s.moveSpeed += l * 0.5 },
    describe: (l) => `+${(l * 0.5).toFixed(1)} move speed`,
  },
  {
    id: 'twitch-reflex',
    name: 'Twitch Reflex',
    blurb: 'Flinches before the blow lands.',
    apply: (s, l) => { s.evade += l * 0.022 },
    describe: (l) => `+${(l * 2.2).toFixed(1)}% evade`,
  },
  {
    id: 'keen-sense',
    name: 'Keen Sense',
    blurb: 'Smells where you will be.',
    apply: (s, l) => { s.accuracy += l * 0.02 },
    describe: (l) => `+${(l * 2).toFixed(0)}% accuracy`,
  },
  {
    id: 'serrated-claws',
    name: 'Serrated Claws',
    blurb: 'Enthusiasm over precision.',
    apply: (s, l) => { s.damage += l * 2.6; s.accuracy -= 0.06 },
    describe: (l) => `+${(l * 2.6).toFixed(1)} damage, -6% accuracy`,
  },
  {
    id: 'flaming-ray',
    name: 'Flaming Ray',
    blurb: 'It opens its mouth and the air lights up.',
    apply: (s, l) => { s.range = Math.max(s.range, 90 + l * 22); s.damage *= 0.8 },
    describe: (l) => `ranged attack (${90 + l * 22} range), -20% damage`,
  },
  {
    id: 'dense-bone',
    name: 'Dense Bone',
    blurb: 'Heavy, and slow with it.',
    apply: (s, l) => { s.armor += l * 1.1; s.moveSpeed -= 0.7 },
    describe: (l) => `+${(l * 1.1).toFixed(1)} armour, -0.7 move speed`,
  },
  {
    id: 'regeneration',
    name: 'Regeneration',
    blurb: 'Knits itself back together, slowly.',
    apply: (s, l) => { s.regen += l * 0.06 },
    describe: (l) => `+${(l * 0.06 * 20).toFixed(1)} HP/sec`,
  },
  {
    id: 'quills',
    name: 'Quills',
    blurb: 'Punching it is its own punishment.',
    apply: (s, l) => { s.quills += l * 0.06 },
    describe: (l) => `reflects ${(l * 6).toFixed(0)}% of melee damage`,
  },
  {
    id: 'razor-tail',
    name: 'Razor Tail',
    blurb: 'The last thing to touch it is usually the tail.',
    apply: (s, l) => { s.quills += l * 0.05; s.evade += l * 0.012 },
    describe: (l) => `reflects ${(l * 5).toFixed(0)}% of melee damage, +${(l * 1.2).toFixed(1)}% evade`,
  },
  {
    id: 'frenzy',
    name: 'Frenzy',
    blurb: 'Fights hardest on the way out.',
    apply: (s, l) => { s.frenzy = Math.min(0.75, s.frenzy + l * 0.09) },
    describe: (l) => `up to ${(l * 9).toFixed(0)}% faster attacks as HP drops`,
  },
]

export const MUTATIONS_BY_ID = new Map(MUTATIONS.map((m) => [m.id, m]))

export interface MutationRoll {
  id: string
  level: number
}

export function describeRoll(roll: MutationRoll): string {
  const m = MUTATIONS_BY_ID.get(roll.id)
  return m ? `${m.name} ${roll.level}` : roll.id
}

