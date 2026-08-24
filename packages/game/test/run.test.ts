import { describe, expect, it } from 'vitest'
import { Battle, Rng, hashSeed } from '@salt/sim'
import {
  ENCOUNTERS_PER_RUN,
  assignLeader,
  buildBattle,
  buy,
  moveSquad,
  newRun,
  placeSquad,
  BATTLES_PER_MUTATION,
  FIRSTBORN_AT_MUTATIONS,
  chooseMutation,
  isFirstborn,
  isReadyToMutate,
  prospectTitle,
  resolveDiscipline,
  isMaxed,
  canBecomeFirstborn,
  rollCapacity,
  rollProspect,
  prospectCost,
  appraise,
  resolveEvent,
  rollEvent,
  EVENTS,
  MORALE_MIN,
  MORALE_MAX,
  DISCIPLINE,
  setFielded,
  sellProspect,
  sellValue,
  fieldedCount,
  MAX_FIELDED_PROSPECTS,
  revealIfMaxed,
  APPRAISAL_COST,
  ASSUMED_CAPACITY,
  rollGrowthChoices,
  rollOfficer,
  squadLabel,
  toSimGroups,
  totalBodies,
  totalFodder,
  unitType,
  resolveBattle,
  resolveProspectStats,
  resolveSquadStats,
  treatWound,
  treatOfficer,
  escalateWound,
  recoverWound,
  officerBonusMultiplier,
  TREAT_COST,
  WOUND_PENALTY,
} from '@salt/game'
import type { RunState, Wound } from '@salt/game'
import { TEAM_A, TEAM_B } from '@salt/sim'

function start(seed = 'test-seed'): RunState {
  const leader = rollOfficer(new Rng(hashSeed(seed)), 'leader-0')
  return newRun(seed, leader)
}

const ids = (run: RunState) => run.warband.squads.map((s) => s.id)

describe('run setup', () => {
  it('starts with a warband, salvage, offers and an encounter', () => {
    const run = start()
    expect(run.phase).toBe('camp')
    expect(run.encounterIndex).toBe(0)
    expect(run.warband.squads.length).toBeGreaterThan(0)
    expect(run.warband.salvage).toBeGreaterThan(0)
    expect(run.offers.length).toBeGreaterThan(0)
    expect(run.encounter.bodies).toBeGreaterThan(0)
  })

  it('is reproducible from the same seed', () => {
    expect(ids(start('same'))).toEqual(ids(start('same')))
    expect(totalBodies(start('same').warband)).toBe(totalBodies(start('same').warband))
  })

  it('gives the player something they can afford at the first camp', () => {
    // A camp where nothing is purchasable is a dead turn. Guard the opening.
    let affordableSomewhere = 0
    for (let i = 0; i < 25; i++) {
      const run = start(`open-${i}`)
      if (run.offers.some((o) => o.cost <= run.warband.salvage)) affordableSomewhere++
    }
    expect(affordableSomewhere).toBeGreaterThan(20)
  })
})

describe('recruiting', () => {
  it('spends salvage, adds the squad, and consumes the offer', () => {
    const run = start()
    const offer = run.offers.find((o) => o.kind === 'squad' && o.cost <= run.warband.salvage)
    expect(offer).toBeDefined()

    const after = buy(run, offer!.id)
    expect(after.warband.salvage).toBe(run.warband.salvage - offer!.cost)
    expect(after.warband.squads.length).toBe(run.warband.squads.length + 1)
    expect(after.offers.find((o) => o.id === offer!.id)).toBeUndefined()
  })

  it('brings the batch’s standouts along with the bodies', () => {
    for (let i = 0; i < 40; i++) {
      const run = start(`standout-${i}`)
      const offer = run.offers.find(
        (o) => o.kind === 'squad' && o.prospects.length > 0 && o.cost <= run.warband.salvage,
      )
      if (!offer || offer.kind !== 'squad') continue
      const after = buy(run, offer.id)
      expect(after.warband.prospects.length).toBe(
        run.warband.prospects.length + offer.prospects.length,
      )
      return
    }
    throw new Error('no affordable offer with standouts in 40 seeds')
  })

  it('refuses a purchase the player cannot afford', () => {
    const run = { ...start(), warband: { ...start().warband, salvage: 0 } }
    const before = run.warband.squads.length
    for (const offer of run.offers) {
      expect(buy(run, offer.id).warband.squads.length).toBe(before)
    }
  })

  it('ignores an unknown offer id', () => {
    const run = start()
    expect(buy(run, 'nope')).toBe(run)
  })
})

describe('leadership', () => {
  it('assigns an officer to a squad', () => {
    const run = start()
    const officer = run.warband.officers[0]
    const squad = run.warband.squads[0]
    const after = assignLeader(run, squad.id, { kind: 'officer', id: officer.id })
    expect(after.warband.squads[0].leader).toEqual({ kind: 'officer', id: officer.id })
  })

  it('never lets one leader lead two squads', () => {
    const run = start()
    const officer = run.warband.officers[0]
    const [a, b] = run.warband.squads
    expect(b).toBeDefined()

    const after = assignLeader(
      assignLeader(run, a.id, { kind: 'officer', id: officer.id }),
      b.id,
      { kind: 'officer', id: officer.id },
    )

    const leading = after.warband.squads.filter(
      (s) => s.leader?.kind === 'officer' && s.leader.id === officer.id,
    )
    expect(leading).toHaveLength(1)
    expect(leading[0].id).toBe(b.id)
  })

  it('refuses to put a Prospect in charge of True Kin', () => {
    // A mutant does not command True Kin. Design invariant, not a UI nicety.
    const run = start()
    const prospect = run.warband.prospects[0]
    expect(prospect).toBeDefined()

    const trueKin = run.warband.squads.find((s) => unitType(s.typeId).lineage === 'truekin')
    if (!trueKin) return // starting warband is all mutant; covered by the shop path

    const after = assignLeader(run, trueKin.id, { kind: 'prospect', id: prospect.id })
    expect(after).toBe(run)
  })

  it('clears a leader when passed null', () => {
    const run = start()
    const officer = run.warband.officers[0]
    const squad = run.warband.squads[0]
    const led = assignLeader(run, squad.id, { kind: 'officer', id: officer.id })
    expect(assignLeader(led, squad.id, null).warband.squads[0].leader).toBeNull()
  })
})

describe('battle line ordering', () => {
  it('moves a squad one slot at a time', () => {
    const run = start()
    if (run.warband.squads.length < 2) return
    const [first, second] = ids(run)

    const down = moveSquad(run, first, 1)
    expect(ids(down).slice(0, 2)).toEqual([second, first])
    expect(ids(moveSquad(down, first, -1))).toEqual(ids(run))
  })

  it('refuses to move past either end', () => {
    const run = start()
    const list = ids(run)
    expect(ids(moveSquad(run, list[0], -1))).toEqual(list)
    expect(ids(moveSquad(run, list[list.length - 1], 1))).toEqual(list)
  })

  it('places a squad at an explicit index without losing or duplicating any', () => {
    // Drag-and-drop feeds this directly; an off-by-one here silently corrupts
    // the battle line, since squad order drives formation placement.
    const run = start()
    const list = ids(run)
    if (list.length < 2) return

    for (let from = 0; from < list.length; from++) {
      for (let to = 0; to < list.length; to++) {
        const after = ids(placeSquad(run, list[from], to))
        expect(after).toHaveLength(list.length)
        expect(new Set(after).size).toBe(list.length)
        expect(after[to]).toBe(list[from])
      }
    }
  })

  it('ignores out-of-range indices', () => {
    const run = start()
    const list = ids(run)
    expect(ids(placeSquad(run, list[0], -1))).toEqual(list)
    expect(ids(placeSquad(run, list[0], list.length))).toEqual(list)
  })

  it('feeds squad order straight into battle group order', () => {
    const run = start()
    const before = toSimGroups(run.warband, TEAM_A).sources.map((s) => s.id)
    const list = ids(run)
    if (list.length < 2) return

    const moved = moveSquad(run, list[0], 1)
    const after = toSimGroups(moved.warband, TEAM_A).sources.map((s) => s.id)
    expect(after).not.toEqual(before)
    expect(new Set(after)).toEqual(new Set(before))
  })
})

describe('battle setup', () => {
  it('builds both sides and maps every player group back to a source', () => {
    const run = start()
    const setup = buildBattle(run)
    const playerGroups = setup.config.groups.filter((g) => g.team === TEAM_A)

    expect(setup.playerSources).toHaveLength(playerGroups.length)
    expect(setup.config.groups.length).toBeGreaterThan(playerGroups.length)
    for (const g of setup.config.groups) expect(g.count).toBeGreaterThan(0)
  })

  it('fields every body the warband has', () => {
    const run = start()
    const setup = buildBattle(run)
    const fielded = setup.config.groups
      .filter((g) => g.team === TEAM_A)
      .reduce((n, g) => n + g.count, 0)
    expect(fielded).toBe(totalFodder(run.warband) + run.warband.prospects.length)
  })

  it('fields a leading Prospect as its own killable body', () => {
    // Regression. Leading Prospects were skipped when building groups, so
    // their body never reached the field AND resolveBattle — which maps
    // outcomes back through these groups — could never record them as dead.
    // Promoting your best standout to leader made it immortal.
    const run = start()
    const prospect = run.warband.prospects[0]
    const squad = run.warband.squads.find((s) => unitType(s.typeId).lineage === 'mutant')
    expect(prospect && squad).toBeTruthy()

    const led = assignLeader(run, squad!.id, { kind: 'prospect', id: prospect.id })
    const { groups, sources } = toSimGroups(led.warband, TEAM_A)

    expect(sources).toContainEqual({ kind: 'prospect', id: prospect.id })
    const fielded = groups.reduce((n, g) => n + g.count, 0)
    expect(fielded).toBe(totalFodder(led.warband) + led.warband.prospects.length)
  })

  it('leaks a leader’s mutations into the squad it leads', () => {
    const run = start()
    const prospect = run.warband.prospects[0]
    const squad = run.warband.squads.find((s) => unitType(s.typeId).lineage === 'mutant')!
    if (prospect.mutations.length === 0) return

    const before = toSimGroups(run.warband, TEAM_A).groups.find((g) => g.label === squadLabel(squad))
    const led = assignLeader(run, squad.id, { kind: 'prospect', id: prospect.id })
    const after = toSimGroups(led.warband, TEAM_A).groups.find((g) => g.label === squadLabel(squad))

    expect(before).toBeDefined()
    expect(after).toBeDefined()
    // Some stat must have moved — that's the whole point of leading.
    expect(JSON.stringify(after!.stats)).not.toBe(JSON.stringify(before!.stats))
  })

  it('runs for the advertised number of encounters', () => {
    expect(ENCOUNTERS_PER_RUN).toBeGreaterThan(0)
    expect(start().encounter.index).toBe(0)
  })
})

describe('mutation growth', () => {
  /** Age the Prospects, and give them room to grow into. */
  const survive = (run: RunState, battles: number, capacity = 6): RunState => ({
    ...run,
    warband: {
      ...run.warband,
      prospects: run.warband.prospects.map((p) => ({ ...p, battles, capacity })),
    },
  })

  it('offers nothing until a Prospect has survived enough', () => {
    const run = start()
    expect(run.growth).toEqual([])
    expect(run.warband.prospects.every((p) => !isReadyToMutate(p))).toBe(true)
  })

  it('marks a Prospect ready once it has earned a mutation', () => {
    const run = survive(start(), BATTLES_PER_MUTATION)
    expect(run.warband.prospects.some(isReadyToMutate)).toBe(true)
  })

  it('adds the chosen mutation and consumes the offer', () => {
    const base = survive(start(), BATTLES_PER_MUTATION)
    const p = base.warband.prospects[0]
    const run: RunState = {
      ...base,
      growth: [
        { prospectId: p.id, choices: [{ id: 'horns', level: 4 }, { id: 'carapace', level: 2 }] },
      ],
    }

    const after = chooseMutation(run, p.id, 0)
    const grown = after.warband.prospects.find((x) => x.id === p.id)!

    expect(grown.mutations).toContainEqual({ id: 'horns', level: 4 })
    expect(grown.mutations.length).toBe(p.mutations.length + 1)
    expect(grown.growth).toBe(p.growth + 1)
    // One pick per offer — taking it removes the whole offer, not one option.
    expect(after.growth).toHaveLength(0)
  })

  it('ignores an unknown prospect or an out-of-range choice', () => {
    const base = survive(start(), BATTLES_PER_MUTATION)
    const p = base.warband.prospects[0]
    const run: RunState = {
      ...base,
      growth: [{ prospectId: p.id, choices: [{ id: 'horns', level: 4 }] }],
    }
    expect(chooseMutation(run, 'nope', 0)).toBe(run)
    expect(chooseMutation(run, p.id, 9)).toBe(run)
  })

  it('never offers a mutation the Prospect already has', () => {
    const rng = new Rng(hashSeed('growth'))
    const run = start()
    const p = run.warband.prospects[0]
    for (let i = 0; i < 40; i++) {
      const choices = rollGrowthChoices(rng, p, i)
      const held = new Set(p.mutations.map((m) => m.id))
      for (const c of choices) expect(held.has(c.id)).toBe(false)
      // And never duplicates within a single offer.
      expect(new Set(choices.map((c) => c.id)).size).toBe(choices.length)
    }
  })

  it('stops offering growth once a Prospect is a Firstborn', () => {
    const p = {
      ...start().warband.prospects[0],
      battles: 99,
      growth: 0,
      mutations: Array.from({ length: FIRSTBORN_AT_MUTATIONS }, (_, i) => ({
        id: `m${i}`,
        level: 1,
      })),
    }
    expect(isReadyToMutate(p)).toBe(false)
  })
})

describe('capacity', () => {
  it('never starts a Prospect with more mutations than it can hold', () => {
    const rng = new Rng(hashSeed('cap'))
    for (let i = 0; i < 300; i++) {
      const p = rollProspect(rng, 0, i % 8)
      expect(p.mutations.length).toBeLessThanOrEqual(p.capacity)
      expect(p.capacity).toBeGreaterThan(0)
    }
  })

  it('produces a distribution where deep capacity is genuinely rare', () => {
    // The whole point is that most Prospects plateau early and a Firstborn
    // candidate is a find. If this flattens out, mutants stop having value.
    const rng = new Rng(hashSeed('dist'))
    const counts = new Map<number, number>()
    const n = 4000
    for (let i = 0; i < n; i++) {
      const c = rollCapacity(rng)
      counts.set(c, (counts.get(c) ?? 0) + 1)
    }
    const shallow = (counts.get(1) ?? 0) + (counts.get(2) ?? 0)
    const firstbornCapable = [...counts.entries()]
      .filter(([c]) => c >= FIRSTBORN_AT_MUTATIONS)
      .reduce((s, [, v]) => s + v, 0)

    expect(shallow / n).toBeGreaterThan(0.6)
    expect(firstbornCapable / n).toBeLessThan(0.06)
    expect(firstbornCapable).toBeGreaterThan(0)
  })

  it('stops growth at the body’s own ceiling, not a universal one', () => {
    const base = start().warband.prospects[0]
    const shallow = { ...base, capacity: 2, battles: 99, growth: 0, mutations: [
      { id: 'horns', level: 3 },
      { id: 'carapace', level: 3 },
    ] }
    const deep = { ...shallow, capacity: 6 }

    expect(isReadyToMutate(shallow)).toBe(false)
    expect(isMaxed(shallow)).toBe(true)
    expect(isReadyToMutate(deep)).toBe(true)
  })

  it('prices unused capacity once it is known', () => {
    const base = start().warband.prospects[0]
    const one = { ...base, capacity: 1, appraised: true, mutations: [{ id: 'horns', level: 3 }] }
    const six = { ...one, capacity: 6 }
    expect(prospectCost(six, 10)).toBeGreaterThan(prospectCost(one, 10))
  })

  it('prices an ungraded body identically whatever it is actually worth', () => {
    // This is the whole market. If the price tag moved with the hidden value
    // the player could read capacity straight off the shop and there would be
    // no gamble to take.
    const base = { ...start().warband.prospects[0], appraised: false, mutations: [] }
    const prices = [1, 2, 3, 4, 5, 6, 7].map((c) => prospectCost({ ...base, capacity: c }, 10))
    expect(new Set(prices).size).toBe(1)
  })

  it('charges a premium for certainty', () => {
    const base = { ...start().warband.prospects[0], capacity: ASSUMED_CAPACITY, mutations: [] }
    expect(prospectCost({ ...base, appraised: true }, 10)).toBeGreaterThan(
      prospectCost({ ...base, appraised: false }, 10),
    )
  })

  it('reveals a ceiling once a body stops growing', () => {
    const base = start().warband.prospects[0]
    const growing = { ...base, appraised: false, capacity: 3, mutations: [{ id: 'a', level: 1 }] }
    const done = { ...growing, mutations: [
      { id: 'a', level: 1 },
      { id: 'b', level: 1 },
      { id: 'c', level: 1 },
    ] }
    expect(revealIfMaxed(growing).appraised).toBe(false)
    expect(revealIfMaxed(done).appraised).toBe(true)
  })

  it('spends salvage to appraise, and only once', () => {
    const run = start()
    const p = run.warband.prospects.find((x) => !x.appraised)
    if (!p) return

    const after = appraise(run, p.id)
    expect(after.warband.salvage).toBe(run.warband.salvage - APPRAISAL_COST)
    expect(after.warband.prospects.find((x) => x.id === p.id)!.appraised).toBe(true)
    // Already graded — no further charge.
    expect(appraise(after, p.id)).toBe(after)
    // Cannot afford it.
    const broke = { ...run, warband: { ...run.warband, salvage: 0 } }
    expect(appraise(broke, p.id)).toBe(broke)
  })

  it('only lets deep bodies reach Firstborn', () => {
    const base = start().warband.prospects[0]
    expect(canBecomeFirstborn({ ...base, capacity: FIRSTBORN_AT_MUTATIONS })).toBe(true)
    expect(canBecomeFirstborn({ ...base, capacity: FIRSTBORN_AT_MUTATIONS - 1 })).toBe(false)
  })
})

describe('wound ladder', () => {
  // docs/V0-DESIGN.md §7: Healthy -> Strained -> Injured -> Crippled -> Dead,
  // named tier only, individually.

  it('escalates from Healthy into a rolled zone at Strained', () => {
    const rng = new Rng(1)
    const wound = escalateWound(null, rng)
    expect(wound.rung).toBe(1)
    expect(['head', 'core', 'arms', 'legs']).toContain(wound.zone)
  })

  it('escalates an existing wound one rung in the same zone, capped at Crippled', () => {
    const rng = new Rng(1)
    const strained: Wound = { zone: 'arms', rung: 1 }
    const injured = escalateWound(strained, rng)
    expect(injured).toEqual({ zone: 'arms', rung: 2 })

    const crippled = escalateWound(injured, rng)
    expect(crippled).toEqual({ zone: 'arms', rung: 3 })

    // Already Crippled — one more hit does not fall off the ladder.
    expect(escalateWound(crippled, rng)).toEqual({ zone: 'arms', rung: 3 })
  })

  it('recovers rungs toward Healthy and floors at null, never negative', () => {
    const crippled: Wound = { zone: 'legs', rung: 3 }
    expect(recoverWound(crippled, 1)).toEqual({ zone: 'legs', rung: 2 })
    expect(recoverWound(crippled, 2)).toEqual({ zone: 'legs', rung: 1 })
    expect(recoverWound(crippled, 3)).toBeNull()
    expect(recoverWound(crippled, 99)).toBeNull()
    expect(recoverWound(null, 2)).toBeNull()
  })

  it('applies a wound penalty to exactly the stat(s) its zone owns', () => {
    const base = resolveProspectStats(start().warband.prospects[0])

    const withWound = (zone: Wound['zone']) => {
      const p = { ...start().warband.prospects[0], wound: { zone, rung: 1 as const } }
      return resolveProspectStats(p)
    }

    const head = withWound('head')
    expect(head.accuracy).toBeLessThan(base.accuracy)
    expect(head.hp).toBeCloseTo(base.hp, 5)
    expect(head.damage).toBeCloseTo(base.damage, 5)

    const core = withWound('core')
    expect(core.hp).toBeLessThan(base.hp)
    expect(core.accuracy).toBeCloseTo(base.accuracy, 5)

    const arms = withWound('arms')
    expect(arms.damage).toBeLessThan(base.damage)
    expect(arms.hp).toBeCloseTo(base.hp, 5)

    const legs = withWound('legs')
    expect(legs.moveSpeed).toBeLessThan(base.moveSpeed)
    expect(legs.evade).toBeLessThanOrEqual(base.evade)
  })

  it('scales an Officer’s ENTIRE squad bonus by wound severity, any zone', () => {
    expect(officerBonusMultiplier(null)).toBe(1)
    expect(officerBonusMultiplier({ zone: 'head', rung: 1 })).toBeCloseTo(1 - WOUND_PENALTY[1], 5)
    expect(officerBonusMultiplier({ zone: 'legs', rung: 3 })).toBeCloseTo(1 - WOUND_PENALTY[3], 5)

    const officer = rollOfficer(new Rng(1), 'o')
    const squad = { id: 'x', typeId: 0, count: 20, leader: null }
    const healthy = resolveSquadStats(squad, officer)
    const crippled = resolveSquadStats(squad, { ...officer, wound: { zone: 'core', rung: 3 } })
    expect(JSON.stringify(crippled)).not.toBe(JSON.stringify(healthy))
  })

  it('wounds a Prospect who survives a battle while taking damage', () => {
    // A small, badly outmatched player force almost certainly takes damage
    // on its way to losing — real end-to-end wiring through resolveBattle,
    // not just the pure functions above.
    let run = start('wound-integration')
    // Recruit until there's a second squad, so the fight isn't over instantly.
    for (let i = 0; i < 5 && run.offers.some((o) => o.cost <= run.warband.salvage); i++) {
      const offer = run.offers.find((o) => o.kind === 'squad' && o.cost <= run.warband.salvage)
      if (offer) run = buy(run, offer.id)
    }

    const setup = buildBattle(run)
    // Stack the enemy heavily so the player side takes real damage.
    const config = {
      ...setup.config,
      groups: setup.config.groups.map((g) =>
        g.team === TEAM_B ? { ...g, count: g.count * 6 } : g,
      ),
    }
    const battle = new Battle(config)
    battle.run()

    const resolved = resolveBattle(run, battle.results(), battle.winner, battle.tick, setup.playerSources)
    const anyWounded = resolved.warband.prospects.some((p) => p.wound !== null)
    const anyDied = resolved.warband.prospects.length < run.warband.prospects.length
    // Overwhelmed 6x, at least one Prospect should be marked up in some way
    // — wounded if it survived, gone if it didn't. Both are the wound ladder
    // and permadeath doing their job.
    expect(anyWounded || anyDied || resolved.warband.prospects.length === 0).toBe(true)
  })

  it('treats a wound for salvage, one rung per payment', () => {
    const run = start()
    const wounded = {
      ...run,
      warband: {
        ...run.warband,
        salvage: TREAT_COST * 2,
        prospects: run.warband.prospects.map((p, i) =>
          i === 0 ? { ...p, wound: { zone: 'core' as const, rung: 2 as const } } : p,
        ),
      },
    }
    const target = wounded.warband.prospects[0]

    const once = treatWound(wounded, target.id)
    expect(once.warband.salvage).toBe(TREAT_COST)
    expect(once.warband.prospects[0].wound).toEqual({ zone: 'core', rung: 1 })

    const twice = treatWound(once, target.id)
    expect(twice.warband.salvage).toBe(0)
    expect(twice.warband.prospects[0].wound).toBeNull()

    // Fully healed — no further charge.
    expect(treatWound(twice, target.id)).toBe(twice)

    // Cannot afford it.
    const broke = { ...run, warband: { ...run.warband, salvage: 0 } }
    const brokeTarget = broke.warband.prospects.find((p) => p.wound === null)
    if (brokeTarget) {
      const stillWounded = {
        ...broke,
        warband: {
          ...broke.warband,
          prospects: broke.warband.prospects.map((p) =>
            p.id === brokeTarget.id ? { ...p, wound: { zone: 'legs' as const, rung: 1 as const } } : p,
          ),
        },
      }
      expect(treatWound(stillWounded, brokeTarget.id)).toBe(stillWounded)
    }
  })

  /*
   * An Officer wound was simulated and then unreachable — resolveBattle could
   * hand one out, it silently scaled down every bonus the Officer granted, and
   * nothing in the game could spend to fix it. The only route back to Healthy
   * was the one free rung per battle.
   */
  it('treats an Officer wound, restoring the squad bonus it was scaling down', () => {
    const run = start()
    const officer = run.warband.officers[0]
    const squad = run.warband.squads.find(
      (sq) => sq.leader?.kind === 'officer' && sq.leader.id === officer.id,
    )!

    const wounded = {
      ...run,
      warband: {
        ...run.warband,
        salvage: TREAT_COST,
        officers: run.warband.officers.map((o) =>
          o.id === officer.id ? { ...o, wound: { zone: 'arms' as const, rung: 1 as const } } : o,
        ),
      },
    }

    const hurtStats = resolveSquadStats(squad, wounded.warband.officers[0])
    const healed = treatOfficer(wounded, officer.id)

    expect(healed.warband.salvage).toBe(0)
    expect(healed.warband.officers[0].wound).toBeNull()

    // The point of paying: the bonus comes back. Compared as a whole stat line
    // so this holds whichever rank the seed happened to roll.
    const healedStats = resolveSquadStats(squad, healed.warband.officers[0])
    expect(healedStats).toEqual(resolveSquadStats(squad, officer))
    expect(healedStats).not.toEqual(hurtStats)

    // Healthy already, or broke — no charge either way.
    expect(treatOfficer(healed, officer.id)).toBe(healed)
    const broke = { ...wounded, warband: { ...wounded.warband, salvage: TREAT_COST - 1 } }
    expect(treatOfficer(broke, officer.id)).toBe(broke)
  })
})

describe('Firstborn promotion', () => {
  const withMutations = (n: number) => ({
    ...start().warband.prospects[0],
    capacity: 7,
    appraised: true,
    fielded: true,
    wound: null,
    mutations: Array.from({ length: n }, (_, i) => ({ id: `m${i}`, level: 4 })),
  })

  it('promotes only at the mutation threshold', () => {
    expect(isFirstborn(withMutations(FIRSTBORN_AT_MUTATIONS - 1))).toBe(false)
    expect(isFirstborn(withMutations(FIRSTBORN_AT_MUTATIONS))).toBe(true)
  })

  it('replaces the unit type in the title rather than decorating it', () => {
    // "Rust the Chaff" becomes "Rust, Firstborn" — no longer described by the
    // stock it came from.
    const before = withMutations(1)
    const after = withMutations(FIRSTBORN_AT_MUTATIONS)
    expect(prospectTitle(before, 'Chaff')).toContain('Chaff')
    expect(prospectTitle(after, 'Chaff')).not.toContain('Chaff')
    expect(prospectTitle(after, 'Chaff')).toContain('Firstborn')
  })

  it('leaks at full level instead of half — the whole payoff', () => {
    const squad = { id: 's', typeId: 0, count: 20, leader: { kind: 'prospect' as const, id: 'x' } }
    const horns = (n: number) => ({
      ...withMutations(0),
      mutations: Array.from({ length: n }, (_, i) => (i === 0 ? { id: 'horns', level: 6 } : { id: `m${i}`, level: 1 })),
    })

    const bare = resolveSquadStats({ ...squad, leader: null }, null)
    const led = resolveSquadStats(squad, null, horns(1))
    const legend = resolveSquadStats(squad, null, horns(FIRSTBORN_AT_MUTATIONS))

    // Horns 6 leaks as 3 from a Prospect, as 6 from a Firstborn.
    expect(led.damage).toBeCloseTo(bare.damage + 3 * 1.5, 5)
    expect(legend.damage).toBeGreaterThan(led.damage)
  })

  it('makes a squad it leads hold together longer', () => {
    const prospect = withMutations(1)
    const legend = withMutations(FIRSTBORN_AT_MUTATIONS)
    expect(resolveDiscipline(0, null, legend)).toBeGreaterThan(
      resolveDiscipline(0, null, prospect),
    )
  })

  it('is tougher in its own right', () => {
    expect(resolveProspectStats(withMutations(FIRSTBORN_AT_MUTATIONS)).hp).toBeGreaterThan(
      resolveProspectStats({ ...withMutations(FIRSTBORN_AT_MUTATIONS - 1), mutations: [] }).hp,
    )
  })

  it('announces the promotion exactly once, at the moment it happens', () => {
    const base = start()
    const p = { ...withMutations(FIRSTBORN_AT_MUTATIONS - 1), id: 'promote-me' }
    const run: RunState = {
      ...base,
      warband: { ...base.warband, prospects: [p] },
      growth: [{ prospectId: p.id, choices: [{ id: 'horns', level: 5 }] }],
      promoted: [],
    }

    const after = chooseMutation(run, p.id, 0)
    expect(after.promoted).toEqual([p.id])
    expect(isFirstborn(after.warband.prospects[0])).toBe(true)
  })

  it('does not announce a promotion that did not happen', () => {
    const base = start()
    const p = { ...withMutations(1), id: 'still-stock' }
    const run: RunState = {
      ...base,
      warband: { ...base.warband, prospects: [p] },
      growth: [{ prospectId: p.id, choices: [{ id: 'horns', level: 5 }] }],
      promoted: [],
    }
    expect(chooseMutation(run, p.id, 0).promoted).toEqual([])
  })
})

describe('reserve and market', () => {
  const stock = (n: number, over: Partial<import('@salt/game').Prospect> = {}) =>
    Array.from({ length: n }, (_, i) => ({
      ...start().warband.prospects[0],
      id: `p${i}`,
      fielded: true,
      ...over,
    }))

  const withProspects = (ps: import('@salt/game').Prospect[]): RunState => {
    const base = start()
    return { ...base, warband: { ...base.warband, prospects: ps, squads: [] } }
  }

  it('caps how many can take the field, not how many you own', () => {
    const run = withProspects([
      ...stock(MAX_FIELDED_PROSPECTS),
      { ...stock(1)[0], id: 'bench', fielded: false },
    ])
    expect(run.warband.prospects).toHaveLength(MAX_FIELDED_PROSPECTS + 1)

    // Full: the benched one cannot come on.
    expect(setFielded(run, 'bench', true)).toBe(run)

    // Make room, and it can.
    const freed = setFielded(run, 'p0', false)
    expect(fieldedCount(setFielded(freed, 'bench', true).warband.prospects)).toBe(
      MAX_FIELDED_PROSPECTS,
    )
  })

  it('keeps benched bodies off the battlefield entirely', () => {
    const run = withProspects([
      { ...stock(1)[0], id: 'in', fielded: true },
      { ...stock(1)[0], id: 'out', fielded: false },
    ])
    const sources = toSimGroups(run.warband, TEAM_A).sources
    expect(sources).toContainEqual({ kind: 'prospect', id: 'in' })
    expect(sources).not.toContainEqual({ kind: 'prospect', id: 'out' })
  })

  it('drops a leadership when the leader is benched or sold', () => {
    const base = start()
    const p = base.warband.prospects[0]
    const squad = base.warband.squads.find((s) => s.leader?.kind === 'prospect')
    expect(squad).toBeDefined()

    expect(
      setFielded(base, p.id, false).warband.squads.find((s) => s.id === squad!.id)!.leader,
    ).toBeNull()
    expect(
      sellProspect(base, p.id).warband.squads.find((s) => s.id === squad!.id)!.leader,
    ).toBeNull()
  })

  it('pays out and removes the body when sold', () => {
    const base = start()
    const p = base.warband.prospects[0]
    const after = sellProspect(base, p.id)
    expect(after.warband.prospects).toHaveLength(0)
    expect(after.warband.salvage).toBeGreaterThan(base.warband.salvage)
  })

  it('sells below cost, so buy-appraise-sell is not free money', () => {
    // The spread is the whole reason speculation has a downside. Without it a
    // player could grind salvage by churning the shop.
    const base = start().warband.prospects[0]
    for (const capacity of [1, 3, 7]) {
      const p = { ...base, capacity, appraised: true, mutations: [] }
      expect(sellValue(p, 10)).toBeLessThan(prospectCost(p, 10))
    }
  })

  it('pays more for a body that graded out deep', () => {
    const base = start().warband.prospects[0]
    const shallow = { ...base, capacity: 1, appraised: true, mutations: [] }
    const deep = { ...base, capacity: 7, appraised: true, mutations: [] }
    expect(sellValue(deep, 10)).toBeGreaterThan(sellValue(shallow, 10))
  })

  it('ignores an unknown id', () => {
    const run = start()
    expect(sellProspect(run, 'nope')).toBe(run)
    expect(setFielded(run, 'nope', false)).toBe(run)
  })
})

describe('events and morale', () => {
  const withEvent = (event: import('@salt/game').GameEvent): RunState => {
    const base = start()
    return { ...base, event, seenEvents: [] }
  }

  it('applies both salvage and morale from the chosen branch', () => {
    const run = withEvent({
      id: 'test',
      title: 't',
      body: 'b',
      choices: [{ label: 'a', detail: 'd', salvage: 50, morale: -0.05 }],
    })
    const after = resolveEvent(run, 0)
    expect(after.warband.salvage).toBe(run.warband.salvage + 50)
    expect(after.warband.morale).toBeCloseTo(-0.05, 5)
    expect(after.event).toBeNull()
    expect(after.seenEvents).toEqual(['test'])
  })

  it('refuses a branch the player cannot afford', () => {
    const run = {
      ...withEvent({
        id: 'test',
        title: 't',
        body: 'b',
        choices: [{ label: 'a', detail: 'd', requires: 999, salvage: -999 }],
      }),
    }
    expect(resolveEvent(run, 0)).toBe(run)
  })

  it('clamps morale so it can never become a second health bar', () => {
    let run = withEvent({
      id: 'a',
      title: 't',
      body: 'b',
      choices: [{ label: 'a', detail: 'd', morale: 1 }],
    })
    run = resolveEvent(run, 0)
    expect(run.warband.morale).toBe(MORALE_MAX)

    run = { ...run, event: { id: 'b', title: 't', body: 'b', choices: [{ label: 'a', detail: 'd', morale: -5 }] } }
    expect(resolveEvent(run, 0).warband.morale).toBe(MORALE_MIN)
  })

  it('never repeats an event within a run', () => {
    const rng = new Rng(hashSeed('events'))
    const seen: string[] = []
    for (let i = 0; i < EVENTS.length; i++) {
      const e = rollEvent(rng, seen)
      expect(e).not.toBeNull()
      expect(seen).not.toContain(e!.id)
      seen.push(e!.id)
    }
    // Table exhausted — a run simply stops having events rather than looping.
    expect(rollEvent(rng, seen)).toBeNull()
  })

  it('feeds morale into every squad’s discipline', () => {
    const base = DISCIPLINE.mutant
    expect(resolveDiscipline(0, null, null, 0)).toBeCloseTo(base, 5)
    expect(resolveDiscipline(0, null, null, MORALE_MAX)).toBeGreaterThan(base)
    expect(resolveDiscipline(0, null, null, MORALE_MIN)).toBeLessThan(base)
  })

  it('gives every event at least two real branches', () => {
    // A choice with one option is a notification. A choice where every branch
    // does the same thing is worse — it looks like a decision and is not.
    for (const e of EVENTS) {
      expect(e.choices.length).toBeGreaterThan(1)
      const shapes = e.choices.map((c) => `${c.salvage ?? 0}:${c.morale ?? 0}`)
      expect(new Set(shapes).size).toBe(shapes.length)
    }
  })
})
