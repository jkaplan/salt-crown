import { Application, Container, Graphics, Sprite, Text, Texture } from 'pixi.js'
import { Battle, MS_PER_TICK, TEAM_A, TEAM_B, WORLD_H, WORLD_W } from '@salt/sim'
import type { BattleConfig, GroupResult, Winner } from '@salt/sim'
import { makeGroup } from '@salt/game'

export interface ViewStats {
  tick: number
  aliveA: number
  aliveB: number
  total: number
  simMs: number
  fps: number
  finished: boolean
  winner: Winner
  combatants: CombatantSnapshot[]
}

export interface CombatantSnapshot {
  groupIndex: number
  label: string
  leaderLabel: string | null
  team: typeof TEAM_A | typeof TEAM_B
  started: number
  alive: number
  currentHp: number
  maxHp: number
  damagePerHit: number
  dps: number
  discipline: number
  armor: number
  range: number
  moveSpeed: number
  accuracy: number
  evade: number
  attackInterval: number
}

export interface ProbeRow {
  perSide: number
  msPerTick: number
  headroom: number
}

/** Team B is tinted toward rust so the two sides stay readable at a glance. */
const ENEMY_TINT = 0xc4653a

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function mixChannel(from: number, to: number, t: number): number {
  return Math.round(from + (to - from) * t)
}

function hexToRgb(color: number): { r: number; g: number; b: number } {
  return {
    r: (color >> 16) & 0xff,
    g: (color >> 8) & 0xff,
    b: color & 0xff,
  }
}

function rgbToHex(r: number, g: number, b: number): number {
  return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff)
}

function mixHex(a: number, b: number, t: number): number {
  const left = hexToRgb(a)
  const right = hexToRgb(b)
  return rgbToHex(
    mixChannel(left.r, right.r, t),
    mixChannel(left.g, right.g, t),
    mixChannel(left.b, right.b, t),
  )
}

function hexToHsl(color: number): { h: number; s: number; l: number } {
  const { r, g, b } = hexToRgb(color)
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const lightness = (max + min) / 2

  if (max === min) {
    return { h: 0, s: 0, l: lightness }
  }

  const delta = max - min
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min)
  let hue = 0

  switch (max) {
    case red:
      hue = (green - blue) / delta + (green < blue ? 6 : 0)
      break
    case green:
      hue = (blue - red) / delta + 2
      break
    default:
      hue = (red - green) / delta + 4
      break
  }

  return { h: hue / 6, s: saturation, l: lightness }
}

function hslToHex(h: number, s: number, l: number): number {
  if (s === 0) {
    const v = Math.round(l * 255)
    return rgbToHex(v, v, v)
  }

  const hueToChannel = (p: number, q: number, t: number): number => {
    let value = t
    if (value < 0) value += 1
    if (value > 1) value -= 1
    if (value < 1 / 6) return p + (q - p) * 6 * value
    if (value < 1 / 2) return q
    if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6
    return p
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const red = hueToChannel(p, q, h + 1 / 3)
  const green = hueToChannel(p, q, h)
  const blue = hueToChannel(p, q, h - 1 / 3)
  return rgbToHex(Math.round(red * 255), Math.round(green * 255), Math.round(blue * 255))
}

function brightnessTint(base: number, ratio: number): number {
  const tone = hexToHsl(base)
  const vibrant = {
    h: tone.h,
    s: Math.max(0.75, Math.min(1, tone.s + 0.2)),
    l: 0.28 + clamp01(ratio) * 0.46,
  }
  return hslToHex(vibrant.h, vibrant.s, vibrant.l)
}

/**
 * A led squad's standard. Marks who the leaders are on the field — otherwise
 * an officer is an invisible stat modifier and you can't tell a led squad from
 * an unled one.
 *
 * The banner follows the first *living* member of the squad, so the standard
 * passes down the line as bodies fall rather than vanishing.
 */
interface Banner {
  groupIndex: number
  ring: Sprite
  label: Text
}

/**
 * Owns the canvas and drives the sim. Deliberately not a React component —
 * battle state must never enter React, or we re-render 60 times a second over
 * thousands of units. React only sees a throttled stats snapshot.
 */
export class BattleView {
  private app: Application | null = null
  private world = new Container()
  private texture: Texture | null = null
  private sprites: Sprite[] = []
  private banners: Banner[] = []
  private battle: Battle | null = null
  private acc = 0
  private simMsAvg = 0
  private lastEmit = 0

  speed = 1
  paused = false
  onStats: ((s: ViewStats) => void) | null = null
  onFinished: ((results: GroupResult[], winner: Winner, ticks: number) => void) | null = null
  private reported = false

  async init(host: HTMLElement): Promise<void> {
    const app = new Application()
    await app.init({
      background: 0x100d0c,
      antialias: false,
      resizeTo: host,
      preference: 'webgl',
    })
    this.app = app
    host.appendChild(app.canvas)
    app.stage.addChild(this.world)

    const g = new Graphics().circle(0, 0, 16).fill(0xffffff)
    this.texture = app.renderer.generateTexture(g)
    g.destroy()

    app.ticker.add(this.frame)
  }

  destroy(): void {
    if (!this.app) return
    this.app.ticker.remove(this.frame)
    this.app.destroy(true, { children: true, texture: true })
    this.app = null
    this.battle = null
    this.sprites = []
  }

  start(config: BattleConfig): void {
    if (!this.app || !this.texture) return

    this.battle = new Battle(config)
    this.acc = 0
    this.simMsAvg = 0
    this.reported = false

    this.world.removeChildren()
    for (const s of this.sprites) s.destroy()
    for (const b of this.banners) {
      b.ring.destroy()
      b.label.destroy()
    }
    this.sprites = []
    this.banners = []

    const b = this.battle
    for (let i = 0; i < b.count; i++) {
      const group = config.groups[b.group[i]]
      const sprite = new Sprite(this.texture)
      sprite.anchor.set(0.5)
      sprite.width = group.stats.radius * 2
      sprite.height = group.stats.radius * 2
      sprite.x = b.x[i]
      sprite.y = b.y[i]
      this.sprites.push(sprite)
      this.world.addChild(sprite)
    }

    // Banners last, so they draw over the bodies.
    const tex = this.texture
    config.groups.forEach((group, gi) => {
      if (!group.leaderLabel) return
      const friendly = group.team === TEAM_A

      const ring = new Sprite(tex)
      ring.anchor.set(0.5)
      ring.width = 46
      ring.height = 46
      ring.alpha = 0.28
      ring.tint = friendly ? 0xffe9b0 : 0xffb08a

      const label = new Text({
        text: group.leaderLabel,
        style: {
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          fontSize: 15,
          fontWeight: '600',
          fill: friendly ? 0xffe9b0 : 0xffb08a,
          stroke: { color: 0x0a0807, width: 4 },
        },
      })
      label.anchor.set(0.5, 1)

      this.world.addChild(ring)
      this.world.addChild(label)
      this.banners.push({ groupIndex: gi, ring, label })
    })
  }

  private frame = (): void => {
    const app = this.app
    const battle = this.battle
    if (!app || !battle) return

    this.layout(app)

    if (!this.paused && !battle.finished) {
      // Clamp so a stalled tab doesn't try to catch up across a huge gap.
      this.acc += Math.min(100, app.ticker.deltaMS) * this.speed
      const t0 = performance.now()
      let steps = 0
      while (this.acc >= MS_PER_TICK && steps < 16) {
        battle.step()
        this.acc -= MS_PER_TICK
        steps++
      }
      if (steps > 0) {
        const per = (performance.now() - t0) / steps
        this.simMsAvg = this.simMsAvg === 0 ? per : this.simMsAvg * 0.9 + per * 0.1
      }
    }

    this.draw(Math.min(1, this.acc / MS_PER_TICK))
    this.emit(app)

    if (battle.finished && !this.reported) {
      this.reported = true
      this.onFinished?.(battle.results(), battle.winner, battle.tick)
    }
  }

  /** World is a fixed 1600x900; scale it to fit whatever the host gives us. */
  private layout(app: Application): void {
    const w = app.renderer.width
    const h = app.renderer.height
    const scale = Math.min(w / WORLD_W, h / WORLD_H)
    this.world.scale.set(scale)
    this.world.x = (w - WORLD_W * scale) / 2
    this.world.y = (h - WORLD_H * scale) / 2
  }

  private draw(alpha: number): void {
    const b = this.battle
    if (!b) return
    const { x, y, px, py, alive } = b
    const sprites = this.sprites
    for (let i = 0; i < b.count; i++) {
      const sprite = sprites[i]
      const group = b.groups[b.group[i]]
      if (alive[i] === 0) {
        if (sprite.visible) sprite.visible = false
        continue
      }
      const maxHp = Math.max(1, group.stats.hp)
      const health = clamp01(b.hp[i] / maxHp)
      const baseTint = group.team === TEAM_A ? group.color : mixHex(group.color, ENEMY_TINT, 0.35)
      sprite.tint = brightnessTint(baseTint, health)
      sprite.alpha = 0.92 + health * 0.08
      sprite.x = px[i] + (x[i] - px[i]) * alpha
      sprite.y = py[i] + (y[i] - py[i]) * alpha
    }

    // Standards follow the first living member, so they pass down the line
    // as bodies fall rather than vanishing when one unit dies.
    for (const banner of this.banners) {
      const first = b.groupFirstUnit[banner.groupIndex]
      const end = first + b.groups[banner.groupIndex].count
      let carrier = -1
      for (let i = first; i < end; i++) {
        if (alive[i] === 1) {
          carrier = i
          break
        }
      }

      if (carrier < 0) {
        banner.ring.visible = false
        banner.label.visible = false
        continue
      }

      const cx = px[carrier] + (x[carrier] - px[carrier]) * alpha
      const cy = py[carrier] + (y[carrier] - py[carrier]) * alpha
      banner.ring.x = cx
      banner.ring.y = cy
      banner.label.x = cx
      banner.label.y = cy - 26
    }
  }

  private emit(app: Application): void {
    const b = this.battle
    if (!b || !this.onStats) return
    const now = performance.now()
    if (now - this.lastEmit < 100) return
    this.lastEmit = now
    const combatants: CombatantSnapshot[] = b.groups.map((group, gi) => {
      const first = b.groupFirstUnit[gi]
      const end = first + group.count
      let currentHp = 0
      for (let i = first; i < end; i++) {
        if (b.alive[i] === 1) currentHp += b.hp[i]
      }

      const damagePerHit = group.stats.damage * b.groupEff[gi]
      const dps = (damagePerHit * group.stats.accuracy * 20) / group.stats.attackInterval

      return {
        groupIndex: gi,
        label: group.label,
        leaderLabel: group.leaderLabel ?? null,
        team: group.team,
        started: b.groupStartCount[gi],
        alive: b.groupAlive[gi],
        currentHp,
        maxHp: group.stats.hp * group.count,
        damagePerHit,
        dps,
        discipline: b.groupEff[gi],
        armor: group.stats.armor,
        range: group.stats.range,
        moveSpeed: group.stats.moveSpeed,
        accuracy: group.stats.accuracy,
        evade: group.stats.evade,
        attackInterval: group.stats.attackInterval,
      }
    })
    this.onStats({
      tick: b.tick,
      aliveA: b.aliveA,
      aliveB: b.aliveB,
      total: b.count,
      simMs: this.simMsAvg,
      fps: app.ticker.FPS,
      finished: b.finished,
      winner: b.winner,
      combatants,
    })
  }

  /**
   * Ramps entity count and measures pure sim cost, so the ceiling is a measured
   * number rather than a guess. Yields between rows to keep the page live.
   */
  async probe(sizes: number[] = [50, 110, 220, 500, 1000, 2000, 4000]): Promise<ProbeRow[]> {
    const rows: ProbeRow[] = []
    for (const perSide of sizes) {
      const battle = new Battle({
        seed: 1234,
        groups: [makeGroup(TEAM_A, 0, perSide), makeGroup(TEAM_B, 0, perSide)],
      })
      // Warm past the approach phase so we measure units actually fighting.
      for (let i = 0; i < 60 && !battle.finished; i++) battle.step()

      const t0 = performance.now()
      let steps = 0
      for (let i = 0; i < 120 && !battle.finished; i++) {
        battle.step()
        steps++
      }
      const msPerTick = (performance.now() - t0) / Math.max(1, steps)
      rows.push({ perSide, msPerTick, headroom: MS_PER_TICK / msPerTick })
      await new Promise((r) => setTimeout(r, 0))
    }
    return rows
  }
}
