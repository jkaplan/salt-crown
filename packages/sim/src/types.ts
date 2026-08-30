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
  /**
   * True only for a Prospect's own group — never a squad (even one an
   * Officer leads: an Officer has no body of its own, so there's nothing to
   * maim) and never a Machine (its permanent-loss story is already condition
   * decay, docs/V0-DESIGN.md §3 — a second one would fight it, not add to
   * it). A maimable body that would die instead rolls to survive maimed;
   * see MAIM_CHANCE and Battle.resolveDeath.
   */
  maimable?: boolean
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
  /** A maimable individual would have died and rolled to survive maimed instead. */
  Maimed = 3,
}

/**
 * Chance a maimable body rolls to survive, maimed, instead of dying outright
 * — checked at the moment it would otherwise die. Uncommon by design: this is
 * meant to read as a real event in a Prospect's history, not a soft floor
 * under ordinary deaths. PLACEHOLDER, see docs/V0-DESIGN §14 — tune with the
 * batch-sim harness once there's data on how often it actually fires.
 */
export const MAIM_CHANCE = 0.12

/**
 * Chance a landed hit is a critical one, and the flat multiplier applied to
 * the SWING before armour — a crit still gets partially eaten by heavy
 * armour, same as any other hit, which is what "armour is flat reduction,
 * not a percentage" means applied consistently. Uniform across every unit
 * for now: no source yet grants or resists crit, so it's pure combat spice
 * rather than a build-around. See docs/V0-DESIGN.md §15 for the measurement
 * these were checked against.
 */
export const CRIT_CHANCE = 0.1
export const CRIT_MULTIPLIER = 1.75

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
  /** Hit: damage dealt. Collapsed: effectiveness at the crossing. Died/Maimed: unused (0). */
  value: number
  /**
   * Died/Maimed only: the group index of whoever landed the fatal-or-would-be
   * fatal blow, or -1 if nothing did (e.g. a draw's timeout). -1 by default
   * for every other event type — Hit and Collapsed never set this.
   */
  sourceGroupIndex: number
  /** Same moment, already resolved to a label — '' when sourceGroupIndex is -1. */
  sourceLabel: string
  /**
   * Hit/Died/Maimed only: the specific body this happened to. A named GROUP
   * is usually one body, but a named boss/legendary SQUAD isn't — this is
   * what lets a floating damage number land on the actual struck body
   * instead of the group's average position. -1 for Collapsed, which is
   * group-level by nature.
   */
  unitIndex: number
  /** Hit only: whether this tick's damage against the target included a crit. */
  crit: boolean
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
  /** Damage this group's swings lost to enemy armour. */
  damageBlocked: number
  /** Swings taken and swings that connected. */
  swings: number
  hits: number
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
  /**
   * Overrides the lineage's discipline, if set.
   *
   * Lineage answers "how does this pool behave when it starts losing", which
   * is the right question for the three POOLS THE PLAYER RECRUITS FROM. It is
   * the wrong question for a pack animal or a thing from under the salt: they
   * are mutant-lineage because the wasteland mutated them, and that says
   * nothing useful about whether they understand they are losing.
   *
   * Enemy-only content, in practice. Nothing recruitable sets it.
   */
  discipline?: number
}
