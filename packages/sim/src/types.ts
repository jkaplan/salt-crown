/** Sim runs at a fixed 20 Hz. Render interpolates; never tie sim to frame time. */
export const TICKS_PER_SECOND = 20
export const MS_PER_TICK = 1000 / TICKS_PER_SECOND

export const WORLD_W = 1600
export const WORLD_H = 900

export const TEAM_A = 0
export const TEAM_B = 1

/** At or below this range a unit counts as melee — used by Quills. */
export const MELEE_RANGE = 40

/**
 * Fully resolved combat stats for one group: base unit type, plus mutations,
 * plus any officer bonus, already folded together. The sim does no derivation
 * of its own — @salt/game resolves, the sim executes.
 *
 * `armor` is FLAT reduction, not a percentage. Design invariant, see
 * docs/V0-DESIGN.md.
 */
export interface ResolvedStats {
  hp: number
  armor: number
  damage: number
  /** Sim ticks between attacks. */
  attackInterval: number
  /** World units, centre to centre. */
  range: number
  /** World units per tick. */
  moveSpeed: number
  accuracy: number
  evade: number
  radius: number

  // Behavioural mutations.
  /** HP restored per tick. */
  regen: number
  /** Fraction of incoming melee damage reflected at the attacker. */
  quills: number
  /** 0..1 — how much attack interval shortens as HP drops. */
  frenzy: number
}

export interface SimGroup {
  team: typeof TEAM_A | typeof TEAM_B
  count: number
  label: string
  color: number
  stats: ResolvedStats
  /**
   * How well this group keeps fighting as it bleeds: the damage multiplier it
   * retains once it has taken total losses. 1 = never degrades.
   *
   * Morale is a multiplier, not an exit — nobody flees. A bleeding squad hits
   * softer, so a losing side collapses instead of walking off. Mutants fold
   * fast, True Kin hold, Machines never notice. See docs/V0-DESIGN.md §7.
   */
  discipline: number
  /** Officer title, if this squad is led. Rendered as a banner in battle. */
  leaderLabel?: string | null
}

export interface BattleConfig {
  seed: number
  groups: readonly SimGroup[]
  /** Battle is declared a draw past this. Default three minutes of sim time. */
  maxTicks?: number
}

/** Per-group outcome, for the post-battle report. */
export interface GroupResult {
  label: string
  team: number
  started: number
  dead: number
  /** Still standing when it ended. */
  survived: number
  /** Damage multiplier it ended on — how far its morale had fallen. */
  endEffectiveness: number
}

export type Winner = typeof TEAM_A | typeof TEAM_B | -1

/** A unit archetype, before mutations and officers touch it. */
export interface UnitType {
  id: number
  name: string
  lineage: 'mutant' | 'truekin'
  /** Salvage per body. */
  cost: number
  base: Omit<ResolvedStats, 'regen' | 'quills' | 'frenzy'>
  color: number
  /** One-line flavour. */
  blurb: string
  /** What the thing actually is. Shown on hover. */
  description: string
}
