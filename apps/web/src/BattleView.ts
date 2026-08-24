import { Application, Container, Graphics, Sprite, Text, Texture } from 'pixi.js'
import { Battle, MELEE_RANGE, MS_PER_TICK, TEAM_A, TEAM_B, WORLD_H, WORLD_W } from '@salt/sim'
import type { BattleConfig, BattleEvent, GroupResult, ResolvedStats, Winner } from '@salt/sim'
import { makeGroup } from '@salt/game'
import { GlowFilter } from 'pixi-filters'

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
  /** Notable events since the last emit, oldest first — see BattleEvent. */
  events: BattleEvent[]
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
  /** True for a group that IS one named individual — see SimGroup.named. */
  named: boolean
}

export interface ProbeRow {
  perSide: number
  msPerTick: number
  headroom: number
}

/** Team B is tinted toward rust so the two sides stay readable at a glance. */
const ENEMY_TINT = 0xc4653a
const BODY_SHAPE_COUNT = 8
/** Quantisation of the health-to-tint lookup table. */
const TINT_STEPS = 48
/** Attack flash: how long the strike reads for, and its colour resolution. */
const FLASH_TICKS = 5
const FLASH_STEPS = 12
/**
 * A leader's own body renders at this multiple of a normal one — see
 * docs/V0-DESIGN.md §5c. Every Potential is its own group regardless of
 * whether it's currently leading (so none of them can hide inside a squad
 * and become unkillable), so this is what made a dozen-plus of them read as
 * one indistinct texture: an identical faint ring on an identically-sized
 * body, repeated. Scaling the body itself is what a same-sized ring behind
 * it never could.
 */
const LEADER_SCALE = 1.55
/** Gold, not team-accent — the ring used to blend into the body's own health
 * tint. Matches UX.md §5's "capacity, things you covet" use of gold; a
 * leader is exactly that. */
const LEADER_GOLD = 0xffd77a

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
    s: Math.max(0.96, Math.min(1, tone.s + 0.42)),
    l: 0.41 + clamp01(ratio) * 0.31,
  }
  return hslToHex(vibrant.h, vibrant.s, vibrant.l)
}

const BODY_VARIANTS = 4

/**
 * Every silhouette as a point list, so distortion applies uniformly and the
 * shape still identifies the unit type.
 */
function shapeOutline(kind: number, r: number): Array<[number, number]> {
  const ring = (n: number, radius: number): Array<[number, number]> =>
    Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2
      return [Math.cos(a) * radius, Math.sin(a) * radius] as [number, number]
    })

  switch (kind) {
    case 0:
      return ring(11, r)
    case 1:
      return [[0, -r], [r, 0], [0, r], [-r, 0]]
    case 2:
      return [[-r, -r], [r, -r], [r, r], [-r, r]]
    case 3:
      return [[0, -r], [r, r], [-r, r]]
    case 4:
      return [
        [0, -r], [r * 0.78, -r * 0.28], [r, r * 0.18], [r * 0.58, r],
        [-r * 0.58, r], [-r, r * 0.18], [-r * 0.78, -r * 0.28],
      ]
    case 5:
      return [
        [0, -r], [r * 0.36, -r * 0.52], [r * 0.74, -r * 0.12], [r * 0.46, r * 0.14],
        [r * 0.64, r], [0, r * 0.56], [-r * 0.64, r], [-r * 0.46, r * 0.14],
        [-r * 0.74, -r * 0.12], [-r * 0.36, -r * 0.52],
      ]
    case 6:
      return [
        [0, -r], [r * 0.28, -r * 0.2], [r, -r * 0.2], [r * 0.46, r * 0.1],
        [r * 0.62, r], [0, r * 0.4], [-r * 0.62, r], [-r * 0.46, r * 0.1],
        [-r, -r * 0.2], [-r * 0.28, -r * 0.2],
      ]
    default:
      return ring(7, r)
  }
}

/**
 * Deterministic per-vertex distortion.
 *
 * Clean geometry reads as manufactured, and these are bred, patched-together
 * things. Every outline gets pushed around a little — enough to look grown
 * rather than stamped, not enough to lose the shape that identifies the unit.
 *
 * Baked into several variants per shape, so a rank of twenty is twenty
 * slightly different bodies instead of one sprite repeated twenty times.
 */
function distort(points: Array<[number, number]>, variant: number): Array<[number, number]> {
  let seed = ((variant + 1) * 2654435761) >>> 0
  const next = () => {
    seed = (seed + 0x9e3779b9) >>> 0
    let z = seed
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0
    return ((z ^ (z >>> 15)) >>> 0) / 4294967296
  }

  return points.map(([x, y]) => {
    const scale = 0.86 + next() * 0.3
    return [x * scale + (next() - 0.5) * 4.6, y * scale + (next() - 0.5) * 4.6] as [
      number,
      number,
    ]
  })
}

function createBodyTexture(app: Application, kind: number, variant: number): Texture {
  const g = new Graphics()
  const points = distort(shapeOutline(kind, 16), kind * BODY_VARIANTS + variant)

  const [fx, fy] = points[0]
  g.moveTo(fx, fy)
  for (let i = 1; i < points.length; i++) g.lineTo(points[i][0], points[i][1])
  g.closePath()

  g.fill(0xffffff)
  // A DARK outline, not a white one. Tint multiplies, so near-black stays
  // near-black while the fill takes the team colour — which is what puts a
  // visible edge between two bodies standing shoulder to shoulder. Stroking
  // in white (as this did) meant a crowd rendered as one continuous mass.
  g.stroke({ width: 3.5, color: 0x0a0908, alignment: 0.5 })
  const texture = app.renderer.generateTexture(g)
  g.destroy()
  return texture
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
  /** Per-team layers so each glow filter is applied once, not per sprite. */
  private playerLayer = new Container()
  private enemyLayer = new Container()
  /** Halo rings render here, behind both team layers so bodies sit in front of their own halo. */
  private haloLayer = new Container()
  /**
   * One shared Graphics for every ranged attack's streak, cleared and
   * redrawn each frame — a line per active streak, not a sprite per streak.
   * Ranged hits are bounded by attackInterval, so this stays cheap even with
   * a lot of ranged units firing at once; a Sprite-per-streak would mean
   * creating and destroying pool objects every few ticks for no real gain.
   */
  private streaks = new Graphics()
  private texture: Texture | null = null
  private bodyTextures: Texture[] = []
  private playerColor = 0x7fc7bb
  private playerGlow: GlowFilter | null = null
  private enemyGlow: GlowFilter | null = null
  private streakGlow: GlowFilter | null = null
  private sprites: Sprite[] = []
  private banners: Banner[] = []
  private battle: Battle | null = null
  private config: BattleConfig | null = null
  private displayHealth: Float32Array = new Float32Array(0)
  /** Per-unit caches, filled once per battle so draw() touches no objects. */
  private invMaxHp: Float32Array = new Float32Array(0)
  private unitIsPlayer: Uint8Array = new Uint8Array(0)
  /** LEADER_SCALE for a named individual's own body, 1 for everyone else. */
  private leaderScale: Float32Array = new Float32Array(0)
  /** Metadata for each sprite: groupIndex to look up unit details. */
  private spriteGroupIndex: number[] = []
  /** Whether each sprite is a named leader. */
  private isLeader: boolean[] = []
  /** Durability scale for visual sizing (high armor/HP = larger). */
  private durabilityScale: Float32Array = new Float32Array(0)
  /** Tooltip HTML element. */
  private tooltip: HTMLDivElement | null = null
  private tooltipHost: HTMLElement | null = null
  private playerTints: number[] = []
  private enemyTints: number[] = []
  /** Strike flash, indexed by intensity. */
  private playerFlash: number[] = []
  private enemyFlash: number[] = []
  private acc = 0
  private simMsAvg = 0
  private lastEmit = 0
  /** Read cursor into the sim's event ring buffer — see Battle.newEventsSince. */
  private lastEventCount = 0

  speed = 1
  paused = false
  onStats: ((s: ViewStats) => void) | null = null
  onFinished: ((results: GroupResult[], winner: Winner, ticks: number) => void) | null = null
  private reported = false

  private parseColor(color: string): number | null {
    const normalized = color.startsWith('#') ? color.slice(1) : color
    const parsed = Number.parseInt(normalized, 16)
    return Number.isFinite(parsed) ? parsed : null
  }

  private teamBaseColor(team: typeof TEAM_A | typeof TEAM_B): number {
    return team === TEAM_A ? this.playerColor : ENEMY_TINT
  }

  private teamAccentColor(team: typeof TEAM_A | typeof TEAM_B): number {
    return mixHex(this.teamBaseColor(team), 0xffffff, 0.52)
  }

  /**
   * Compute visual scale based on overall unit power.
   * Factors: DPS (damage × accuracy × attack speed) + durability (HP + armor).
   * Higher power = larger sprite, making advantage readable at a glance.
   */
  private getPowerScale(stats: ResolvedStats): number {
    // Offensive power: damage × accuracy × attack frequency (inverse of interval)
    // Typical damage: 5-15, accuracy: 0.7-0.9, interval: 8-20
    const attackFrequency = 1 / Math.max(1, stats.attackInterval)
    const dps = stats.damage * stats.accuracy * attackFrequency
    // Normalize DPS to 0..1 range (rough baseline: ~1.5 DPS per second)
    const dpsNorm = Math.min(1, dps / 1.5)

    // Defensive power: HP + armor value
    // Typical HP: 30-170, armor: 0-7. Armor is flat reduction, so ~0.2 armor ≈ 1 HP
    const defensiveValue = stats.hp + (stats.armor * 10)
    // Normalize (typical max: ~200)
    const defenseNorm = Math.min(1, defensiveValue / 200)

    // Blend: slightly favor offense for readability, but both matter
    const powerScore = dpsNorm * 0.55 + defenseNorm * 0.45

    // Scale from 0.75x (weak) to 1.6x (powerful)
    return 0.75 + powerScore * 0.85
  }

  /**
   * Health-driven tint, precomputed.
   *
   * This used to be an RGB -> HSL -> RGB round trip per sprite per frame. At a
   * couple of thousand bodies that is >100k colour-space conversions a second,
   * and it was most of what was left of the framerate. Health only varies 0..1,
   * so quantise it and look the answer up instead.
   */
  private buildTintTables(): void {
    const steps = TINT_STEPS
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      this.playerTints[i] = brightnessTint(this.playerColor, t)
      this.enemyTints[i] = brightnessTint(mixHex(ENEMY_TINT, 0xff4bd6, 0.3), t)
    }

    // Strike flash, indexed by intensity: the team colour at full brightness
    // pushed toward white.
    const playerFull = brightnessTint(this.playerColor, 1)
    const enemyFull = brightnessTint(mixHex(ENEMY_TINT, 0xff4bd6, 0.3), 1)
    for (let i = 0; i <= FLASH_STEPS; i++) {
      const t = (i / FLASH_STEPS) * 0.8
      this.playerFlash[i] = mixHex(playerFull, 0xffffff, t)
      this.enemyFlash[i] = mixHex(enemyFull, 0xffffff, t)
    }
  }

  private applyTheme(): void {
    if (this.playerGlow) {
      this.playerGlow.color = this.playerColor
    }
    if (this.enemyGlow) {
      this.enemyGlow.color = mixHex(ENEMY_TINT, 0xff4bd6, 0.45)
    }
    this.buildTintTables()

    if (!this.battle) return
    for (const banner of this.banners) {
      const group = this.battle.groups[banner.groupIndex]
      const accent = this.teamAccentColor(group.team)
      banner.ring.tint = accent
      banner.label.style.fill = accent
    }
  }

  async init(host: HTMLElement): Promise<void> {
    const app = new Application()
    await app.init({
      background: 0x070611,
      antialias: true,
      resizeTo: host,
      preference: 'webgl',
    })
    this.app = app
    this.tooltipHost = host
    host.appendChild(app.canvas)
    this.setupTooltip(host)
    app.stage.addChild(this.world)

    // Tight, weak glow. At distance 10 / strength 1.8 the bloom from each
    // body filled the gaps to its neighbours, so a formation read as one
    // luminous mass. The glow is atmosphere; the dark outline does the work.
    this.playerGlow = new GlowFilter({
      color: 0x16f6ff,
      distance: 5,
      outerStrength: 0.9,
      innerStrength: 0.2,
      quality: 0.35,
    })
    this.enemyGlow = new GlowFilter({
      color: 0xff4bd6,
      distance: 5,
      outerStrength: 0.9,
      innerStrength: 0.2,
      quality: 0.35,
    })
    // One filter per layer. This is the whole reason the layers exist.
    this.playerLayer.filters = [this.playerGlow]
    this.enemyLayer.filters = [this.enemyGlow]
    // A ray, not a thread — the brief that landed this was "like Light
    // Manipulation in Caves of Qud." One filter on the shared streaks
    // Graphics itself, created once here and never touched again — same
    // safe, proven pattern as playerGlow/enemyGlow above, not the per-leader
    // GlowFilter that had to be cut tonight for crashing on teardown.
    this.streakGlow = new GlowFilter({
      color: 0xffffff,
      distance: 6,
      outerStrength: 1.4,
      innerStrength: 0.3,
      quality: 0.4,
    })
    this.streaks.filters = [this.streakGlow]
    // Added first, so it sits behind both team layers — a halo BEHIND a
    // body, not a disc floating in front of one.
    this.world.addChild(this.haloLayer)
    this.world.addChild(this.enemyLayer)
    this.world.addChild(this.playerLayer)
    // On top of every body — a streak needs to read clearly over the crowd,
    // not get lost under it the way the old flat halo ring used to.
    this.world.addChild(this.streaks)
    this.applyTheme()

    const g = new Graphics().circle(0, 0, 16).fill(0xffffff)
    this.texture = app.renderer.generateTexture(g)
    g.destroy()

    // shape * BODY_VARIANTS + variant. Several distorted cuts of each shape
    // so a rank of twenty is not one sprite stamped twenty times.
    this.bodyTextures = Array.from({ length: BODY_SHAPE_COUNT * BODY_VARIANTS }, (_, i) =>
      createBodyTexture(app, (i / BODY_VARIANTS) | 0, i % BODY_VARIANTS),
    )

    app.ticker.add(this.frame)
  }

  setPlayerColor(color: string): void {
    const parsed = this.parseColor(color)
    if (parsed !== null) {
      this.playerColor = parsed
      this.applyTheme()
    }
  }

  destroy(): void {
    if (!this.app) return
    // Clean up tooltip
    if (this.tooltip && this.tooltipHost) {
      this.tooltipHost.removeChild(this.tooltip)
    }
    this.tooltip = null
    this.app.ticker.remove(this.frame)
    for (const texture of this.bodyTextures) texture.destroy(true)
    this.bodyTextures = []
    this.playerGlow?.destroy()
    this.enemyGlow?.destroy()
    this.streakGlow?.destroy()
    this.playerGlow = null
    this.enemyGlow = null
    this.streakGlow = null
    // NOT `app.destroy(true, ...)`. That `true` is the renderer-destroy
    // option, and passing it literally `true` (rather than an options object)
    // makes Pixi call GlobalResourceRegistry.release() — which clears
    // TexturePool, a module-level singleton shared by the whole page, not
    // scoped to this Application. TexturePool.clear() empties its bucket
    // storage but leaves its uid->key lookup table pointing at buckets that
    // no longer exist, so the next Text.destroy() *anywhere on the page* —
    // including an ordinary next battle's banner label — throws
    // "Cannot read properties of undefined (reading 'push')" out of
    // TexturePoolClass.returnTexture. { removeView: true } gets the same
    // canvas cleanup without setting releaseGlobalResources.
    this.app.destroy({ removeView: true }, { children: true, texture: true })
    this.app = null
    this.battle = null
    this.displayHealth = new Float32Array(0)
    this.sprites = []
  }

  start(config: BattleConfig): void {
    if (!this.app || !this.texture) return

    this.config = config
    this.battle = new Battle(config)
    this.acc = 0
    this.simMsAvg = 0
    this.lastEventCount = 0
    this.reported = false

    this.playerLayer.removeChildren()
    this.enemyLayer.removeChildren()
    this.haloLayer.removeChildren()
    for (const s of this.sprites) s.destroy()
    for (const b of this.banners) {
      b.ring.destroy()
      b.label.destroy()
    }
    this.sprites = []
    this.banners = []
    this.spriteGroupIndex = []
    this.isLeader = []

    const b = this.battle
    this.displayHealth = new Float32Array(b.count)
    this.invMaxHp = new Float32Array(b.count)
    this.unitIsPlayer = new Uint8Array(b.count)
    this.leaderScale = new Float32Array(b.count).fill(1)
    this.durabilityScale = new Float32Array(b.count)
    for (let i = 0; i < b.count; i++) {
      const group = config.groups[b.group[i]]
      const variant = i % BODY_VARIANTS
      const textureIndex = (group.shape % BODY_SHAPE_COUNT) * BODY_VARIANTS + variant
      const sprite = new Sprite(this.bodyTextures[textureIndex])
      sprite.anchor.set(0.5)

      // Apply power-based scale to size
      const powerScale = this.getPowerScale(group.stats)
      this.durabilityScale[i] = powerScale
      sprite.width = group.stats.radius * 2 * powerScale
      sprite.height = group.stats.radius * 2 * powerScale

      sprite.blendMode = 'normal'
      sprite.x = b.x[i]
      sprite.y = b.y[i]
      this.displayHealth[i] = 1
      this.invMaxHp[i] = 1 / Math.max(1, group.stats.hp)
      this.unitIsPlayer[i] = group.team === TEAM_A ? 1 : 0

      const isLeader = group.named ?? false
      this.isLeader.push(isLeader)

      if (isLeader) {
        this.leaderScale[i] = LEADER_SCALE
      }

      this.sprites.push(sprite)
      this.spriteGroupIndex.push(b.group[i])
      // Add hover tooltip listeners
      sprite.eventMode = 'static'
      sprite.cursor = 'pointer'
      sprite.on('pointerenter', () => {
        this.updateTooltip(sprite, b.group[i])
      })
      sprite.on('pointerleave', () => {
        this.hideTooltip()
      })
      // Sorted into a per-team layer so the glow can be applied ONCE to the
      // layer instead of once per sprite. A filter on an individual sprite
      // forces its own render-target switch and filter pass, which destroys
      // batching — at a few hundred bodies that alone cost ~12fps.
      ;(group.team === TEAM_A ? this.playerLayer : this.enemyLayer).addChild(sprite)
    }

    // Banners last, built after bodies but parented into haloLayer so they
    // still draw BEHIND every body (see the layer order in boot()).
    const tex = this.texture
    config.groups.forEach((group, gi) => {
      if (!group.leaderLabel) return

      // Gold and opaque, not team-accent at 0.28 — team-accent already IS
      // the body's own tint, so the old ring blended into the crowd instead
      // of marking one member of it. Sized to clear LEADER_SCALE's ~1.55x
      // body at full health with room to read as a halo, not an overlap.
      const ring = new Sprite(tex)
      ring.anchor.set(0.5)
      ring.width = 70
      ring.height = 70
      ring.alpha = 0.9
      ring.tint = LEADER_GOLD

      const label = new Text({
        text: group.leaderLabel,
        style: {
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          fontSize: 15,
          fontWeight: '600',
          fill: LEADER_GOLD,
          stroke: { color: 0x0a0807, width: 4 },
        },
      })
      label.anchor.set(0.5, 1)

      this.haloLayer.addChild(ring)
      this.world.addChild(label)
      this.banners.push({ groupIndex: gi, ring, label })
    })
    this.applyTheme()
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
    const battle = this.battle
    const worldW = battle ? battle.worldW : WORLD_W
    const worldH = battle ? battle.worldH : WORLD_H
    const w = app.renderer.width
    const h = app.renderer.height
    const scale = Math.min(w / worldW, h / worldH)

    let focusX = worldW / 2
    let focusY = worldH / 2
    if (battle) {
      const { x, y, alive, count } = battle
      let aliveCount = 0
      let sumX = 0
      let sumY = 0
      for (let i = 0; i < count; i++) {
        if (alive[i] === 0) continue
        sumX += x[i]
        sumY += y[i]
        aliveCount++
      }
      if (aliveCount > 0) {
        focusX = sumX / aliveCount
        focusY = sumY / aliveCount
      }
    }

    this.world.scale.set(scale)
    this.world.pivot.set(focusX, focusY)
    this.world.x = w / 2
    this.world.y = h / 2
  }

  private draw(alpha: number): void {
    const b = this.battle
    if (!b) return
    const { x, y, px, py, alive } = b
    const sprites = this.sprites
    const visualHealth = this.displayHealth
    // Hoisted out of the loop: these were object lookups and colour-space
    // maths repeated for every body on every frame.
    const invMaxHp = this.invMaxHp
    const isPlayer = this.unitIsPlayer
    const leaderScale = this.leaderScale
    const playerTints = this.playerTints
    const enemyTints = this.enemyTints
    const playerFlash = this.playerFlash
    const enemyFlash = this.enemyFlash
    const hp = b.hp
    const lastAttack = b.lastAttackTick
    const lastTarget = b.lastAttackTarget
    const tick = b.tick
    const groupOf = b.group
    const groups = b.groups

    this.streaks.clear()

    for (let i = 0; i < b.count; i++) {
      const sprite = sprites[i]
      const health = alive[i] === 1 ? clamp01(hp[i] * invMaxHp[i]) : 0
      const eased = visualHealth[i] + (health - visualHealth[i]) * 0.22
      visualHealth[i] = eased

      if (eased <= 0.01) {
        if (sprite.visible) sprite.visible = false
        continue
      }

      const curve = eased * eased
      sprite.visible = true
      const step = (curve * TINT_STEPS) | 0
      let baseTint = isPlayer[i] === 1 ? playerTints[step] : enemyTints[step]

      // Leaders are brighter/more saturated to stand out
      if (this.isLeader[i]) {
        baseTint = mixHex(baseTint, 0xffffff, 0.25)
      }

      sprite.tint = baseTint
      sprite.alpha = 0.03 + curve * 0.97

      /*
       * Attacks flash rather than lunge.
       *
       * A positional lunge was 7px on a body only 14-24px across, firing on
       * every swing — with a few hundred units at different phases that reads
       * as the whole field vibrating, which is exactly what it looked like.
       * The sim itself moves 0.5px/tick while engaged, so anything that
       * shifts a body is louder than the actual combat.
       *
       * A brightness spike plus a symmetric scale pulse says "this one just
       * struck" without translating anything.
       */
      const lead = leaderScale[i]
      const since = tick - lastAttack[i]
      let f = 0
      if (since >= 0 && since < FLASH_TICKS) {
        f = 1 - since / FLASH_TICKS
        const fs = (f * f * FLASH_STEPS) | 0
        sprite.tint = isPlayer[i] === 1 ? playerFlash[fs] : enemyFlash[fs]
        sprite.scale.set((0.03 + curve * 1.2 + f * f * 0.09) * lead)
      } else {
        sprite.scale.set((0.03 + curve * 1.2) * lead)
      }

      sprite.x = px[i] + (x[i] - px[i]) * alpha
      sprite.y = py[i] + (y[i] - py[i]) * alpha

      /*
       * A ranged shot's streak. Melee is adjacent already — there's no gap
       * for a line to cross — but a ranged hit was landing with nothing
       * visibly travelling the distance at all, which read as no attack
       * happening. Fades on the same clock as the flash above (f), and only
       * draws while the target is still around to draw a line to.
       */
      const t = lastTarget[i]
      if (f > 0 && t >= 0 && groups[groupOf[i]].stats.range > MELEE_RANGE) {
        const tx = px[t] + (x[t] - px[t]) * alpha
        const ty = py[t] + (y[t] - py[t]) * alpha
        this.streaks
          .moveTo(sprite.x, sprite.y)
          .lineTo(tx, ty)
          .stroke({ width: 3, color: groups[groupOf[i]].color, alpha: f })
      }
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
        named: group.named ?? false,
      }
    })
    const events = b.newEventsSince(this.lastEventCount)
    this.lastEventCount = b.eventCount
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
      events,
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

  private setupTooltip(host: HTMLElement): void {
    const tooltip = document.createElement('div')
    tooltip.style.cssText = `
      position: absolute;
      background: rgba(10, 8, 7, 0.95);
      border: 1px solid rgba(255, 215, 122, 0.4);
      border-radius: 4px;
      padding: 8px 10px;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      color: #d0d0d0;
      pointer-events: none;
      display: none;
      z-index: 1000;
      max-width: 280px;
      box-shadow: 0 0 12px rgba(0, 0, 0, 0.8);
    `
    host.appendChild(tooltip)
    this.tooltip = tooltip
  }

  private updateTooltip(sprite: Sprite, groupIndex: number): void {
    if (!this.tooltip || !this.config || !this.battle) return

    const group = this.config.groups[groupIndex]
    const stats = group.stats
    const spriteIndex = this.sprites.indexOf(sprite)
    const isLeader = this.isLeader[spriteIndex]
    const hp = this.displayHealth[spriteIndex]
    const currentHp = Math.round(hp * stats.hp)

    const lineageEmoji = group.color === 0x5a7fa3 ? '⬡' : '✦'

    // Enhanced layout for leaders
    let headerHtml = `
      <div style="font-weight: bold; color: #e0e0e0; margin-bottom: 6px; font-size: 12px;">
        ${lineageEmoji} ${group.label}${group.leaderLabel ? ` — <span style="color: #ffd77a;">${group.leaderLabel}</span>` : ''}
      </div>
    `

    if (isLeader) {
      headerHtml = `
        <div style="font-weight: bold; color: #ffd77a; margin-bottom: 4px; font-size: 13px;">
          ★ ${group.label}
        </div>
        <div style="color: #ffd77a; margin-bottom: 6px; font-size: 11px;">
          ${group.leaderLabel}
        </div>
      `
    } else {
      headerHtml = `
        <div style="font-weight: bold; color: #e0e0e0; margin-bottom: 6px; font-size: 12px;">
          ${lineageEmoji} ${group.label}
        </div>
        <div style="color: #b0b0b0; font-size: 10px; margin-bottom: 6px;">Member of Squad</div>
      `
    }

    const content = `
      <div style="line-height: 1.6;">
        ${headerHtml}
        <div style="border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 8px;">
          <div><span style="color: #808080; min-width: 40px; display: inline-block;">HP:</span> <span style="color: #b0b0b0;">${currentHp}/${Math.round(stats.hp)}</span></div>
          <div><span style="color: #808080; min-width: 40px; display: inline-block;">DMG:</span> <span style="color: #b0b0b0;">${stats.damage.toFixed(1)}</span></div>
          <div><span style="color: #808080; min-width: 40px; display: inline-block;">ARM:</span> <span style="color: #b0b0b0;">${stats.armor.toFixed(1)}</span></div>
          <div><span style="color: #808080; min-width: 40px; display: inline-block;">RNG:</span> <span style="color: #b0b0b0;">${stats.range.toFixed(0)}</span></div>
          <div><span style="color: #808080; min-width: 40px; display: inline-block;">ACC:</span> <span style="color: #b0b0b0;">${(stats.accuracy * 100).toFixed(0)}%</span></div>
          <div><span style="color: #808080; min-width: 40px; display: inline-block;">EVD:</span> <span style="color: #b0b0b0;">${(stats.evade * 100).toFixed(0)}%</span></div>
          <div><span style="color: #808080; min-width: 40px; display: inline-block;">INT:</span> <span style="color: #b0b0b0;">${stats.attackInterval.toFixed(1)}t</span></div>
          <div><span style="color: #808080; min-width: 40px; display: inline-block;">DIS:</span> <span style="color: #b0b0b0;">${(group.discipline * 100).toFixed(0)}%</span></div>
        </div>
      </div>
    `

    this.tooltip.innerHTML = content
    this.tooltip.style.display = 'block'

    // Position tooltip near the sprite
    if (this.tooltipHost) {
      const rect = this.tooltipHost.getBoundingClientRect()
      const spriteScreenX = sprite.getGlobalPosition().x
      const spriteScreenY = sprite.getGlobalPosition().y
      this.tooltip.style.left = `${spriteScreenX + rect.left + 20}px`
      this.tooltip.style.top = `${spriteScreenY + rect.top - 40}px`
    }
  }

  private hideTooltip(): void {
    if (this.tooltip) {
      this.tooltip.style.display = 'none'
    }
  }
}
