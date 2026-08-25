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
/**
 * Which glyph a mutation reads as, not which mutation it is.
 *
 * Grouped by the stat family the mutation is actually about, not one glyph
 * per row — carapace and dense-bone are both 'shield', quills and razor-tail
 * are both 'burst'. That reuse is the point: a player who's learned "shield
 * means armour" should recognise the family at a glance across every
 * mutation that has it, the same way a currency symbol works regardless of
 * the amount next to it. The name and tooltip still say which one it is.
 */
export type MutationIconId =
  | 'blade' | 'fang' | 'shield' | 'mass' | 'chevron' | 'dash' | 'eye'
  | 'flame' | 'drop' | 'burst' | 'bolt'

export interface Mutation {
  id: string
  name: string
  blurb: string
  icon: MutationIconId
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
    icon: 'blade',
    apply: (s, l) => { s.damage += l * 1.5 },
    describe: (l) => `+${(l * 1.5).toFixed(1)} damage`,
  },
  {
    id: 'carapace',
    name: 'Carapace',
    blurb: 'A shell, of sorts.',
    icon: 'shield',
    apply: (s, l) => { s.armor += l * 0.8 },
    describe: (l) => `+${(l * 0.8).toFixed(1)} armour`,
  },
  {
    id: 'bulging-sacs',
    name: 'Bulging Sacs',
    blurb: 'More of it to kill.',
    icon: 'mass',
    apply: (s, l) => { s.hp += l * 7 },
    describe: (l) => `+${l * 7} HP`,
  },
  {
    id: 'adrenal-glands',
    name: 'Adrenal Glands',
    blurb: 'Always at a run.',
    icon: 'chevron',
    apply: (s, l) => { s.moveSpeed += l * 0.5 },
    describe: (l) => `+${(l * 0.5).toFixed(1)} move speed`,
  },
  {
    id: 'twitch-reflex',
    name: 'Twitch Reflex',
    blurb: 'Flinches before the blow lands.',
    icon: 'dash',
    apply: (s, l) => { s.evade += l * 0.022 },
    describe: (l) => `+${(l * 2.2).toFixed(1)}% evade`,
  },
  {
    id: 'keen-sense',
    name: 'Keen Sense',
    blurb: 'Smells where you will be.',
    icon: 'eye',
    apply: (s, l) => { s.accuracy += l * 0.02 },
    describe: (l) => `+${(l * 2).toFixed(0)}% accuracy`,
  },
  {
    id: 'serrated-claws',
    name: 'Serrated Claws',
    blurb: 'Enthusiasm over precision.',
    icon: 'fang',
    apply: (s, l) => { s.damage += l * 2.6; s.accuracy -= 0.06 },
    describe: (l) => `+${(l * 2.6).toFixed(1)} damage, -6% accuracy`,
  },
  {
    id: 'flaming-ray',
    name: 'Flaming Ray',
    blurb: 'It opens its mouth and the air lights up.',
    icon: 'flame',
    apply: (s, l) => { s.range = Math.max(s.range, 90 + l * 22); s.damage *= 0.8 },
    describe: (l) => `ranged attack (${90 + l * 22} range), -20% damage`,
  },
  {
    id: 'dense-bone',
    name: 'Dense Bone',
    blurb: 'Heavy, and slow with it.',
    icon: 'shield',
    apply: (s, l) => { s.armor += l * 1.1; s.moveSpeed -= 0.7 },
    describe: (l) => `+${(l * 1.1).toFixed(1)} armour, -0.7 move speed`,
  },
  {
    id: 'regeneration',
    name: 'Regeneration',
    blurb: 'Knits itself back together, slowly.',
    icon: 'drop',
    apply: (s, l) => { s.regen += l * 0.06 },
    describe: (l) => `+${(l * 0.06 * 20).toFixed(1)} HP/sec`,
  },
  {
    id: 'quills',
    name: 'Quills',
    blurb: 'Punching it is its own punishment.',
    icon: 'burst',
    apply: (s, l) => { s.quills += l * 0.06 },
    describe: (l) => `reflects ${(l * 6).toFixed(0)}% of melee damage`,
  },
  {
    id: 'razor-tail',
    name: 'Razor Tail',
    blurb: 'The last thing to touch it is usually the tail.',
    icon: 'burst',
    apply: (s, l) => { s.quills += l * 0.05; s.evade += l * 0.012 },
    describe: (l) => `reflects ${(l * 5).toFixed(0)}% of melee damage, +${(l * 1.2).toFixed(1)}% evade`,
  },
  {
    id: 'frenzy',
    name: 'Frenzy',
    blurb: 'Fights hardest on the way out.',
    icon: 'bolt',
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

