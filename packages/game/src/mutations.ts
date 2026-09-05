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
  /**
   * How much of a body's growth capacity this costs — see
   * docs/V0-DESIGN.md §15's "Instability". A contained, mostly-cosmetic
   * change (a ridge of bone, a keener eye) is 1; a real rebuild of what the
   * body does (breathing fire, a tail with a mind of its own) is 2 or 3.
   * Independent of `level` — a deep Horns is still the same *kind* of
   * change as a shallow one, just a better roll of it.
   */
  toll: number
  /**
   * A defect subtracts instead of adding. Never offered, never bought, never
   * rolled onto a shop body — the only way to acquire one is an Instability
   * flare (see `DEFECTS`). Flagged rather than kept in a separate type so
   * everything downstream — stat resolution, chips, tooltips, capacity — keeps
   * working on it unchanged.
   */
  defect?: boolean
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
    toll: 1,
    apply: (s, l) => { s.damage += l * 1.5 },
    describe: (l) => `+${(l * 1.5).toFixed(1)} damage`,
  },
  {
    id: 'carapace',
    name: 'Carapace',
    blurb: 'A shell, of sorts.',
    icon: 'shield',
    toll: 1,
    apply: (s, l) => { s.armor += l * 0.8 },
    describe: (l) => `+${(l * 0.8).toFixed(1)} armour`,
  },
  {
    id: 'bulging-sacs',
    name: 'Bulging Sacs',
    blurb: 'More of it to kill.',
    icon: 'mass',
    toll: 1,
    apply: (s, l) => { s.hp += l * 7 },
    describe: (l) => `+${l * 7} HP`,
  },
  {
    id: 'adrenal-glands',
    name: 'Adrenal Glands',
    blurb: 'Always at a run.',
    icon: 'chevron',
    toll: 1,
    apply: (s, l) => { s.moveSpeed += l * 0.5 },
    describe: (l) => `+${(l * 0.5).toFixed(1)} move speed`,
  },
  {
    id: 'twitch-reflex',
    name: 'Twitch Reflex',
    blurb: 'Flinches before the blow lands.',
    icon: 'dash',
    toll: 1,
    apply: (s, l) => { s.evade += l * 0.022 },
    describe: (l) => `+${(l * 2.2).toFixed(1)}% evade`,
  },
  {
    id: 'keen-sense',
    name: 'Keen Sense',
    blurb: 'Smells where you will be.',
    icon: 'eye',
    toll: 1,
    apply: (s, l) => { s.accuracy += l * 0.02 },
    describe: (l) => `+${(l * 2).toFixed(0)}% accuracy`,
  },
  {
    id: 'serrated-claws',
    name: 'Serrated Claws',
    blurb: 'Enthusiasm over precision.',
    icon: 'fang',
    toll: 2,
    apply: (s, l) => { s.damage += l * 2.6; s.accuracy -= 0.06 },
    describe: (l) => `+${(l * 2.6).toFixed(1)} damage, -6% accuracy`,
  },
  {
    id: 'flaming-ray',
    name: 'Flaming Ray',
    blurb: 'It opens its mouth and the air lights up.',
    icon: 'flame',
    toll: 3,
    apply: (s, l) => { s.range = Math.max(s.range, 90 + l * 22); s.damage *= 0.8 },
    describe: (l) => `ranged attack (${90 + l * 22} range), -20% damage`,
  },
  {
    id: 'dense-bone',
    name: 'Dense Bone',
    blurb: 'Heavy, and slow with it.',
    icon: 'shield',
    toll: 2,
    apply: (s, l) => { s.armor += l * 1.1; s.moveSpeed -= 0.7 },
    describe: (l) => `+${(l * 1.1).toFixed(1)} armour, -0.7 move speed`,
  },
  {
    id: 'regeneration',
    name: 'Regeneration',
    blurb: 'Knits itself back together, slowly.',
    icon: 'drop',
    toll: 2,
    apply: (s, l) => { s.regen += l * 0.06 },
    describe: (l) => `+${(l * 0.06 * 20).toFixed(1)} HP/sec`,
  },
  {
    id: 'quills',
    name: 'Quills',
    blurb: 'Punching it is its own punishment.',
    icon: 'burst',
    toll: 2,
    apply: (s, l) => { s.quills += l * 0.06 },
    describe: (l) => `reflects ${(l * 6).toFixed(0)}% of melee damage`,
  },
  {
    id: 'razor-tail',
    name: 'Razor Tail',
    blurb: 'The last thing to touch it is usually the tail.',
    icon: 'burst',
    toll: 2,
    apply: (s, l) => { s.quills += l * 0.05; s.evade += l * 0.012 },
    describe: (l) => `reflects ${(l * 5).toFixed(0)}% of melee damage, +${(l * 1.2).toFixed(1)}% evade`,
  },
  {
    id: 'frenzy',
    name: 'Frenzy',
    blurb: 'Fights hardest on the way out.',
    icon: 'bolt',
    toll: 2,
    apply: (s, l) => { s.frenzy = Math.min(0.75, s.frenzy + l * 0.09) },
    describe: (l) => `up to ${(l * 9).toFixed(0)}% faster attacks as HP drops`,
  },
]

/**
 * What a body grows when nobody is choosing — docs/V0-DESIGN.md §15.
 *
 * Deliberately one defect per stat family in MUTATIONS above, mirrored:
 * Horns has Withered Limb, Carapace has Sloughing Skin, Bulging Sacs has
 * Brittle Frame, and so on. A player who has learned what the shield glyph
 * means already knows what a bad one costs, so a flare needs no new visual
 * vocabulary to be read at a glance — only the colour changes.
 *
 * These are never in the growth pool and never on a shop body. The sole way
 * to get one is to push a body past its own capacity and have Instability
 * find a way out.
 *
 * PLACEHOLDER NUMBERS — magnitudes are set to mirror the buff they shadow,
 * not measured. Tune against sim:campaign once there are runs behind them.
 */
export const DEFECTS: readonly Mutation[] = [
  {
    id: 'withered-limb',
    name: 'Withered Limb',
    blurb: 'It hangs there, mostly.',
    icon: 'blade',
    toll: 1,
    defect: true,
    apply: (s, l) => { s.damage -= l * 2.2 },
    describe: (l) => `-${(l * 2.2).toFixed(1)} damage`,
  },
  {
    id: 'sloughing-skin',
    name: 'Sloughing Skin',
    blurb: 'Comes off in sheets. Grows back thinner.',
    icon: 'shield',
    toll: 1,
    defect: true,
    apply: (s, l) => { s.armor -= l * 0.9 },
    describe: (l) => `-${(l * 0.9).toFixed(1)} armour`,
  },
  {
    id: 'brittle-frame',
    name: 'Brittle Frame',
    blurb: 'Bones like fired clay.',
    icon: 'mass',
    toll: 1,
    defect: true,
    apply: (s, l) => { s.hp -= l * 7 },
    describe: (l) => `-${l * 7} HP`,
  },
  {
    id: 'dragging-gait',
    name: 'Dragging Gait',
    blurb: 'The hip went, and never set.',
    icon: 'chevron',
    toll: 1,
    defect: true,
    apply: (s, l) => { s.moveSpeed -= l * 0.6 },
    describe: (l) => `-${(l * 0.6).toFixed(1)} move speed`,
  },
  {
    id: 'palsy',
    name: 'Palsy',
    blurb: 'The hand does not always agree with the arm.',
    icon: 'dash',
    toll: 1,
    defect: true,
    apply: (s, l) => { s.evade -= l * 0.03 },
    describe: (l) => `-${(l * 3).toFixed(0)}% evade`,
  },
  {
    id: 'clouded-eye',
    name: 'Clouded Eye',
    blurb: 'Milk-white, and spreading.',
    icon: 'eye',
    toll: 1,
    defect: true,
    apply: (s, l) => { s.accuracy -= l * 0.05 },
    describe: (l) => `-${(l * 5).toFixed(0)}% accuracy`,
  },
]

/**
 * Both tables, because everything downstream of a roll — stat resolution,
 * chips, tooltips, capacity — only ever has an id and needs to find it.
 * MUTATIONS itself stays clean, so nothing can offer or sell a defect.
 */
export const MUTATIONS_BY_ID = new Map(
  [...MUTATIONS, ...DEFECTS].map((m) => [m.id, m] as const),
)

export interface MutationRoll {
  id: string
  level: number
}

export function describeRoll(roll: MutationRoll): string {
  const m = MUTATIONS_BY_ID.get(roll.id)
  return m ? `${m.name} ${roll.level}` : roll.id
}

