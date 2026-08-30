import { Rng } from './rng.js'
import { SpatialGrid } from './spatial.js'
import {
  BattleEventType,
  COLLAPSE_THRESHOLD,
  CRIT_CHANCE,
  CRIT_MULTIPLIER,
  MAIM_CHANCE,
  MELEE_RANGE,
  TEAM_A,
  TEAM_B,
  WORLD_H,
  WORLD_W,
} from './types.js'
import type { BattleConfig, BattleEvent, GroupResult, SimGroup, Winner } from './types.js'

/** Ring buffer capacity. Past this, the oldest notable event is overwritten. */
const EVENT_CAPACITY = 512

const DEFAULT_MAX_TICKS = 20 * 180

/* ------------------------------------------------------------- bodies ---
 *
 * Three of the spacing numbers below are not free choices — they all have to
 * clear the same distance, and getting one of them wrong fails quietly rather
 * than loudly. So that distance gets a name.
 */

/**
 * The widest body the sim is built to handle, in world units.
 *
 * This is a contract with @salt/game, not a per-unit limit the sim clamps:
 * every spacing constant below is checked against it, and a body wider than
 * this breaks them all at once in ways that look like physics bugs rather
 * than like a number being out of range. The constructor rejects an oversized
 * group outright, and a test in @salt/game holds the content to it.
 *
 * Widest V0 body is the Sludge-Waller at 12.
 */
export const MAX_BODY_RADIUS = 12

/** Personal space. Bodies rest this far apart rather than touching. */
const SEPARATION_BUFFER = 10

/**
 * The furthest apart two bodies can be and still push on each other. Every
 * distance that has to be "at least a body apart" is measured against this.
 */
export const MAX_CONTACT_DISTANCE = MAX_BODY_RADIUS * 2 + SEPARATION_BUFFER

/* ---------------------------------------------------------- separation --
 *
 * Iterative relaxation, not a physics solver.
 */

const SEPARATION_PASSES = 2
/** Fraction of the overlap correction applied per pass. <1 settles, 1 snaps. */
const SEPARATION_STRENGTH = 0.45

/**
 * Spatial grid cell, in world units.
 *
 * MUST be >= MAX_CONTACT_DISTANCE. separate() only ever compares a cell
 * against itself and four forward neighbours, so a pair more than one cell
 * apart on either axis is never tested — and if bodies can interact further
 * than a cell is wide, some overlapping pairs are simply never separated.
 * The failure is silent and looks like units clipping through each other.
 *
 * The headroom above the minimum is deliberate: cells sized exactly to the
 * contact distance put nearly every pair in a neighbour sweep rather than in
 * the cheaper same-cell loop.
 */
export const CELL_SIZE = 48

/* ----------------------------------------------------------- formation --
 *
 * Melee at the front, ranged behind, arranged automatically. The player never
 * places anything — this is a pure auto battler.
 */

const ROWS = 30
const MAX_FIGHTERS_PER_LINE = 10
/**
 * Vertical gap between neighbours in a column, and horizontal gap between
 * columns. Both MUST clear MAX_CONTACT_DISTANCE, or a formation spawns
 * already overlapping and the opening ticks are spent shoving itself apart
 * instead of advancing.
 *
 * LINE_SPACING is the looser of the two because columns close along X: ranks
 * behind the front compress forward as the line engages, and starting them
 * at the bare minimum means the second rank is inside the first before
 * contact.
 */
export const ROW_SPACING = 36
export const LINE_SPACING = 44
const SQUAD_GAP_LINES = 1.2
const FORMATION_OFFSET = 150

/* ------------------------------------------------------------ movement -- */

/**
 * Dead band: how far past reach a unit tolerates before closing again.
 *
 * Must comfortably exceed how far separation can shove a body in one tick,
 * or a unit in a packed line flips between "engaged" and "closing" every
 * tick and the whole formation vibrates. Worst case per pass is
 * MAX_CONTACT_DISTANCE * 0.5 * SEPARATION_STRENGTH against a fully
 * coincident pair, which no settled line ever reaches.
 */
const RANGE_HYSTERESIS = 14
/** Lateral correction is damped so lines close head-on rather than orbiting. */
const LATERAL_DAMPING = 1

/* --------------------------------------------------------------- arena --
 *
 * The field grows with the headcount so a 4000-body battle is not fought
 * shoulder to shoulder in a 1600x900 box. Endless mode is the reason this
 * exists; V0 encounters rarely cross the threshold.
 */

const ARENA_SCALE_THRESHOLD = 240
const ARENA_SCALE_STEP = 120
const ARENA_GROWTH_W = 140
const ARENA_GROWTH_H = 80
const MAX_WORLD_W = 3200
const MAX_WORLD_H = 1800

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

function scaledArenaSize(totalCombatants: number): { width: number; height: number } {
  if (totalCombatants <= ARENA_SCALE_THRESHOLD) {
    return { width: WORLD_W, height: WORLD_H }
  }
  const extra = totalCombatants - ARENA_SCALE_THRESHOLD
  const steps = Math.ceil(extra / ARENA_SCALE_STEP)
  return {
    width: Math.min(MAX_WORLD_W, WORLD_W + steps * ARENA_GROWTH_W),
    height: Math.min(MAX_WORLD_H, WORLD_H + steps * ARENA_GROWTH_H),
  }
}

/** Forward neighbours only — E, SE, S, SW — so each pair is visited once. */
const NEIGHBOR_DX = [1, 1, 0, -1]
const NEIGHBOR_DY = [0, 1, 1, 1]

function hashBytes(h: number, view: ArrayBufferView): number {
  const u8 = new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
  for (let i = 0; i < u8.length; i++) {
    h ^= u8[i]
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/**
 * One battle. Struct-of-arrays, zero allocation after construction.
 *
 * Deterministic: `(config, seed) => outcome`, always. Two Battles built from
 * the same config produce byte-identical state at every tick. The balance
 * harness and replay both depend on it; test/determinism.test.ts covers it.
 *
 * Battles are fought to the finish. Nobody flees — morale is a damage
 * multiplier instead, so a bleeding squad hits softer and a losing side
 * collapses rather than walking off the field.
 */
export class Battle {
  readonly count: number
  readonly worldW: number
  readonly worldH: number
  readonly groups: readonly SimGroup[]
  readonly maxTicks: number

  tick = 0
  aliveA = 0
  aliveB = 0

  // Per-unit, struct-of-arrays. Never reallocated.
  readonly x: Float32Array
  readonly y: Float32Array
  /** Position at the previous tick, for render interpolation. */
  readonly px: Float32Array
  readonly py: Float32Array
  readonly hp: Float32Array
  readonly team: Uint8Array
  readonly group: Uint16Array
  readonly alive: Uint8Array

  // Per-group.
  readonly groupStartCount: Int32Array
  readonly groupAlive: Int32Array
  /** Current damage multiplier, from remaining strength and discipline. */
  readonly groupEff: Float32Array
  /** Index of the first unit in each group. Group members are contiguous. */
  readonly groupFirstUnit: Int32Array
  /** Total damage dealt by each group over the battle. */
  readonly groupDamageDealt: Float32Array
  /** Total damage absorbed by each group over the battle. */
  readonly groupDamageTaken: Float32Array
  /**
   * Damage this group's swings LOST to enemy armour.
   *
   * The single most explanatory number in the game, and it used to be thrown
   * away at the point it was computed. Armour is flat reduction, so a Chaff
   * swinging 5 into 7 armour lands 1 — a warband can be twice the size of what
   * it is fighting and land a tenth of the damage, and nothing on the report
   * could say so. "I had more fighters and lost" is usually this.
   */
  readonly groupDamageBlocked: Float32Array
  /** Swings taken, and swings that connected. Accuracy vs evade, made visible. */
  readonly groupSwings: Float32Array
  readonly groupHits: Float32Array

  private readonly maxHp: Float32Array
  private readonly cooldown: Int32Array
  private readonly target: Int32Array
  /** Whether a unit is already in contact; drives the movement dead band. */
  private readonly engaged: Uint8Array
  private readonly sepX: Float32Array
  private readonly sepY: Float32Array
  /**
   * Tick each unit last landed a blow. Render-only — the renderer turns this
   * into a lunge. Knockback used to live in the sim and physically shoved both
   * parties apart on every hit, so units walked back in the next tick and the
   * whole line vibrated. The bump is a visual, so it belongs in the view.
   */
  readonly lastAttackTick: Int32Array
  /**
   * Who unit i last landed a blow on. Render-only, same reasoning as
   * lastAttackTick above — this is what lets a ranged attack draw a streak to
   * the body it actually hit, rather than to `target[i]`, which keeps moving
   * and isn't guaranteed to still be the one it just struck by render time.
   */
  readonly lastAttackTarget: Int32Array
  /**
   * Group index of whoever last landed a blow ON unit i, this tick or
   * whenever the last one before it was — the reverse of lastAttackTarget.
   * Only consulted at the moment a unit would die (Died/Maimed's source), so
   * it doesn't need per-tick decay: a fatal blow always lands the same tick
   * the damage that caused it did.
   */
  private readonly lastHitByGroup: Int32Array
  /** Damage accumulated this tick, applied in phase 2. */
  private readonly damage: Float32Array
  /**
   * Whether ANY hit landed on unit i this tick was a crit — a body can take
   * more than one swing in the same tick, and `damage[i]` already sums them,
   * so this is the same "aggregate, don't try to separate" treatment applied
   * to the Hit event's `value`.
   */
  private readonly critFlag: Uint8Array

  private readonly rng: Rng
  private readonly grid: SpatialGrid

  /**
   * Notable events (named individuals hit or killed, a squad crossing the
   * collapse threshold) for a battle log and a leader HUD to share — see
   * docs/V0-DESIGN.md §5c. Fixed-capacity ring buffer, preallocated here and
   * never reallocated — the tick loop only overwrites existing slots.
   */
  private readonly events: BattleEvent[]
  private eventCursor = 0
  /** Total events ever emitted, including ones the ring has since overwritten. */
  eventCount = 0
  /** Edge-trigger for Collapsed: only fires the tick a group first drops below threshold. */
  private readonly collapsedFlag: Uint8Array

  constructor(config: BattleConfig) {
    this.groups = config.groups
    this.maxTicks = config.maxTicks ?? DEFAULT_MAX_TICKS
    this.rng = new Rng(config.seed)

    let total = 0
    for (const g of config.groups) {
      /*
       * Loud, not clamped. An oversized body does not misbehave visibly — it
       * quietly stops being separated from anything more than a grid cell
       * away and spawns inside its own formation. Better to refuse the config
       * at construction, where the content that caused it is still on screen.
       */
      if (g.stats.radius > MAX_BODY_RADIUS) {
        throw new Error(
          `${g.label}: radius ${g.stats.radius} exceeds MAX_BODY_RADIUS ${MAX_BODY_RADIUS}. ` +
            'Raising it means raising ROW_SPACING and CELL_SIZE with it — see battle.ts.',
        )
      }
      total += g.count
    }
    this.count = total
    const arena = scaledArenaSize(total)
    this.worldW = arena.width
    this.worldH = arena.height

    this.x = new Float32Array(total)
    this.y = new Float32Array(total)
    this.px = new Float32Array(total)
    this.py = new Float32Array(total)
    this.hp = new Float32Array(total)
    this.maxHp = new Float32Array(total)
    this.team = new Uint8Array(total)
    this.group = new Uint16Array(total)
    this.alive = new Uint8Array(total)
    this.cooldown = new Int32Array(total)
    this.target = new Int32Array(total)
    this.engaged = new Uint8Array(total)
    this.sepX = new Float32Array(total)
    this.sepY = new Float32Array(total)
    this.lastAttackTick = new Int32Array(total).fill(-999)
    this.lastAttackTarget = new Int32Array(total).fill(-1)
    this.lastHitByGroup = new Int32Array(total).fill(-1)
    this.damage = new Float32Array(total)
    this.critFlag = new Uint8Array(total)

    const gn = config.groups.length
    this.groupStartCount = new Int32Array(gn)
    this.groupAlive = new Int32Array(gn)
    this.groupEff = new Float32Array(gn)
    this.groupFirstUnit = new Int32Array(gn)
    this.groupDamageDealt = new Float32Array(gn)
    this.groupDamageTaken = new Float32Array(gn)
    this.groupDamageBlocked = new Float32Array(gn)
    this.groupSwings = new Float32Array(gn)
    this.groupHits = new Float32Array(gn)
    this.collapsedFlag = new Uint8Array(gn)

    this.events = new Array<BattleEvent>(EVENT_CAPACITY)
    for (let e = 0; e < EVENT_CAPACITY; e++) {
      this.events[e] = {
        tick: 0, type: BattleEventType.Hit, team: TEAM_A, groupIndex: 0, label: '', value: 0,
        sourceGroupIndex: -1, sourceLabel: '', unitIndex: -1, crit: false,
      }
    }

    this.grid = new SpatialGrid(this.worldW, this.worldH, CELL_SIZE, total)

    this.place()

    for (let g = 0; g < gn; g++) {
      this.groupStartCount[g] = config.groups[g].count
      this.groupAlive[g] = config.groups[g].count
      this.groupEff[g] = 1
      if (config.groups[g].team === TEAM_A) this.aliveA += config.groups[g].count
      else this.aliveB += config.groups[g].count
    }

    this.px.set(this.x)
    this.py.set(this.y)
  }

  /**
   * Melee at the front, ranged behind, arranged automatically — the player
   * never places anything. Groups are ordered by range so short-range bodies
   * screen the shooters.
   */
  private place(): void {
    const centreY = this.worldH / 2
    const rowsByViewport = Math.max(1, Math.min(ROWS, Math.floor((this.worldH - 40) / ROW_SPACING)))
    const rowsPerColumn = Math.min(MAX_FIGHTERS_PER_LINE, rowsByViewport)
    let idx = 0

    for (const team of [TEAM_A, TEAM_B] as const) {
      const order = this.groups
        .map((g, i) => ({ g, i }))
        .filter((e) => e.g.team === team)
        .sort((a, b) => a.g.stats.range - b.g.stats.range || a.i - b.i)

      const anchorX = this.worldW / 2 + (team === TEAM_A ? -FORMATION_OFFSET : FORMATION_OFFSET)
      const dir = team === TEAM_A ? -1 : 1
      let col = 0

      for (const { g, i } of order) {
        this.groupFirstUnit[i] = idx
        const commanderOffset = g.leaderLabel ? this.rng.int(g.count) : -1
        for (let k = 0; k < g.count; k++, idx++) {
          const row = k % rowsPerColumn
          const colOffset = (k / rowsPerColumn) | 0
          const commanderBias = k === commanderOffset ? -0.38 : 0
          const radius = g.stats.radius
          const rawX =
            anchorX + dir * (col + colOffset + commanderBias) * LINE_SPACING + this.rng.range(-3, 3)
          const rawY = centreY + (row - (rowsPerColumn - 1) / 2) * ROW_SPACING + this.rng.range(-3, 3)
          this.group[idx] = i
          this.team[idx] = team
          this.hp[idx] = g.stats.hp
          this.maxHp[idx] = g.stats.hp
          this.alive[idx] = 1
          this.cooldown[idx] = 0
          this.target[idx] = -1
          this.x[idx] = clamp(rawX, radius, this.worldW - radius)
          this.y[idx] = clamp(rawY, radius, this.worldH - radius)
        }
        col += Math.ceil(g.count / rowsPerColumn) + SQUAD_GAP_LINES
      }
    }
  }

  get finished(): boolean {
    return this.aliveA === 0 || this.aliveB === 0 || this.tick >= this.maxTicks
  }

  get winner(): Winner {
    if (this.aliveA > 0 && this.aliveB === 0) return TEAM_A
    if (this.aliveB > 0 && this.aliveA === 0) return TEAM_B
    return -1
  }

  results(): GroupResult[] {
    return this.groups.map((g, i) => ({
      label: g.label,
      team: g.team,
      started: this.groupStartCount[i],
      dead: this.groupStartCount[i] - this.groupAlive[i],
      survived: this.groupAlive[i],
      endEffectiveness: this.groupEff[i],
      damageDealt: this.groupDamageDealt[i],
      damageTaken: this.groupDamageTaken[i],
      damageBlocked: this.groupDamageBlocked[i],
      swings: this.groupSwings[i],
      hits: this.groupHits[i],
    }))
  }

  /**
   * Advance exactly one 20 Hz tick.
   *
   * The tick is *simultaneous*: every unit reads positions and liveness from
   * the start-of-tick snapshot (px/py), and damage lands in a second phase.
   * Resolving sequentially instead gives whichever team holds the lower
   * indices a half-tick head start on closing to range — worth ~60/40 in a
   * mirror match, which is exactly what the batch harness exists to catch.
   */
  step(): void {
    if (this.finished) return
    this.tick++

    const { x, y, px, py, hp, maxHp, alive, cooldown, target, damage, critFlag, group, groupEff, engaged, rng } = this
    const groups = this.groups
    const count = this.count

    px.set(x)
    py.set(y)
    this.grid.build(count, px, py, alive)
    damage.fill(0)
    critFlag.fill(0)
    this.updateMorale()

    // Phase 1 — intent. Reads only the snapshot; writes movement and damage.
    for (let i = 0; i < count; i++) {
      if (alive[i] === 0) continue
      const gi = group[i]
      const st = groups[gi].stats

      if (st.regen > 0 && hp[i] < maxHp[i]) {
        const h = hp[i] + st.regen
        hp[i] = h > maxHp[i] ? maxHp[i] : h
      }

      if (cooldown[i] > 0) cooldown[i]--

      let t = target[i]
      if (t < 0 || alive[t] === 0) {
        t = this.nearestEnemy(i)
        target[i] = t
      }
      if (t < 0) continue

      const dx = px[t] - px[i]
      const dy = py[t] - py[i]
      const tt = groups[group[t]].stats
      const attackRange = st.range + tt.radius
      const d2 = dx * dx + dy * dy

      /*
       * A real dead band, not just a wider stop distance.
       *
       * Closing stops exactly AT attack range, so any nudge from separation
       * put a unit a hair outside and it stepped precisely back next tick —
       * a perfect one-tick limit cycle, which is what the jitter was. Once
       * engaged, a unit now tolerates being pushed RANGE_HYSTERESIS past its
       * reach before it bothers closing again, and keeps swinging throughout.
       */
      const band = engaged[i] === 1 ? attackRange + RANGE_HYSTERESIS : attackRange

      if (d2 > band * band) {
        engaged[i] = 0
        const d = Math.sqrt(d2)
        if (d > 1e-6) {
          const step = Math.min(st.moveSpeed, d - attackRange)
          // Lane-style approach: close head-on, and correct laterally only
          // gently, so lines converge instead of orbiting each other.
          x[i] += (dx / d) * step
          y[i] += (dy / d) * step * LATERAL_DAMPING
        }
        continue
      }

      engaged[i] = 1
      if (cooldown[i] === 0) {
        // Frenzy: swings come faster the closer to death this unit is.
        let interval = st.attackInterval
        if (st.frenzy > 0) {
          const missing = 1 - hp[i] / maxHp[i]
          interval = Math.round(interval * (1 - st.frenzy * missing))
          if (interval < 2) interval = 2
        }
        cooldown[i] = interval

        let chance = st.accuracy - tt.evade
        if (chance < 0.05) chance = 0.05
        else if (chance > 0.95) chance = 0.95

        this.groupSwings[gi]++
        if (rng.float() < chance) {
          this.groupHits[gi]++
          // A bleeding squad hits softer. Fewer bodies AND weaker blows makes
          // the collapse superlinear, which is what a rout should feel like.
          const isCrit = rng.float() < CRIT_CHANCE
          const swung = st.damage * groupEff[gi] * (isCrit ? CRIT_MULTIPLIER : 1)
          const raw = swung - tt.armor
          const dealt = raw > 1 ? raw : 1
          // What armour ate. Measured against the SWING, so it captures the
          // floor too: 5 into 7 armour lands 1 and loses 4.
          const blocked = swung - dealt
          if (blocked > 0) this.groupDamageBlocked[gi] += blocked
          damage[t] += dealt
          if (isCrit) critFlag[t] = 1
          this.lastHitByGroup[t] = gi

          this.lastAttackTick[i] = this.tick
          this.lastAttackTarget[i] = t

          this.groupDamageDealt[gi] += dealt
          this.groupDamageTaken[group[t]] += dealt
          if (tt.quills > 0 && st.range <= MELEE_RANGE) {
            damage[i] += dealt * tt.quills
            this.lastHitByGroup[i] = group[t]
            this.groupDamageTaken[gi] += dealt * tt.quills
            this.groupDamageDealt[group[t]] += dealt * tt.quills
          }
        }
      }
    }

    // Phase 2 — resolution. Overkill is possible and symmetric.
    for (let i = 0; i < count; i++) {
      if (alive[i] === 0 || damage[i] === 0) continue
      const gi = group[i]
      if (groups[gi].named) {
        this.pushEvent(BattleEventType.Hit, this.team[i], gi, damage[i], -1, '', i, critFlag[i] === 1)
      }
      hp[i] -= damage[i]
      if (hp[i] <= 0) this.resolveDeath(i)
    }

    this.separate()
  }

  /** Run to completion. Returns the tick count. */
  run(): number {
    while (!this.finished) this.step()
    return this.tick
  }

  /**
   * Effectiveness falls with remaining strength, floored by discipline.
   * Mutants fold toward 0.35 as they bleed; True Kin barely notice; Machines
   * sit at 1 forever. This is the whole risk curve — the stronger the army,
   * the harder it is to break, and the worse it is when it finally does.
   */
  private updateMorale(): void {
    for (let g = 0; g < this.groups.length; g++) {
      const start = this.groupStartCount[g]
      if (start === 0) {
        this.groupEff[g] = 1
        continue
      }
      const strength = this.groupAlive[g] / start
      const d = this.groups[g].discipline
      this.groupEff[g] = d + (1 - d) * strength

      // Collapsed fires once on the tick a group first drops below
      // threshold, not on every tick it stays there.
      if (this.groupEff[g] < COLLAPSE_THRESHOLD) {
        if (this.collapsedFlag[g] === 0) {
          this.collapsedFlag[g] = 1
          this.pushEvent(BattleEventType.Collapsed, this.groups[g].team, g, this.groupEff[g])
        }
      } else {
        this.collapsedFlag[g] = 0
      }
    }
  }

  /**
   * A body at 0 HP either dies or, if it's maimable, gets one roll not to.
   * Checked here rather than in kill() itself so a normal death (the roll
   * failed, or the body was never maimable — fodder, a squad, a Machine)
   * still goes through the exact same path it always has.
   */
  private resolveDeath(t: number): void {
    const gi = this.group[t]
    if (this.groups[gi].maimable && this.rng.float() < MAIM_CHANCE) {
      const src = this.lastHitByGroup[t]
      this.hp[t] = 1
      this.pushEvent(
        BattleEventType.Maimed, this.team[t], gi, 0,
        src, src >= 0 ? this.groups[src].label : '', t,
      )
      return
    }
    this.kill(t)
  }

  private kill(t: number): void {
    const gi = this.group[t]
    if (this.groups[gi].named) {
      const src = this.lastHitByGroup[t]
      this.pushEvent(
        BattleEventType.Died, this.team[t], gi, 0,
        src, src >= 0 ? this.groups[src].label : '', t,
      )
    }
    this.alive[t] = 0
    this.hp[t] = 0
    this.groupAlive[gi]--
    if (this.team[t] === TEAM_A) this.aliveA--
    else this.aliveB--
  }

  /** Overwrites the next ring slot in place — no allocation once the ring exists. */
  private pushEvent(
    type: BattleEventType, team: number, groupIndex: number, value: number,
    sourceGroupIndex = -1, sourceLabel = '', unitIndex = -1, crit = false,
  ): void {
    const e = this.events[this.eventCursor]
    e.tick = this.tick
    e.type = type
    e.team = team === TEAM_A ? TEAM_A : TEAM_B
    e.groupIndex = groupIndex
    e.label = this.groups[groupIndex].label
    e.value = value
    e.sourceGroupIndex = sourceGroupIndex
    e.sourceLabel = sourceLabel
    e.unitIndex = unitIndex
    e.crit = crit
    this.eventCursor = (this.eventCursor + 1) % EVENT_CAPACITY
    this.eventCount++
  }

  /**
   * Events emitted since `lastCount` (a caller's previous `eventCount`),
   * oldest first, as fresh copies — safe to hold onto after this call, unlike
   * a reference into the ring buffer itself. Called by the renderer at its
   * own throttled rate, not from the tick loop, so the allocation here is
   * fine: the "no allocation in the tick loop" rule (CLAUDE.md) is about
   * step(), not about reading the result back out.
   */
  newEventsSince(lastCount: number): BattleEvent[] {
    const missed = this.eventCount - lastCount
    if (missed <= 0) return []
    const n = Math.min(missed, EVENT_CAPACITY)
    const out: BattleEvent[] = []
    for (let k = n - 1; k >= 0; k--) {
      const idx = (this.eventCursor - 1 - k + EVENT_CAPACITY * 2) % EVENT_CAPACITY
      const e = this.events[idx]
      out.push({
        tick: e.tick, type: e.type, team: e.team, groupIndex: e.groupIndex, label: e.label, value: e.value,
        sourceGroupIndex: e.sourceGroupIndex, sourceLabel: e.sourceLabel,
        unitIndex: e.unitIndex, crit: e.crit,
      })
    }
    return out
  }

  /**
   * Nearest living enemy, by expanding ring search over the grid.
   *
   * Stops as soon as the closest cell in the next ring can't beat what we
   * have, so it's genuinely nearest rather than approximately so. Ties break
   * on the lower index, keeping the result independent of scan order.
   */
  private nearestEnemy(i: number): number {
    // Snapshot positions, to match the rest of phase 1.
    const { px: x, py: y, team, alive, grid } = this
    const { starts, items, cols, rows, cellSize } = grid

    const myTeam = team[i]
    const qx = x[i]
    const qy = y[i]
    const cx = grid.cellX(qx)
    const cy = grid.cellY(qy)

    let best = -1
    let bestD2 = Infinity
    const maxR = cols > rows ? cols : rows

    for (let r = 0; r <= maxR; r++) {
      if (best >= 0) {
        const minPossible = (r - 1) * cellSize
        if (minPossible > 0 && minPossible * minPossible > bestD2) break
      }

      const gx0 = cx - r
      const gx1 = cx + r
      const gy0 = cy - r
      const gy1 = cy + r

      for (let gy = gy0; gy <= gy1; gy++) {
        if (gy < 0 || gy >= rows) continue
        const edgeRow = gy === gy0 || gy === gy1
        const stepX = edgeRow ? 1 : gx1 - gx0
        for (let gx = gx0; gx <= gx1; gx += stepX) {
          if (gx < 0 || gx >= cols) continue
          const c = gy * cols + gx
          const end = starts[c + 1]
          for (let k = starts[c]; k < end; k++) {
            const j = items[k]
            if (team[j] === myTeam || alive[j] === 0) continue
            const dx = x[j] - qx
            const dy = y[j] - qy
            const d2 = dx * dx + dy * dy
            if (d2 < bestD2 || (d2 === bestD2 && j < best)) {
              bestD2 = d2
              best = j
            }
          }
        }
      }
    }

    return best
  }

  /** Keeps bodies from stacking. Pairs are visited exactly once. */
  private separate(): void {
    const { x, y, alive, sepX, sepY, grid } = this
    const { starts, items, cols, rows } = grid
    const count = this.count

    // Built once, not once per pass. Separation is iterative relaxation and
    // positions drift only a little between passes, so a slightly stale grid
    // costs nothing — while rebuilding it three times a tick was most of a 3x
    // slowdown against the M0 baseline.
    grid.build(count, x, y, alive)

    for (let pass = 0; pass < SEPARATION_PASSES; pass++) {
      sepX.fill(0)
      sepY.fill(0)

      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          const c = gy * cols + gx
          const s = starts[c]
          const e = starts[c + 1]
          if (s === e) continue

          for (let a = s; a < e; a++) {
            const i = items[a]
            for (let b = a + 1; b < e; b++) this.pushApart(i, items[b])
          }

          for (let n = 0; n < 4; n++) {
            const nx = gx + NEIGHBOR_DX[n]
            const ny = gy + NEIGHBOR_DY[n]
            if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue
            const c2 = ny * cols + nx
            const s2 = starts[c2]
            const e2 = starts[c2 + 1]
            for (let a = s; a < e; a++) {
              const i = items[a]
              for (let b = s2; b < e2; b++) this.pushApart(i, items[b])
            }
          }
        }
      }

      for (let i = 0; i < count; i++) {
        if (alive[i] === 0) continue
        let nx = x[i] + sepX[i]
        let ny = y[i] + sepY[i]
        if (nx < 0) nx = 0
        else if (nx > this.worldW) nx = this.worldW
        if (ny < 0) ny = 0
        else if (ny > this.worldH) ny = this.worldH
        x[i] = nx
        y[i] = ny
      }
    }
  }

  private pushApart(i: number, j: number): void {
    const { x, y, group, sepX, sepY, groups } = this
    const dx = x[j] - x[i]
    const dy = y[j] - y[i]
    const d2 = dx * dx + dy * dy
    const baseMinD = groups[group[i]].stats.radius + groups[group[j]].stats.radius
    const minD = baseMinD + SEPARATION_BUFFER
    if (d2 >= minD * minD) return

    if (d2 > 1e-6) {
      const d = Math.sqrt(d2)
      const amount = (minD - d) * 0.5 * SEPARATION_STRENGTH
      const ux = (dx / d) * amount
      const uy = (dy / d) * amount
      sepX[i] -= ux
      sepY[i] -= uy
      sepX[j] += ux
      sepY[j] += uy
    } else {
      // Exactly coincident. Nudge by index so the tie-break is deterministic.
      sepX[i] -= 0.12
      sepX[j] += 0.12
    }
  }

  /** FNV-1a over the meaningful state. Used by the determinism tests. */
  hash(): number {
    let h = 0x811c9dc5
    h = hashBytes(h, this.x.subarray(0, this.count))
    h = hashBytes(h, this.y.subarray(0, this.count))
    h = hashBytes(h, this.hp.subarray(0, this.count))
    h = hashBytes(h, this.alive.subarray(0, this.count))
    h ^= this.tick
    h = Math.imul(h, 0x01000193) >>> 0
    h ^= this.rng.state
    return h >>> 0
  }
}

export { TEAM_A, TEAM_B }
