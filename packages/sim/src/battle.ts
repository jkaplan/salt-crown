import { Rng } from './rng.js'
import { SpatialGrid } from './spatial.js'
import { MELEE_RANGE, TEAM_A, TEAM_B, WORLD_H, WORLD_W } from './types.js'
import type { BattleConfig, GroupResult, SimGroup, Winner } from './types.js'

const CELL_SIZE = 48
const DEFAULT_MAX_TICKS = 20 * 180
const ROWS = 30
const MAX_FIGHTERS_PER_LINE = 10
const ROW_SPACING = 36
const LINE_SPACING = 44
const SQUAD_GAP_LINES = 1.2
const FORMATION_OFFSET = 150
const SEPARATION_BUFFER = 10
const SEPARATION_PASSES = 3
const RANGE_HYSTERESIS = 6
const MELEE_KNOCKBACK = 2.4
const RANGED_KNOCKBACK = 0.9
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

  private readonly maxHp: Float32Array
  private readonly cooldown: Int32Array
  private readonly target: Int32Array
  private readonly sepX: Float32Array
  private readonly sepY: Float32Array
  private readonly knockX: Float32Array
  /** Damage accumulated this tick, applied in phase 2. */
  private readonly damage: Float32Array

  private readonly rng: Rng
  private readonly grid: SpatialGrid

  constructor(config: BattleConfig) {
    this.groups = config.groups
    this.maxTicks = config.maxTicks ?? DEFAULT_MAX_TICKS
    this.rng = new Rng(config.seed)

    let total = 0
    for (const g of config.groups) total += g.count
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
    this.sepX = new Float32Array(total)
    this.sepY = new Float32Array(total)
    this.knockX = new Float32Array(total)
    this.damage = new Float32Array(total)

    const gn = config.groups.length
    this.groupStartCount = new Int32Array(gn)
    this.groupAlive = new Int32Array(gn)
    this.groupEff = new Float32Array(gn)
    this.groupFirstUnit = new Int32Array(gn)
    this.groupDamageDealt = new Float32Array(gn)
    this.groupDamageTaken = new Float32Array(gn)

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

    const { x, y, px, py, hp, maxHp, alive, cooldown, target, damage, group, groupEff, knockX, rng } = this
    const groups = this.groups
    const count = this.count

    px.set(x)
    py.set(y)
    this.grid.build(count, px, py, alive)
    damage.fill(0)
    knockX.fill(0)
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
      const tt = groups[group[t]].stats
      const engageRange = st.range + tt.radius + RANGE_HYSTERESIS
      const absDx = Math.abs(dx)

      if (absDx > engageRange) {
        if (absDx > 1e-6) {
          const gap = absDx - engageRange
          const step = Math.min(st.moveSpeed * 0.65, gap)
          x[i] += dx > 0 ? step : -step
        }
      } else if (cooldown[i] === 0) {
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

        if (rng.float() < chance) {
          // A bleeding squad hits softer. Fewer bodies AND weaker blows makes
          // the collapse superlinear, which is what a rout should feel like.
          const raw = st.damage * groupEff[gi] - tt.armor
          const dealt = raw > 1 ? raw : 1
          damage[t] += dealt

          const dir = dx >= 0 ? 1 : -1
          const baseKnock = st.range <= MELEE_RANGE ? MELEE_KNOCKBACK : RANGED_KNOCKBACK
          const knock = Math.min(baseKnock, dealt * 0.14)
          knockX[t] += dir * knock
          knockX[i] -= dir * knock * 0.45

          this.groupDamageDealt[gi] += dealt
          this.groupDamageTaken[group[t]] += dealt
          if (tt.quills > 0 && st.range <= MELEE_RANGE) {
            damage[i] += dealt * tt.quills
            this.groupDamageTaken[gi] += dealt * tt.quills
            this.groupDamageDealt[group[t]] += dealt * tt.quills
          }
        }
      }
    }

    // Phase 2 — resolution. Overkill is possible and symmetric.
    for (let i = 0; i < count; i++) {
      if (alive[i] === 0 || damage[i] === 0) continue
      hp[i] -= damage[i]
      if (hp[i] <= 0) this.kill(i)
    }

    for (let i = 0; i < count; i++) {
      if (alive[i] === 0) continue
      x[i] = clamp(x[i] + knockX[i], 0, this.worldW)
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
    }
  }

  private kill(t: number): void {
    this.alive[t] = 0
    this.hp[t] = 0
    this.groupAlive[this.group[t]]--
    if (this.team[t] === TEAM_A) this.aliveA--
    else this.aliveB--
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

    for (let pass = 0; pass < SEPARATION_PASSES; pass++) {
      grid.build(count, x, y, alive)
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
      const amount = (minD - d) * 0.5
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
