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
  /** Stable body shape index used by the renderer. */
  shape: number
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
  /** Title of this group's leader, if any — an Officer's or a Prospect's own name. Rendered as a banner in battle. */
  leaderLabel?: string | null
  /**
   * True for a group that IS one named individual — a Prospect fighting as
   * its own body, per docs/V0-DESIGN.md §4 (every Prospect gets its own
   * group, leading or not, so none of them can hide inside a squad and
   * become unkillable). Always paired with count === 1. Drives which groups
   * emit BattleEvents: fodder and Officer-led squads have no individual
   * identity to report on, so only named groups generate Hit/Died events.
   */
  named?: boolean
}

/**
 * Below this effectiveness a squad is COLLAPSING per docs/V0-DESIGN.md §7 —
 * fewer bodies and weaker blows at once. Shared by the sim's Collapsed event
 * and the report table's `.collapsing` row marker so the two never drift
 * apart.
 */
export const COLLAPSE_THRESHOLD = 0.6

export const enum BattleEventType {
  /** A named individual took damage. */
  Hit = 0,
  /** A named individual died. */
  Died = 1,
  /** A group's effectiveness crossed below COLLAPSE_THRESHOLD. */
  Collapsed = 2,
}

/**
 * One notable thing that happened, for a battle log and a leader HUD to
 * share — see docs/V0-DESIGN.md §5c. Deliberately NOT a record of everything:
 * only named individuals and squad-level collapses are worth surfacing, or
 * the feed drowns in the same noise the per-row stat strip did.
 */
export interface BattleEvent {
  tick: number
  type: BattleEventType
  team: typeof TEAM_A | typeof TEAM_B
  groupIndex: number
  label: string
  /** Hit: damage dealt. Collapsed: effectiveness at the crossing. Died: unused (0). */
  value: number
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
  /** Total damage this group dealt over the battle. */
  damageDealt: number
  /** Total damage this group absorbed over the battle. */
  damageTaken: number
}

export type Winner = typeof TEAM_A | typeof TEAM_B | -1

/**
 * The three unit pools. Never "families" — see CLAUDE.md's terminology table.
 *
 * The sim itself is lineage-blind: it executes resolved stats and does not
 * know or care what produced them. This lives here because UnitType does, and
 * because `machine` needs to exist as a value before @salt/game can price
 * water or discipline by it.
 */
export type Lineage = 'mutant' | 'truekin' | 'machine'

/** A unit archetype, before mutations and officers touch it. */
export interface UnitType {
  id: number
  name: string
  lineage: Lineage
  /** Salvage per body. */
  cost: number
  base: Omit<ResolvedStats, 'regen' | 'quills' | 'frenzy'>
  color: number
  /** One-line flavour. */
  blurb: string
  /** What the thing actually is. Shown on hover. */
  description: string
}
