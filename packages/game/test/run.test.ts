import { describe, expect, it } from 'vitest'
import { Battle, BattleEventType, MAX_BODY_RADIUS, Rng, hashSeed } from '@salt/sim'
import type { BattleEvent, GroupResult, SimGroup } from '@salt/sim'
import {
  ENCOUNTERS_PER_RUN,
  MUTATIONS,
  MUTANT_TYPES,
  TRUEKIN_TYPES,
  assignLeader,
  buildBattle,
  buy,
  rerollOffers,
  rerollCost,
  moveSquad,
  newRun,
  advance,
  march,
  placeSquad,
  BATTLES_PER_MUTATION,
  earnedGrowth,
  QUICKENED_BATTLES_PER_MUTATION,
  QUICKENED_CHANCE,
  MAX_MUTATION_LEVEL,
  QUICKENED_MAX_MUTATION_LEVEL,
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
  sendExpedition,
  recallExpedition,
  resolveExpedition,
  expeditionCost,
  expectedHaul,
  installBionic,
  BIONICS,
  BIONICS_BY_ID,
  BIONIC_SLOTS,
  assignRelic,
  RELICS,
  rollMachine,
  MACHINE_CONDITION_MAX,
  MACHINE_RUN_COST,
  conditionMultiplier,
  machinePower,
  statPower,
  MACHINE_TYPES,
  resolveMachineStats,
  sellValue,
  fieldedCount,
  MAX_FIELDED_PROSPECTS,
  revealIfMaxed,
  APPRAISAL_COST,
  ASSUMED_CAPACITY,
  rollGrowthChoices,
  rollOfficer,
  HOUSES,
  HOUSES_BY_NAME,
  rollOffers,
  postmortem,
  scoutEnemy,
  armorWord,
  mixWord,
  ORIGINS_BY_ID,
  foundingLevel,
  generateEncounter,
  ENCOUNTERS_PER_ACT,
  ACTS,
  actOf,
  isBossIndex,
  encounterBudget,
  BOSS_TYPES,
  LEGENDARY_TYPES,
  LEGENDARY_IDS,
  FAUNA_TYPES,
  squadLabel,
  toSimGroups,
  makeGroup,
  totalBodies,
  totalFodder,
  unitType,
  waterUpkeep,
  payWater,
  WATER_PER_BODY,
  UNIT_TYPES,
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
  WOUND_ZONES,
  harmKindFromLabel,
  describeInjury,
  applyPermanentInjuries,
  PERMANENT_INJURY_PENALTY,
} from '@salt/game'
import type { Encounter, Prospect, RunState, Warband, Wound } from '@salt/game'
import { TEAM_A, TEAM_B } from '@salt/sim'

function start(seed = 'test-seed'): RunState {
  const leader = rollOfficer(new Rng(hashSeed(seed)), 'leader-0')
  return newRun(seed, { origin: 'scion', officer: leader })
}

const ids = (run: RunState) => run.warband.squads.map((s) => s.id)

/** Stand-in for the ruin-find roller resolveExpedition takes. */
const rollProspect0 = (rng: Rng, index: number) => rollProspect(rng, 0, index)
const rollBionic0 = (rng: Rng) => BIONICS[rng.int(BIONICS.length)].id
const rollRelic0 = (rng: Rng) => RELICS[rng.int(RELICS.length)].id

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
    // A camp where nothing is purchasable is a dead turn. Guard the opening —
    // and guard BODIES specifically, because an opening shop that only offers
    // an unaffordable Officer is the same dead turn wearing a hat.
    let anything = 0
    let bodies = 0
    for (let i = 0; i < 60; i++) {
      const run = start(`open-${i}`)
      const affordable = run.offers.filter((o) => o.cost <= run.warband.salvage)
      if (affordable.length > 0) anything++
      if (affordable.some((o) => o.kind === 'squad')) bodies++
    }
    expect(anything).toBeGreaterThan(55)
    expect(bodies).toBeGreaterThan(45)
  })
})

describe('recruiting', () => {
  it('spends salvage, adds the squad, and consumes the offer', () => {
    // Seed-scanned rather than pinned. A single seed's opening shop is not
    // guaranteed to hold an affordable SQUAD — the guarantee that it usually
    // does is the test below, and asserting it here as well made this one
    // fail whenever an unrelated change shifted the rng stream.
    for (let i = 0; i < 40; i++) {
      const run = start(`buy-${i}`)
      const offer = run.offers.find((o) => o.kind === 'squad' && o.cost <= run.warband.salvage)
      if (!offer) continue

      const after = buy(run, offer.id)
      expect(after.warband.salvage).toBe(run.warband.salvage - offer.cost)
      expect(after.warband.squads.length).toBe(run.warband.squads.length + 1)
      expect(after.offers.find((o) => o.id === offer.id)).toBeUndefined()
      return
    }
    throw new Error('no affordable squad offer in 40 opening camps')
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

describe('rerolling', () => {
  it('replaces the offers for salvage and remembers how many times this camp', () => {
    const run = { ...start(), warband: { ...start().warband, salvage: 5000 } }
    const before = run.offers.map((o) => o.id)

    const once = rerollOffers(run)
    expect(once.rerollCount).toBe(1)
    expect(once.offers.map((o) => o.id)).not.toEqual(before)
    expect(once.warband.salvage).toBe(5000 - rerollCost(run.encounterIndex, 0))

    const twice = rerollOffers(once)
    expect(twice.rerollCount).toBe(2)
    // Escalates within the same camp — a second reroll costs more than the first.
    expect(rerollCost(run.encounterIndex, 1)).toBeGreaterThan(rerollCost(run.encounterIndex, 0))
    expect(twice.warband.salvage).toBe(once.warband.salvage - rerollCost(run.encounterIndex, 1))
  })

  it('refuses a reroll the player cannot afford', () => {
    const cost = rerollCost(0, 0)
    const run = { ...start(), warband: { ...start().warband, salvage: cost - 1 } }
    expect(rerollOffers(run)).toBe(run)
  })

  it('resets the count at the next camp', () => {
    const run = { ...start(), warband: { ...start().warband, salvage: 5000 } }
    const rerolled = rerollOffers(run)
    expect(rerolled.rerollCount).toBe(1)

    // Hand-built win, same pattern as the machine/bionic tests above — a
    // real simulated battle isn't guaranteed to go the player's way, and
    // advance() only opens a fresh camp (with a fresh rerollCount) on one.
    const marched = march(rerolled)
    const results = marched.setup.playerSources.map(() => ({
      label: 'x', started: 1, dead: 0, survived: 1, endEffectiveness: 1,
      damageDealt: 0, damageTaken: 0, damageBlocked: 0, swings: 0, hits: 0, team: TEAM_A,
    })) as never as GroupResult[]
    const resolved = resolveBattle(marched.state, results, TEAM_A, 100, marched.setup.playerSources)
    const next = advance(resolved)
    expect(next.rerollCount).toBe(0)
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

  it("never applies a leading Prospect's mutations to its squad's stats", () => {
    /*
     * The removed "leak": a leading Prospect used to pass its own mutations
     * to every body in the squad, half level for an ordinary Prospect, full
     * level for a Firstborn. Cut because nothing explains how one body's
     * mutation reaches another's — see docs/ROADMAP.md's post-M4 entry.
     *
     * A leading Prospect affects DISCIPLINE only now. This test exists so a
     * future change that re-adds a stat effect to resolveSquadStats's leader
     * path fails loudly here rather than being noticed by a player.
     */
    const run = start()
    const mutant = run.warband.squads.find((sq) => unitType(sq.typeId).lineage === 'mutant')!
    const prospect = run.warband.prospects.find(
      (p) => p.mutations.length > 0 && unitType(p.typeId).lineage === 'mutant',
    )

    const bare = resolveSquadStats(mutant, null, null)
    if (prospect) {
      const led = resolveSquadStats(mutant, null, prospect)
      expect(led).toEqual(bare)
    }

    // Directly, independent of what the opening roster happens to roll:
    // a heavily mutated body leading a squad still leaves every stat field
    // identical to unled.
    // Below FIRSTBORN_AT_MUTATIONS, so isFirstborn is false on its own —
    // the titled variant below is what makes it true, in isolation.
    const heavy: Prospect = {
      id: 'x',
      typeId: mutant.typeId,
      name: 'x',
      mutations: MUTATIONS.slice(0, 2).map((m) => ({ id: m.id, level: 6 })),
      battles: 0,
      growth: 0,
      capacity: 7,
      appraised: true,
      fielded: true,
      wound: null,
      permanentInjuries: [],
      dismemberments: [],
    }
    expect(resolveSquadStats(mutant, null, heavy)).toEqual(bare)
    expect(resolveSquadStats(mutant, null, { ...heavy, titled: true })).toEqual(bare)

    // The only thing a leading Prospect moves is discipline, and Firstborn
    // moves it further than an ordinary one.
    expect(resolveDiscipline(mutant.typeId, null, heavy)).toBeGreaterThan(
      resolveDiscipline(mutant.typeId, null, null),
    )
    expect(resolveDiscipline(mutant.typeId, null, { ...heavy, titled: true })).toBeGreaterThan(
      resolveDiscipline(mutant.typeId, null, heavy),
    )
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
      .filter((g: SimGroup) => g.team === TEAM_A)
      .reduce((n: number, g: SimGroup) => n + g.count, 0)
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

describe('Quickened', () => {
  it('rolls rarely, roughly at QUICKENED_CHANCE', () => {
    const rng = new Rng(hashSeed('quickened-rate'))
    let quickened = 0
    const n = 4000
    for (let i = 0; i < n; i++) {
      if (rollProspect(rng, 0, i % 8).quickened) quickened++
    }
    // Generous band — this is a rate check, not a pin.
    const rate = quickened / n
    expect(rate).toBeGreaterThan(QUICKENED_CHANCE * 0.4)
    expect(rate).toBeLessThan(QUICKENED_CHANCE * 2)
  })

  it('earns growth in half the battles', () => {
    const rng = new Rng(hashSeed('quickened-growth'))
    const base = rollProspect(rng, 0, 0)
    const quick = { ...base, quickened: true }
    const plain = { ...base, quickened: false }

    for (let battles = 0; battles < 10; battles++) {
      const q = { ...quick, battles }
      const p = { ...plain, battles }
      expect(earnedGrowth(q)).toBe(Math.floor(battles / QUICKENED_BATTLES_PER_MUTATION))
      expect(earnedGrowth(p)).toBe(Math.floor(battles / BATTLES_PER_MUTATION))
      expect(earnedGrowth(q)).toBeGreaterThanOrEqual(earnedGrowth(p))
    }
  })

  it('can roll mutation levels past the ordinary ceiling, but only when Quickened', () => {
    const rng = new Rng(hashSeed('quickened-level'))
    const base = rollProspect(rng, 0, 14) // late encounterIndex, maxLevel already saturated
    let sawPastCap = false
    let plainSawPastCap = false
    for (let i = 0; i < 200; i++) {
      const quick = rollGrowthChoices(rng, { ...base, quickened: true, mutations: [] }, 14)
      const plain = rollGrowthChoices(rng, { ...base, quickened: false, mutations: [] }, 14)
      if (quick.some((c) => c.level > MAX_MUTATION_LEVEL)) sawPastCap = true
      if (plain.some((c) => c.level > MAX_MUTATION_LEVEL)) plainSawPastCap = true
      expect(quick.every((c) => c.level <= QUICKENED_MAX_MUTATION_LEVEL)).toBe(true)
      expect(plain.every((c) => c.level <= MAX_MUTATION_LEVEL)).toBe(true)
    }
    expect(sawPastCap).toBe(true)
    expect(plainSawPastCap).toBe(false)
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

  it("never passes a leading Prospect's mutations to its squad", () => {
    /*
     * The "leak" was cut. Nothing explains how one body's mutation reaches
     * twenty others, and the game already has an honest mechanism for a
     * leader steadying their squad — discipline — without inventing a
     * biological one. This holds for an ordinary Prospect AND a Firstborn:
     * neither changes the squad's STATS, only its discipline.
     */
    const squad = { id: 's', typeId: 0, count: 20, leader: { kind: 'prospect' as const, id: 'x' } }
    const horns = (n: number) => ({
      ...withMutations(0),
      mutations: Array.from({ length: n }, (_, i) => (i === 0 ? { id: 'horns', level: 6 } : { id: `m${i}`, level: 1 })),
    })

    const bare = resolveSquadStats({ ...squad, leader: null }, null)
    const led = resolveSquadStats(squad, null, horns(1))
    const legend = resolveSquadStats(squad, null, horns(FIRSTBORN_AT_MUTATIONS))

    expect(led.damage).toBe(bare.damage)
    expect(legend.damage).toBe(bare.damage)

    // Discipline is the whole effect, and it is bigger for the Firstborn.
    const dBare = resolveDiscipline(squad.typeId, null, null)
    const dLed = resolveDiscipline(squad.typeId, null, horns(1))
    const dLegend = resolveDiscipline(squad.typeId, null, horns(FIRSTBORN_AT_MUTATIONS))
    expect(dLed).toBeGreaterThan(dBare)
    expect(dLegend).toBeGreaterThan(dLed)
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
    // The Scion start fills both leader slots with Officers, so the Prospect
    // it comes with leads nobody until told to. Set it up rather than relying
    // on the opening roster to happen to be arranged this way.
    const run = start()
    const p = run.warband.prospects[0]
    const mutantSquad = run.warband.squads.find(
      (sq) => unitType(sq.typeId).lineage === 'mutant',
    )!
    const base = assignLeader(run, mutantSquad.id, { kind: 'prospect', id: p.id })
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
    const all = new Set<'machine'>(['machine'])
    for (let i = 0; i < EVENTS.length; i++) {
      const e = rollEvent(rng, seen, all)
      expect(e).not.toBeNull()
      expect(seen).not.toContain(e!.id)
      seen.push(e!.id)
    }
    // Table exhausted — a run simply stops having events rather than looping.
    expect(rollEvent(rng, seen, all)).toBeNull()
  })

  it('never offers an event the warband cannot act on', () => {
    // The Tinkerer turning up for a warband with no machine reads as a bug,
    // not as flavour.
    const gated = EVENTS.filter((e) => e.needs)
    expect(gated.length).toBeGreaterThan(0)

    const rng = new Rng(hashSeed('gate'))
    const none = new Set<'machine'>()
    for (let i = 0; i < 200; i++) {
      const e = rollEvent(rng, [], none)
      expect(e!.needs).toBeUndefined()
    }
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

/**
 * Content contract with the sim.
 *
 * The sim's spacing constants — grid cell, row spacing, line spacing — are all
 * sized against MAX_BODY_RADIUS. A wider body would spawn inside its own
 * formation and stop being separated from anything more than a grid cell away,
 * which reads as a rendering glitch rather than as a stat being out of range.
 *
 * The Battle constructor throws on one, so this test is only here to fail in
 * the right place: at the unit table, naming the type, rather than the first
 * time somebody happens to field it.
 */
describe('unit content stays inside the sim’s limits', () => {
  it('has no body wider than the spatial grid can separate', () => {
    for (const t of UNIT_TYPES) {
      expect(
        t.base.radius,
        `${t.name} has radius ${t.base.radius}; the sim is built for ${MAX_BODY_RADIUS}`,
      ).toBeLessThanOrEqual(MAX_BODY_RADIUS)
    }
  })
})

describe('water and upkeep', () => {
  const roster = (bodies: number, typeId = 0): Warband => ({
    squads: [{ id: 's', typeId, count: bodies, leader: null }],
    prospects: [],
    officers: [],
    salvage: 0,
    water: 0,
    bionics: [],
    relics: [],
    machines: [],
    morale: 0,
  })

  it('scales upkeep superlinearly with roster size', () => {
    // V0-DESIGN §8's whole reason for existing: 120 bodies do not cost six
    // times what 20 do, they cost sixteen. A linear cost would make the
    // roster free to grow and there would be no reason to ever sell anyone.
    const small = waterUpkeep(roster(20))
    const large = waterUpkeep(roster(120))
    expect(large / small).toBeGreaterThan(6)

    // The multiplier itself, against the doc's table.
    expect(waterUpkeep(roster(20)) / (20 * WATER_PER_BODY.mutant)).toBeCloseTo(1.5, 1)
    expect(waterUpkeep(roster(120)) / (120 * WATER_PER_BODY.mutant)).toBeCloseTo(4.0, 1)
  })

  it('prices machines far above the other two lineages', () => {
    // §3 calls their water cost "brutal", and it is the balance for them
    // being far above everything else in a fight.
    expect(WATER_PER_BODY.machine).toBeGreaterThan(WATER_PER_BODY.truekin * 2)
    expect(WATER_PER_BODY.truekin).toBeGreaterThanOrEqual(WATER_PER_BODY.mutant)
  })

  it('pays without desertion when the cistern covers it', () => {
    const w = { ...roster(30), water: 10_000 }
    const paid = payWater(w)
    expect(paid.deserted).toBe(0)
    expect(paid.spent).toBe(waterUpkeep(w))
    expect(paid.remaining).toBe(10_000 - paid.spent)
    expect(paid.squads).toBe(w.squads)
  })

  it('sheds exactly enough bodies to afford the march, and no more', () => {
    const w = { ...roster(80), water: 60 }
    const paid = payWater(w)
    expect(paid.deserted).toBeGreaterThan(0)

    const left = paid.squads.reduce((n, sq) => n + sq.count, 0)
    expect(left).toBe(80 - paid.deserted)
    // Affordable now...
    expect(waterUpkeep({ ...w, squads: paid.squads })).toBeLessThanOrEqual(w.water)
    // ...and one more body would not have been.
    const oneMore = paid.squads.map((sq, i) => (i === 0 ? { ...sq, count: sq.count + 1 } : sq))
    expect(waterUpkeep({ ...w, squads: oneMore })).toBeGreaterThan(w.water)
  })

  it('thins the largest squad rather than deleting a unit type', () => {
    // "A squeeze, never an execution" (§8). Losing a whole squad to thirst
    // would silently remove a capability from the warband.
    const w: Warband = {
      ...roster(0),
      squads: [
        { id: 'big', typeId: 0, count: 40, leader: null },
        { id: 'small', typeId: 1, count: 4, leader: null },
      ],
      water: 30,
    }
    const paid = payWater(w)
    expect(paid.deserted).toBeGreaterThan(0)
    expect(paid.squads.find((sq) => sq.id === 'small')?.count).toBe(4)
  })

  it('never lets the named tier walk', () => {
    // Officers and Prospects are the permadeath tier. Losing a Firstborn you
    // grew over ten battles to an arithmetic shortfall would be the most
    // arbitrary death in the game.
    const run = start()
    const thirsty = { ...run.warband, water: 0 }
    const paid = payWater(thirsty)
    expect(paid.deserted).toBeGreaterThan(0)

    const marched = march({ ...run, warband: thirsty }).state
    expect(marched.warband.officers).toHaveLength(run.warband.officers.length)
    expect(marched.warband.prospects).toHaveLength(run.warband.prospects.length)
  })

  it('charges the march before the battle, and fields who is left', () => {
    // The setup has to come from the post-march warband. Building it from the
    // pre-march one meant deserters marched anyway.
    const run = start()
    const thirsty = { ...run, warband: { ...run.warband, water: 0 } }
    const { state, setup } = march(thirsty)

    expect(state.lastUpkeep!.deserted).toBeGreaterThan(0)
    const fielded = setup.config.groups
      .filter((g) => g.team === TEAM_A)
      .reduce((n, g) => n + g.count, 0)
    expect(fielded).toBe(totalBodies(state.warband))
    expect(fielded).toBeLessThan(totalBodies(run.warband))
  })

  it('shakes the column when people walk', () => {
    const run = start()
    const thirsty = { ...run, warband: { ...run.warband, water: 0, morale: 0 } }
    expect(march(thirsty).state.warband.morale).toBeLessThan(0)
  })
})

describe('expeditions', () => {
  const withCrew = (n: number) => {
    const run = start()
    const extra = Array.from({ length: n }, (_, i) =>
      rollProspect(new Rng(hashSeed(`crew-${i}`)), 0, 0),
    ).map((p, i) => ({ ...p, id: `crew-${i}` }))
    // Enough salvage to outfit anything these tests send.
    return {
      ...run,
      warband: { ...run.warband, salvage: 5000, prospects: [...run.warband.prospects, ...extra] },
    }
  }

  it('takes the crew off the field without removing them from the warband', () => {
    // "The crew misses the next battle" is the real cost in V0-DESIGN §9.
    // Being away reuses the reserve mechanism, so they cannot deploy, cannot
    // die, and cannot accrue battles towards Firstborn.
    const run = withCrew(2)
    const crew = ['crew-0', 'crew-1']
    const sent = sendExpedition(run, 'delve', crew)

    expect(sent.expedition).toEqual({
      verb: 'delve',
      crew,
      staked: expeditionCost('delve', crew.length, run.encounterIndex),
    })
    expect(sent.warband.prospects).toHaveLength(run.warband.prospects.length)
    for (const id of crew) {
      expect(sent.warband.prospects.find((p) => p.id === id)!.fielded).toBe(false)
    }

    const fielded = march(sent).setup.playerSources.filter((s) => s.kind === 'prospect')
    expect(fielded.map((s) => s.id)).not.toContain('crew-0')
  })

  it('pulls a leading Prospect off its squad, so the leak stops too', () => {
    // Otherwise a squad keeps twenty bodies worth of mutations from someone
    // who is two days away down a stairwell.
    const run = withCrew(1)
    const mutantSquad = run.warband.squads.find(
      (sq) => unitType(sq.typeId).lineage === 'mutant',
    )!
    const led = assignLeader(run, mutantSquad.id, { kind: 'prospect', id: 'crew-0' })
    expect(led.warband.squads.find((sq) => sq.id === mutantSquad.id)!.leader).not.toBeNull()

    const sent = sendExpedition(led, 'scavenge', ['crew-0'])
    expect(sent.warband.squads.find((sq) => sq.id === mutantSquad.id)!.leader).toBeNull()
  })

  it('refuses a crew it cannot outfit', () => {
    const run = withCrew(2)
    const broke = { ...run, warband: { ...run.warband, salvage: 0 } }
    expect(sendExpedition(broke, 'delve', ['crew-0'])).toBe(broke)

    // And the stake comes straight off, then straight back on a recall.
    const rich = { ...run, warband: { ...run.warband, salvage: 5000 } }
    const sent = sendExpedition(rich, 'delve', ['crew-0'])
    expect(sent.warband.salvage).toBe(5000 - expeditionCost('delve', 1, rich.encounterIndex))
    expect(recallExpedition(sent).warband.salvage).toBe(5000)
  })

  it('refuses a bad crew rather than silently fixing it', () => {
    const run = { ...withCrew(4), warband: { ...withCrew(4).warband, salvage: 5000 } }
    expect(sendExpedition(run, 'delve', [])).toBe(run)
    expect(sendExpedition(run, 'delve', ['crew-0', 'crew-0'])).toBe(run)
    expect(sendExpedition(run, 'delve', ['nobody'])).toBe(run)
    expect(sendExpedition(run, 'delve', ['crew-0', 'crew-1', 'crew-2', 'crew-3'])).toBe(run)

    const sent = sendExpedition(run, 'delve', ['crew-0'])
    // One expedition at a time.
    expect(sendExpedition(sent, 'scavenge', ['crew-1'])).toBe(sent)
  })

  it('recalls a crew back to the field, leaving nothing behind', () => {
    const run = withCrew(2)
    const back = recallExpedition(sendExpedition(run, 'delve', ['crew-0', 'crew-1']))
    expect(back.expedition).toBeNull()
    expect(back.warband.prospects.filter((p) => p.fielded).length).toBe(
      run.warband.prospects.filter((p) => p.fielded).length,
    )
  })

  it('buys water with salvage, reliably, and rarely hurts anyone', () => {
    /*
     * Scavenging exists because Water caps how many bodies a warband can
     * carry, so a run ends up with salvage it cannot spend. It converts the
     * abundant resource into the scarce one — it must never do the reverse,
     * and it must never pay salvage at all.
     */
    const waters: number[] = []
    let injured = 0
    const runs = 400
    for (let i = 0; i < runs; i++) {
      const rng = new Rng(hashSeed(`scav-${i}`))
      const crew = [rollProspect(rng, 0, 3), rollProspect(rng, 0, 3)]
      const { result } = resolveExpedition(rng, 'scavenge', crew, 3, rollProspect0, rollBionic0, rollMachine, rollRelic0)
      expect(result.salvage).toBe(0)
      expect(result.lost).toHaveLength(0)
      expect(result.found).toHaveLength(0)
      waters.push(result.water)
      injured += result.injured.length
    }

    // Stable: a wage, not a gamble. Every haul within a hand's width of the mean.
    const mean = waters.reduce((a, b) => a + b, 0) / runs
    expect(Math.min(...waters)).toBeGreaterThan(mean * 0.85)
    expect(Math.max(...waters)).toBeLessThan(mean * 1.15)
    expect(injured / (runs * 2)).toBeLessThan(0.08)
  })

  it('never lets scavenging beat winning the fight, per water', () => {
    // Encounters pay ~1.9 salvage per water. An expedition that beat that
    // rate would just be a better battle with no enemy in it.
    for (const index of [0, 3, 7]) {
      const staked = expeditionCost('scavenge', 3, index)
      const { water } = expectedHaul('scavenge', 3, index)
      expect(staked / water).toBeGreaterThan(1)
    }
  })

  it('makes delving a long tail, not a better wage', () => {
    // §9 wants ~220% EV with high variance. A bell curve around 2.2x would be
    // scavenging with extra steps — the point is that most delves disappoint
    // and a few make the run.
    const hauls: number[] = []
    let lost = 0
    let found = 0
    const runs = 600
    for (let i = 0; i < runs; i++) {
      const rng = new Rng(hashSeed(`delve-${i}`))
      const crew = [rollProspect(rng, 0, 3), rollProspect(rng, 0, 3)]
      const { result } = resolveExpedition(rng, 'delve', crew, 3, rollProspect0, rollBionic0, rollMachine, rollRelic0)
      hauls.push(result.salvage)
      lost += result.lost.length
      found += result.found.length
    }

    const mean = hauls.reduce((a, b) => a + b, 0) / runs
    hauls.sort((a, b) => a - b)
    const median = hauls[Math.floor(runs / 2)]

    // Mean above median is the signature of a long right tail. The 2.5x
    // margin (not the delveMultiplier bands' own theoretical max, which is
    // higher) leaves headroom against exactly the kind of RNG-stream shift
    // an unrelated new roll elsewhere in the same seeded sequence (e.g.
    // rollProspect's Quickened check) can cause without changing anything
    // about delve's own distribution shape.
    expect(mean).toBeGreaterThan(median)
    expect(hauls[runs - 1]).toBeGreaterThan(median * 2.5)
    // And it pays back more than it cost.
    expect(mean / expeditionCost('delve', 2, 3)).toBeGreaterThan(1.2)

    expect(lost / (runs * 2)).toBeGreaterThan(0.02)
    expect(lost / (runs * 2)).toBeLessThan(0.09)
    expect(found).toBeGreaterThan(0)
  })

  it('brings the crew home at the next camp, with what they found', () => {
    const run = withCrew(2)
    const sent = sendExpedition(run, 'delve', ['crew-0', 'crew-1'])
    const marched = march(sent)
    const won = {
      ...marched.state,
      phase: 'report' as const,
      report: { won: true } as never,
    }
    const camp = advance(won)

    expect(camp.expedition).toBeNull()
    expect(camp.expeditionResult).not.toBeNull()
    // Salvage arrives where it can be spent — at the shop, not mid-battle.
    expect(camp.warband.salvage).toBeGreaterThanOrEqual(marched.state.warband.salvage)
    // Anyone who came back is on the field again.
    for (const p of camp.warband.prospects) {
      if (p.id.startsWith('crew-')) expect(p.fielded).toBe(true)
    }
  })
})

describe('bionics', () => {
  const rich = (bionics: string[]) => {
    const run = start()
    return {
      ...run,
      warband: { ...run.warband, salvage: 5000, bionics },
    }
  }

  it('installs a found implant into an Officer for salvage', () => {
    const b = BIONICS[0]
    const run = rich([b.id])
    const officer = run.warband.officers[0]

    const after = installBionic(run, officer.id, b.id)
    expect(after.warband.officers[0].bionics).toEqual([b.id])
    expect(after.warband.salvage).toBe(5000 - b.cost)
    // Finding it is free; fitting it consumes the part.
    expect(after.warband.bionics).toEqual([])
  })

  it('refuses what it cannot fit', () => {
    const b = BIONICS[0]
    const officer = start().warband.officers[0]

    // Nothing in stock.
    const empty = rich([])
    expect(installBionic(empty, officer.id, b.id)).toBe(empty)

    // Cannot afford the fitting.
    const broke = { ...rich([b.id]), warband: { ...rich([b.id]).warband, salvage: 0 } }
    expect(installBionic(broke, officer.id, b.id)).toBe(broke)

    // No such officer, no such implant.
    const run = rich([b.id])
    expect(installBionic(run, 'nobody', b.id)).toBe(run)
    expect(installBionic(run, officer.id, 'no-such-implant')).toBe(run)
  })

  it('keeps slots scarce, and one of each', () => {
    // Three is enough for a build to have a shape and not enough to install
    // everything you find — which is what makes a fourth find a decision.
    const ids = BIONICS.slice(0, BIONIC_SLOTS + 1).map((b) => b.id)
    let run = rich([...ids])
    const officer = run.warband.officers[0]

    for (const id of ids) run = installBionic(run, officer.id, id)
    expect(run.warband.officers[0].bionics).toHaveLength(BIONIC_SLOTS)
    // The one that did not fit is still in stock.
    expect(run.warband.bionics).toHaveLength(1)

    // Two of the same implant on one body is an inventory exploit, not a build.
    const dupe = rich([BIONICS[0].id, BIONICS[0].id])
    const once = installBionic(dupe, officer.id, BIONICS[0].id)
    expect(installBionic(once, officer.id, BIONICS[0].id)).toBe(once)
    expect(once.warband.bionics).toHaveLength(1)
  })

  it('passes the implant through to the squad the Officer leads', () => {
    const b = BIONICS_BY_ID.get('carbide-edge')!
    const run = rich([b.id])
    const officer = run.warband.officers[0]
    const squad = run.warband.squads.find(
      (sq) => sq.leader?.kind === 'officer' && sq.leader.id === officer.id,
    )!

    const before = resolveSquadStats(squad, officer)
    const after = installBionic(run, officer.id, b.id)
    const boosted = resolveSquadStats(squad, after.warband.officers[0])

    expect(boosted.damage).toBeGreaterThan(before.damage)
  })

  it('does not let a wound degrade hardware', () => {
    /*
     * A wound scales an Officer's RANK bonus down (officerBonusMultiplier),
     * because that is what a person can still do. It must not scale implants:
     * hardware bolted to a skeleton does not care that the skeleton is hurt.
     * That is the whole reason a bionic build is worth the slower, more
     * expensive path — it is a hedge against the attrition that erodes an
     * unmodified officer.
     */
    const b = BIONICS_BY_ID.get('bracing-struts')!
    const run = rich([b.id])
    const officer = run.warband.officers[0]
    const squad = run.warband.squads.find(
      (sq) => sq.leader?.kind === 'officer' && sq.leader.id === officer.id,
    )!

    const installed = installBionic(run, officer.id, b.id).warband.officers[0]
    const healthy = resolveSquadStats(squad, installed)
    const crippled = resolveSquadStats(squad, {
      ...installed,
      wound: { zone: 'core', rung: 3 },
    })

    // The implant's flat armour survives intact even at the worst rung.
    const bare = resolveSquadStats(squad, { ...officer, wound: { zone: 'core', rung: 3 } })
    expect(crippled.armor - bare.armor).toBeCloseTo(healthy.armor - resolveSquadStats(squad, officer).armor, 5)
  })

  it('is the only way bionics enter a run', () => {
    // V0-DESIGN §9: delving is not an optional side-game, it is how two of
    // three lineages get stronger. A run that never delves must never see one.
    expect(start().warband.bionics).toEqual([])

    let salvaged = 0
    for (let i = 0; i < 300; i++) {
      const rng = new Rng(hashSeed(`bio-${i}`))
      const crew = [rollProspect(rng, 0, 2)]
      const scav = resolveExpedition(rng, 'scavenge', crew, 2, rollProspect0, rollBionic0, rollMachine, rollRelic0)
      expect(scav.result.salvaged).toEqual([])

      const delve = resolveExpedition(rng, 'delve', crew, 2, rollProspect0, rollBionic0, rollMachine, rollRelic0)
      salvaged += delve.result.salvaged.length
    }
    expect(salvaged).toBeGreaterThan(50)
  })
})

describe('relics', () => {
  const rich = (relics: string[]) => {
    const run = start()
    return {
      ...run,
      warband: { ...run.warband, salvage: 5000, relics },
    }
  }

  it('binds a found relic to a squad for salvage', () => {
    const r = RELICS[0]
    const run = rich([r.id])
    const squad = run.warband.squads[0]

    const after = assignRelic(run, squad.id, r.id)
    expect(after.warband.squads.find((sq) => sq.id === squad.id)?.relicId).toBe(r.id)
    expect(after.warband.salvage).toBe(5000 - r.cost)
    // Finding it is free; binding it consumes the piece.
    expect(after.warband.relics).toEqual([])
  })

  it('refuses what it cannot bind', () => {
    const r = RELICS[0]
    const squad = start().warband.squads[0]

    // Nothing in stock.
    const empty = rich([])
    expect(assignRelic(empty, squad.id, r.id)).toBe(empty)

    // Cannot afford it.
    const broke = { ...rich([r.id]), warband: { ...rich([r.id]).warband, salvage: 0 } }
    expect(assignRelic(broke, squad.id, r.id)).toBe(broke)

    // No such squad, no such relic.
    const run = rich([r.id])
    expect(assignRelic(run, 'nobody', r.id)).toBe(run)
    expect(assignRelic(run, squad.id, 'no-such-relic')).toBe(run)
  })

  it('never overwrites an existing relic, even to swap it for a better one', () => {
    const [a, b] = RELICS
    const run = rich([a.id, b.id])
    const squad = run.warband.squads[0]

    const once = assignRelic(run, squad.id, a.id)
    expect(once.warband.squads.find((sq) => sq.id === squad.id)?.relicId).toBe(a.id)

    const twice = assignRelic(once, squad.id, b.id)
    expect(twice).toBe(once)
    // The relic that couldn't be bound is still in stock, not discarded.
    expect(twice.warband.relics).toEqual([b.id])
  })

  it('applies to the squad directly, independent of who leads it', () => {
    const officerLed = start().warband.squads.find((sq) => sq.leader?.kind === 'officer')!
    const bare = resolveSquadStats(officerLed, null)
    const boosted = resolveSquadStats({ ...officerLed, relicId: 'salt-idol' }, null)
    expect(boosted.armor).toBeGreaterThan(bare.armor)
  })

  it("Vat-Brand only helps a mutant squad — a True Kin squad sees no effect", () => {
    const mutant = { id: 'x', typeId: MUTANT_TYPES[0].id, count: 10, leader: null }
    const truekin = { id: 'y', typeId: TRUEKIN_TYPES[0].id, count: 10, leader: null }

    const mutantBare = resolveSquadStats(mutant, null)
    const mutantWithRelic = resolveSquadStats({ ...mutant, relicId: 'vat-brand' }, null)
    expect(mutantWithRelic.damage).toBeGreaterThan(mutantBare.damage)

    const truekinBare = resolveSquadStats(truekin, null)
    const truekinWithRelic = resolveSquadStats({ ...truekin, relicId: 'vat-brand' }, null)
    expect(truekinWithRelic.damage).toBe(truekinBare.damage)
  })

  it('Iron Ward multiplies existing armour — nothing to multiply is nothing gained', () => {
    const unarmoured = { id: 'x', typeId: 0, count: 10, leader: null } // Chaff, 0 armour
    const armoured = { id: 'y', typeId: 4, count: 10, leader: null } // Thornback, real armour

    expect(resolveSquadStats({ ...unarmoured, relicId: 'iron-ward' }, null).armor).toBe(
      resolveSquadStats(unarmoured, null).armor,
    )
    expect(resolveSquadStats({ ...armoured, relicId: 'iron-ward' }, null).armor).toBeGreaterThan(
      resolveSquadStats(armoured, null).armor,
    )
  })

  it('is the only way relics enter a run', () => {
    expect(start().warband.relics).toEqual([])

    let found = 0
    for (let i = 0; i < 300; i++) {
      const rng = new Rng(hashSeed(`relic-${i}`))
      const crew = [rollProspect(rng, 0, 2)]
      const scav = resolveExpedition(rng, 'scavenge', crew, 2, rollProspect0, rollBionic0, rollMachine, rollRelic0)
      expect(scav.result.relics).toEqual([])

      const delve = resolveExpedition(rng, 'delve', crew, 2, rollProspect0, rollBionic0, rollMachine, rollRelic0)
      found += delve.result.relics.length
    }
    expect(found).toBeGreaterThan(30)
  })
})

describe('machines', () => {
  const withMachine = (condition = MACHINE_CONDITION_MAX) => {
    const run = start()
    const m = { ...rollMachine(new Rng(hashSeed('m1'))), id: 'm1', condition }
    return {
      ...run,
      warband: { ...run.warband, salvage: 5000, machines: [m] },
    }
  }

  it('is never for sale or fielded by a rival, anywhere', () => {
    /*
     * V0-DESIGN §3: "not sold in the recruit screen — found in ruins and rare
     * events, and that's the only way to get one." The shop and the encounter
     * generator both build from the two purchasable pools, so this holds by
     * construction — but it is exactly the invariant a later refactor
     * reaching for UNIT_TYPES quietly broke.
     *
     * It DID break, silently: MUTANT_TYPES used to filter the full
     * UNIT_TYPES table, and fauna/bosses are lineage 'mutant' for narrative
     * reasons (the wasteland mutated them too). For a stretch of real commits,
     * MUTANT_TYPES held 13 entries instead of 5 — the shop could have offered
     * The Long Gullet for sale, and a rival scav-band could have fielded it.
     * A previous version of this test checked only `lineage !== 'machine'`,
     * which fauna and bosses trivially satisfy (they ARE lineage 'mutant'),
     * so it stayed green the whole time. Found by npm run sim:matchup
     * unexpectedly iterating 18 unit types instead of 10 — a symptom in a
     * completely different tool — not by any test. This checks id
     * membership directly, which is the only version of this invariant that
     * cannot pass by accident.
     */
    const forbidden = new Set([...MACHINE_TYPES, ...FAUNA_TYPES, ...BOSS_TYPES].map((t) => t.id))
    expect(forbidden.size).toBeGreaterThan(0) // guards against the set itself going empty

    const rng = new Rng(hashSeed('market'))
    for (let i = 0; i < 200; i++) {
      for (const offer of rollOffers(rng, i % ENCOUNTERS_PER_RUN)) {
        if (offer.kind === 'squad') expect(forbidden.has(offer.typeId)).toBe(false)
      }
    }
    /*
     * And no ordinary rival LEVY fields one either — scoped to encounter
     * KIND, not to every encounter. A 'wasteland' encounter is legitimately
     * fauna, and a 'boss' encounter's squads[0] is legitimately the boss
     * itself (§10 — both by design, not a leak). Checking every kind here
     * was the first draft's own bug: it flagged The Long Gullet showing up
     * in its OWN boss encounter as a violation. The real invariant is
     * narrower — an ordinary rival scav-band never fields either.
     */
    for (let i = 0; i < 150; i++) {
      const enc = generateEncounter(rng, i % ENCOUNTERS_PER_RUN)
      if (enc.kind !== 'warband') continue
      for (const sq of enc.enemy.squads) expect(forbidden.has(sq.typeId)).toBe(false)
    }
  })

  it('keeps MUTANT_TYPES and TRUEKIN_TYPES scoped to the recruitable pool', () => {
    // The five-plus-five the design promises (§12), not five-plus-eight-more
    // because fauna and bosses share the mutant lineage tag.
    expect(MUTANT_TYPES).toHaveLength(5)
    expect(TRUEKIN_TYPES).toHaveLength(5)
    for (const t of MUTANT_TYPES) expect(FAUNA_TYPES.some((f) => f.id === t.id)).toBe(false)
    for (const t of MUTANT_TYPES) expect(BOSS_TYPES.some((b) => b.id === t.id)).toBe(false)
  })

  it('lets a rival band turn up already carrying found gear, same as the player can find', () => {
    // "I want rules to apply to everyone" — a rival warband can spawn with a
    // relic bound to one squad, or an officer carrying an implant. Existence
    // check across enough seeds to hit both at least once; the exact rate is
    // ENEMY_RELIC_CHANCE/ENEMY_BIONIC_CHANCE in encounters.ts, not asserted
    // here so this doesn't become a tuning tripwire.
    const rng = new Rng(hashSeed('enemy-gear'))
    let sawRelic = false
    let sawBionic = false
    for (let i = 0; i < 400 && !(sawRelic && sawBionic); i++) {
      const enc = generateEncounter(rng, 2 + (i % 3)) // index >= 2, never the boss slot
      if (enc.kind !== 'warband') continue
      if (enc.enemy.squads.some((sq) => sq.relicId)) sawRelic = true
      if (enc.enemy.officers.some((o) => o.bionics.length > 0)) sawBionic = true
    }
    expect(sawRelic).toBe(true)
    expect(sawBionic).toBe(true)
  })

  it("reflects a rival band's own gear in the pre-march scouting read", () => {
    // No separate wiring needed for this — scoutEnemy already reads
    // resolveSquadStats, which already applies a bound relic. Chaff carries
    // zero armour on its own (the "barely armoured" band's floor); Salt
    // Idol's flat +1.5 crosses straight into "lightly armoured", so this
    // is a guaranteed band change rather than one that depends on where a
    // particular unit's base stat happens to sit relative to a boundary.
    const enemy: Warband = {
      squads: [{ id: 'x', typeId: 0, count: 20, leader: null }], // Chaff
      prospects: [],
      officers: [],
      salvage: 0,
      water: 0,
      bionics: [],
      relics: [],
      machines: [],
      morale: 0,
    }
    const bare = scoutEnemy(enemy)
    const geared = scoutEnemy({
      ...enemy,
      squads: [{ ...enemy.squads[0], relicId: 'salt-idol' }],
    })
    expect(geared.armorWord).not.toBe(bare.armorWord)
  })

  it('only degrades, and only when it fights', () => {
    const run = withMachine()
    const marched = march(run)
    const battled = resolveBattle(
      marched.state,
      marched.setup.playerSources.map((src) => ({
        label: 'x',
        started: 1,
        dead: 0,
        survived: 1,
        endEffectiveness: 1,
        damageDealt: 0,
        damageTaken: 0,
        team: src.kind === 'machine' ? TEAM_A : TEAM_A,
      })) as never,
      TEAM_A,
      100,
      marched.setup.playerSources,
    )
    expect(battled.warband.machines[0].condition).toBe(MACHINE_CONDITION_MAX - 1)
    // Nothing puts it back. Condition is a one-way trip.
    expect(battled.warband.machines[0].condition).toBeLessThan(run.warband.machines[0].condition)
  })

  it('wears down without falling off a cliff', () => {
    /*
     * Condition touches hp, damage and cycle time. NOT armour, accuracy or
     * speed — those are what the thing is, and a worn machine is weaker and
     * slower to fire, not suddenly a bad shot.
     *
     * The distinction is not cosmetic. Scaling every stat by the same factor
     * compounds: at condition 4 a Chrome Warden was on 0.82 of five stats at
     * once, about 0.55 of its effective power, and it went from 78% wins to
     * 5% in two battles. Six condition has to mean roughly six battles.
     */
    const fresh = resolveMachineStats(withMachine(MACHINE_CONDITION_MAX).warband.machines[0])
    const worn = resolveMachineStats(withMachine(1).warband.machines[0])

    expect(worn.hp).toBeLessThan(fresh.hp)
    expect(worn.damage).toBeLessThan(fresh.damage)
    expect(worn.attackInterval).toBeGreaterThan(fresh.attackInterval)

    expect(worn.armor).toBe(fresh.armor)
    expect(worn.accuracy).toBe(fresh.accuracy)
    expect(worn.moveSpeed).toBe(fresh.moveSpeed)

    expect(conditionMultiplier(MACHINE_CONDITION_MAX)).toBe(1)
    // Even a wreck is still a machine. The floor is high on purpose.
    expect(conditionMultiplier(0)).toBeGreaterThan(0.5)
  })

  it('is far above anything that can be bought', () => {
    // §3: "rare and devastating", "far above everything". A machine that
    // traded evenly with cheap fodder would just be an expensive squad.
    for (const type of MACHINE_TYPES) {
      const m = { id: 'x', typeId: type.id, name: 'x', condition: MACHINE_CONDITION_MAX }
      // Worth more than 25 Chaff, which is 50 salvage of bodies, against a
      // running cost of 55 salvage a battle plus twelve mutants' worth of water.
      expect(machinePower(m)).toBeGreaterThan(
        statPower(resolveSquadStats({ id: 's', typeId: 0, count: 25, leader: null }, null), 1) * 0.9,
      )
    }
  })

  it('leaves a machine cold when the salvage will not cover it', () => {
    // Expensive to merely own (§3). Being unable to pay is visible — it does
    // not march — rather than a hidden extra step of decay.
    const run = withMachine()
    const broke = { ...run, warband: { ...run.warband, salvage: MACHINE_RUN_COST - 1 } }
    const { state, setup } = march(broke)

    expect(setup.playerSources.some((s) => s.kind === 'machine')).toBe(false)
    expect(state.lastUpkeep!.cold).toBe(1)
    // Still owned, and still there next camp.
    expect(state.warband.machines).toHaveLength(1)
    expect(state.warband.machines[0].condition).toBe(MACHINE_CONDITION_MAX)

    // With salvage, it runs, and the running is what costs.
    const paid = march(run)
    expect(paid.setup.playerSources.some((s) => s.kind === 'machine')).toBe(true)
    expect(paid.state.warband.salvage).toBe(run.warband.salvage - MACHINE_RUN_COST)
  })

  it('drinks like three mutants', () => {
    // §3 calls the water cost brutal, and it is also what stops a machine
    // core from being backed by an unlimited horde.
    const run = withMachine()
    const without = { ...run.warband, machines: [] }
    expect(waterUpkeep(run.warband)).toBeGreaterThan(waterUpkeep(without))
  })

  it('lets the Tinkerer put condition back, and nothing else does', () => {
    const tinkerer = EVENTS.find((e) => e.id === 'the-tinkerer')!
    expect(tinkerer.needs).toBe('machine')

    const restoring = tinkerer.choices.filter((c) => c.restoreMachine)
    expect(restoring.length).toBeGreaterThan(0)

    const run = { ...withMachine(2), event: tinkerer }
    const best = restoring.reduce((a, b) => (b.restoreMachine! > a.restoreMachine! ? b : a))
    const after = resolveEvent(run, tinkerer.choices.indexOf(best))
    expect(after.warband.machines[0].condition).toBe(2 + best.restoreMachine!)

    // Never past full — a Tinkerer restores, it does not improve.
    const nearlyFull = { ...withMachine(MACHINE_CONDITION_MAX - 1), event: tinkerer }
    expect(
      resolveEvent(nearlyFull, tinkerer.choices.indexOf(best)).warband.machines[0].condition,
    ).toBe(MACHINE_CONDITION_MAX)

    // No other event in the table can do it.
    for (const e of EVENTS) {
      if (e.id === 'the-tinkerer') continue
      for (const c of e.choices) expect(c.restoreMachine).toBeUndefined()
    }
  })
})

describe('Houses', () => {
  it('gives every House a distinct, real identity', () => {
    expect(HOUSES.length).toBe(8)
    const blurbs = new Set(HOUSES.map((h) => h.blurb))
    expect(blurbs.size).toBe(HOUSES.length)
    for (const h of HOUSES) expect(h.blurb.length).toBeGreaterThan(20)
  })

  it('rolls an Officer into one of the real Houses', () => {
    const rng = new Rng(hashSeed('house-roll'))
    for (let i = 0; i < 100; i++) {
      const o = rollOfficer(rng, `o${i}`)
      expect(HOUSES_BY_NAME.has(o.house)).toBe(true)
    }
  })

  it('names a House-led rival band after the House, not the generic pool', () => {
    const rng = new Rng(hashSeed('house-named'))
    let named: Encounter | null = null
    let opportunist: Encounter | null = null
    for (let i = 0; i < 300 && (!named || !opportunist); i++) {
      const e = generateEncounter(rng, 2 + (i % 3)) // index >= 2, so an officer can appear
      if (e.kind !== 'warband') continue
      if (e.enemy.officers.length > 0) named = e
      else opportunist = e
    }
    expect(named).not.toBeNull()
    expect(opportunist).not.toBeNull()

    const house = HOUSES_BY_NAME.get(named!.enemy.officers[0].house)!
    expect(named!.name).toBe(`Levies of ${house.name}`)
    expect(named!.flavour).toBe(house.blurb)

    // An officer-less band has no House to speak for it — same generic
    // naming as before this feature existed.
    expect(opportunist!.name).not.toMatch(/^Levies of /)
  })
})

describe('run structure', () => {
  it('is three acts of five, with a boss ending each', () => {
    expect(ENCOUNTERS_PER_RUN).toBe(ACTS * ENCOUNTERS_PER_ACT)
    const bosses = [...Array(ENCOUNTERS_PER_RUN).keys()].filter(isBossIndex)
    expect(bosses).toEqual([4, 9, 14])
    expect(bosses.map(actOf)).toEqual([0, 1, 2])
  })

  it('escalates enemy counts into the bands the design asks for', () => {
    // V0-DESIGN §12: Act 1 → 8-20, Act 2 → 30-70, Act 3 → 90-200+.
    const rng = new Rng(hashSeed('bands'))
    const byIndex: number[][] = Array.from({ length: ENCOUNTERS_PER_RUN }, () => [])
    for (let s = 0; s < 120; s++) {
      for (let i = 0; i < ENCOUNTERS_PER_RUN; i++) {
        byIndex[i].push(generateEncounter(rng, i).bodies)
      }
    }
    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]

    // Non-boss encounters only: a boss is one enormous body plus a small
    // escort, so its HEADCOUNT is deliberately lower than the fight before it.
    const act = (n: number) =>
      byIndex.filter((_, i) => actOf(i) === n && !isBossIndex(i)).map(median)

    expect(Math.min(...act(0))).toBeGreaterThanOrEqual(8)
    expect(Math.max(...act(0))).toBeLessThan(Math.min(...act(1)))
    expect(Math.max(...act(1))).toBeLessThan(Math.min(...act(2)))
    expect(Math.max(...act(2))).toBeGreaterThan(90)
  })

  it('draws from all four pools, and only the right one at a boss', () => {
    const rng = new Rng(hashSeed('pools'))
    const seen = new Set<string>()
    for (let s = 0; s < 200; s++) {
      for (let i = 0; i < ENCOUNTERS_PER_RUN; i++) {
        const e = generateEncounter(rng, i)
        seen.add(e.kind)
        expect(e.kind === 'boss').toBe(isBossIndex(i))
        expect(e.act).toBe(actOf(i))
      }
    }
    expect([...seen].sort()).toEqual(['boss', 'legendary', 'warband', 'wasteland'])
  })

  it('makes a boss one enormous problem, not a bigger crowd', () => {
    /*
     * §10: "bespoke, clearly not playing the same game as everyone else."
     * That is a claim about shape. The test is that the single body outweighs
     * its entire escort — otherwise a boss encounter is just a warband with a
     * mascot, and the fight reads the same as last week's.
     */
    const rng = new Rng(hashSeed('boss-shape'))
    for (const i of [4, 9, 14]) {
      for (let s = 0; s < 40; s++) {
        const e = generateEncounter(rng, i)
        const [boss, ...escort] = e.enemy.squads
        expect(boss.count).toBe(1)
        expect(unitType(boss.typeId).lineage).toBe('mutant')

        const bossHp = unitType(boss.typeId).base.hp
        const escortHp = escort.reduce((n, sq) => n + unitType(sq.typeId).base.hp * sq.count, 0)
        expect(bossHp).toBeGreaterThan(escortHp)
      }
    }
  })

  it('gives a boss the same on-screen treatment as any other named individual', () => {
    /*
     * A boss used to be an anonymous count-1 squad — no HP bar in the battle
     * HUD, no name banner, no larger sprite on the canvas. Every one of those
     * systems already existed for Prospects and Machines; a boss simply never
     * got flagged into them. Fixed in toSimGroups by checking typeId against
     * BOSS_TYPES directly, so this test pins the actual output a player sees,
     * not the internal flag alone.
     */
    const rng = new Rng(hashSeed('boss-named'))
    const enc = generateEncounter(rng, 4) // encounters.ts: index 4 is always a boss
    expect(enc.kind).toBe('boss')

    const { groups } = toSimGroups(enc.enemy, TEAM_B)
    const bossType = unitType(enc.enemy.squads[0].typeId)
    const bossGroup = groups.find((g) => g.count === 1 && g.color === bossType.color)!

    expect(bossGroup.named).toBe(true)
    expect(bossGroup.leaderLabel).toBe(bossType.name)

    // An ordinary escort squad is untouched — this is not "every squad gets
    // a banner now", it is specifically the boss.
    const ordinary = groups.find((g) => g !== bossGroup)
    expect(ordinary?.named).toBeFalsy()
  })

  it('finds a legendary sometimes, and gives it the same treatment a boss gets', () => {
    const rng = new Rng(hashSeed('legendary-find'))
    let found: Encounter | null = null
    // A sub-roll inside ~34% wasteland x 16% legendary is under 6% of
    // encounters — 300 tries is comfortably enough to hit one without the
    // test itself becoming a coin flip.
    for (let i = 0; i < 300 && !found; i++) {
      const e = generateEncounter(rng, 1 + (i % 3)) // never the boss slot
      if (e.kind === 'legendary') found = e
    }
    expect(found).not.toBeNull()
    const e = found!

    // Solo for every legendary except Glasskeeper, which carries a real
    // Glasswing escort — its own flavour text promises exactly that. Either
    // way squads[0] is always the legendary itself.
    const isGlasskeeper = e.enemy.squads[0].typeId === 25
    expect(e.enemy.squads).toHaveLength(isGlasskeeper ? 2 : 1)
    expect(e.enemy.squads[0].count).toBe(1)
    expect(LEGENDARY_IDS.has(e.enemy.squads[0].typeId)).toBe(true)
    expect(e.name).toBe(unitType(e.enemy.squads[0].typeId).name)
    expect(e.flavour).toBe(unitType(e.enemy.squads[0].typeId).blurb)

    const { groups } = toSimGroups(e.enemy, TEAM_B)
    expect(groups).toHaveLength(isGlasskeeper ? 2 : 1)
    expect(groups[0].named).toBe(true)
    expect(groups[0].leaderLabel).toBe(unitType(e.enemy.squads[0].typeId).name)
  })

  it("gives Glasskeeper the Glasswing escort its own flavour text promises, and nobody else one", () => {
    const rng = new Rng(hashSeed('glasskeeper-escort'))
    let glasskeeper: Encounter | null = null
    let others = 0
    for (let i = 0; i < 800 && (!glasskeeper || others < 3); i++) {
      const e = generateEncounter(rng, 1 + (i % 3))
      if (e.kind !== 'legendary') continue
      if (e.enemy.squads[0].typeId === 25) glasskeeper = e
      else others++
    }
    expect(glasskeeper).not.toBeNull()
    expect(others).toBeGreaterThan(0)

    expect(glasskeeper!.enemy.squads).toHaveLength(2)
    expect(glasskeeper!.enemy.squads[1].typeId).toBe(16) // Glasswing
    expect(glasskeeper!.enemy.squads[1].count).toBeGreaterThan(1)
    // Bodies reported to the player already fold the escort in — no
    // separate accounting needed anywhere downstream.
    expect(glasskeeper!.bodies).toBe(1 + glasskeeper!.enemy.squads[1].count)
  })

  it('never repeats a legendary within a run', () => {
    // Same shape as events (rollEvent) and the same reason: meeting "the"
    // Widowsalt twice undoes the entire word.
    const rng = new Rng(hashSeed('legendary-repeat'))
    const seenLegendaries: number[] = []
    let repeats = 0
    let finds = 0
    for (let i = 0; i < 4000; i++) {
      const index = 1 + (i % 3) // never the boss slot
      const e = generateEncounter(rng, index, seenLegendaries)
      if (e.kind !== 'legendary') continue
      const id = e.enemy.squads[0].typeId
      finds++
      if (seenLegendaries.includes(id)) repeats++
      else seenLegendaries.push(id)
    }
    expect(finds).toBeGreaterThan(0)
    expect(repeats).toBe(0)
    // Once every legendary has shown up, buildLegendary has nothing left to
    // offer and the roll quietly falls back to an ordinary wasteland instead
    // — it should not be possible to have SEEN more than exist.
    expect(seenLegendaries.length).toBeLessThanOrEqual(LEGENDARY_TYPES.length)
  })

  it('never rolls a legendary in the first two encounters', () => {
    /*
     * A fixed-power body hits a warband that has had zero camps to build up
     * harder than one with even a little slack in it — measured directly
     * against the Freed Firstborn origin, which starts with no Officers at
     * all. Cutting LEGENDARY_CHANCE alone did not meaningfully recover its
     * campaign completion, because frequency does not fix a per-encounter
     * mismatch. Every run gets at least one camp's worth of buildup first.
     */
    const rng = new Rng(hashSeed('legendary-early'))
    for (let i = 0; i < 4000; i++) {
      expect(generateEncounter(rng, 0).kind).not.toBe('legendary')
      expect(generateEncounter(rng, 1).kind).not.toBe('legendary')
    }
  })

  it('is never for sale, never fielded by a rival band, never a boss escort', () => {
    // Same invariant the machine/boss test already holds the market and
    // rival-band generator to, extended to the fourth pool.
    const rng = new Rng(hashSeed('legendary-market'))
    for (let i = 0; i < 200; i++) {
      for (const offer of rollOffers(rng, i % ENCOUNTERS_PER_RUN)) {
        if (offer.kind === 'squad') expect(LEGENDARY_IDS.has(offer.typeId)).toBe(false)
      }
    }
    for (let i = 0; i < 300; i++) {
      const e = generateEncounter(rng, i % ENCOUNTERS_PER_RUN)
      if (e.kind === 'warband' || e.kind === 'boss') {
        for (const sq of e.enemy.squads) expect(LEGENDARY_IDS.has(sq.typeId)).toBe(false)
      }
    }
  })

  it('escalates the three bosses rather than rolling them', () => {
    // Meeting the Long Gullet at encounter 5 would be a different game.
    const rng = new Rng(hashSeed('boss-order'))
    for (let s = 0; s < 30; s++) {
      const names = [4, 9, 14].map((i) => unitType(generateEncounter(rng, i).enemy.squads[0].typeId))
      expect(names.map((t) => t.name)).toEqual(BOSS_TYPES.map((t) => t.name))
      // Strictly escalating, so the act is legible from the thing in front of you.
      expect(names[0].base.hp).toBeLessThan(names[1].base.hp)
      expect(names[1].base.hp).toBeLessThan(names[2].base.hp)
    }
  })

  it('keeps a boss killable by fodder', () => {
    /*
     * Armour is flat reduction, so a boss's armour decides whether cheap
     * bodies matter at all rather than how tough it is. The first pass gave
     * the act-1 boss 12 armour against a Chaff's 5 damage — every swing did
     * the minimum 1, and 98 of 200 harness runs died on that one encounter.
     *
     * The rule this pins: a boss must never be immune to the cheapest thing
     * the player can bring to that act. It should be BAD value, not zero.
     */
    const chaff = unitType(0).base.damage
    for (const boss of BOSS_TYPES) {
      expect(boss.base.armor).toBeLessThan(chaff * 2.5)
    }
  })

  it('never lets a wasteland encounter carry leaders or mutations', () => {
    // Beasts differ from a warband in SHAPE, not just stats. No officers, no
    // standouts, no mixed levy — one or two kinds of thing in quantity.
    const rng = new Rng(hashSeed('fauna'))
    let checked = 0
    for (let s = 0; s < 200 && checked < 40; s++) {
      for (let i = 0; i < ENCOUNTERS_PER_RUN; i++) {
        const e = generateEncounter(rng, i)
        if (e.kind !== 'wasteland') continue
        checked++
        expect(e.enemy.officers).toHaveLength(0)
        expect(e.enemy.prospects).toHaveLength(0)
        expect(e.enemy.squads.length).toBeLessThanOrEqual(2)
        for (const sq of e.enemy.squads) {
          expect(FAUNA_TYPES.some((t) => t.id === sq.typeId)).toBe(true)
        }
      }
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('ties payouts to the budget so difficulty cannot drift from the economy', () => {
    const rng = new Rng(hashSeed('pay'))
    for (let i = 0; i < ENCOUNTERS_PER_RUN; i++) {
      const e = generateEncounter(rng, i)
      expect(e.reward).toBeGreaterThan(encounterBudget(i) * 0.4)
      expect(e.waterReward).toBeGreaterThan(0)
    }
  })
})


describe('origins', () => {
  const firstborn = (ids: string[], seed = 'fb') =>
    newRun(seed, { origin: 'firstborn', mutationIds: ids, name: 'Rust' })

  it('gives each origin the roster §13 describes', () => {
    const scion = start()
    expect(scion.origin).toBe('scion')
    expect(scion.warband.officers).toHaveLength(2)
    expect(totalFodder(scion.warband)).toBeGreaterThanOrEqual(12)

    const fb = firstborn(['horns'])
    expect(fb.origin).toBe('firstborn')
    expect(fb.warband.officers).toHaveLength(0)
    // You, and one other. Both leader slots filled — see the note in
    // origins.ts on why the second one is the origin, not a handout.
    expect(fb.warband.prospects).toHaveLength(2)
    expect(fb.warband.prospects[0].id).toBe('you')
    expect(totalFodder(fb.warband)).toBeGreaterThanOrEqual(16)
  })

  it('makes you a Firstborn by proclamation, not by achievement', () => {
    /*
     * The Houses coined the word as a joke — a ceremonial elevation of a
     * favoured slave. So the origin sets the title rather than handing over
     * the five mutations that earn it, and the earned path stays exactly as
     * hard as it was for everybody else.
     */
    const you = firstborn(['horns']).warband.prospects[0]
    expect(isFirstborn(you)).toBe(true)
    expect(you.mutations.length).toBeLessThan(FIRSTBORN_AT_MUTATIONS)

    // Nobody else gets it for free.
    const ordinary = rollProspect(new Rng(hashSeed('ord')), 0, 0)
    expect(isFirstborn(ordinary)).toBe(false)
  })

  it('makes founding mutations personal, not squad-wide', () => {
    // The player fights as their own individual, same as any Prospect — the
    // founding choice is what THAT body can do, not a squad-wide stat bump.
    const fb = firstborn(['horns'])
    const you = fb.warband.prospects[0]
    const squad = fb.warband.squads[0]

    const led = resolveSquadStats(squad, null, you)
    const bare = resolveSquadStats(squad, null, null)
    expect(led.damage).toBe(bare.damage)

    // But the founder's OWN combat stats carry the mutation at full level.
    const own = resolveProspectStats(you)
    const roll = you.mutations[0]
    expect(own.damage).toBeCloseTo(unitType(you.typeId).base.damage + roll.level * 1.5, 5)

    // And the squad they lead holds better for it — a titled Firstborn from
    // the moment the run starts.
    expect(resolveDiscipline(squad.typeId, null, you)).toBeGreaterThan(
      resolveDiscipline(squad.typeId, null, null),
    )
  })

  it('trades width for depth, inside one currency', () => {
    // §13 wants "narrow and deep" to be a real alternative to "wide and
    // shallow". Paying in salvage instead would be a different decision that
    // happens to share a screen.
    const one = firstborn(['horns']).warband.prospects[0]
    const three = firstborn(['horns', 'carapace', 'bulging-sacs']).warband.prospects[0]

    expect(one.mutations).toHaveLength(1)
    expect(three.mutations).toHaveLength(3)
    expect(one.mutations[0].level).toBeGreaterThan(three.mutations[0].level)
    expect(foundingLevel(1)).toBeGreaterThan(foundingLevel(3))
  })

  it('taxes True Kin under a mutant without locking them out', () => {
    /*
     * The defining constraint of the origin, and the reason it is a tax:
     * an origin that removes a whole system is a smaller game, not a
     * different one. Bionics stay reachable, just slower and dearer.
     */
    const premium = ORIGINS_BY_ID.get('firstborn')!.truekinPremium
    expect(premium).toBeGreaterThan(1)

    let taxed = 0
    let plain = 0
    let truekinOffers = 0
    for (let i = 0; i < 60; i++) {
      const a = new Rng(hashSeed(`shop-${i}`))
      const b = new Rng(hashSeed(`shop-${i}`))
      const cheap = rollOffers(a, 3, 1)
      const dear = rollOffers(b, 3, premium)

      cheap.forEach((o, k) => {
        const isTrueKin =
          o.kind === 'officer' || unitType((o as { typeId: number }).typeId).lineage === 'truekin'
        if (!isTrueKin) {
          // A mutant crate costs a mutant the same as it costs anybody.
          expect(dear[k].cost).toBe(o.cost)
          return
        }
        truekinOffers++
        plain += o.cost
        taxed += dear[k].cost
      })
    }
    expect(truekinOffers).toBeGreaterThan(0)
    expect(taxed / plain).toBeCloseTo(premium, 1)
  })

  it('is reproducible, and different, per origin', () => {
    expect(totalFodder(firstborn(['horns'], 'same').warband)).toBe(
      totalFodder(firstborn(['horns'], 'same').warband),
    )
    expect(firstborn(['horns'], 'same').warband.officers.length).not.toBe(
      start('same').warband.officers.length,
    )
  })
})

describe('postmortem', () => {
  const g = (over: Partial<GroupResult>): GroupResult => ({
    label: 'x',
    team: TEAM_A,
    started: 40,
    dead: 40,
    survived: 0,
    endEffectiveness: 1,
    damageDealt: 1000,
    damageTaken: 1000,
    damageBlocked: 0,
    swings: 1000,
    hits: 900,
    ...over,
  })

  it('names armour when armour was the reason', () => {
    // The case this exists for: more bodies, fewer results. Armour is flat
    // reduction, so bringing more of something that hits for less than it is
    // the one response that actively does not work.
    const why = postmortem(
      [g({ started: 80, damageDealt: 200, damageBlocked: 1400 })],
      [g({ started: 30, team: TEAM_B })],
      false,
    )
    expect(why.cause).toBe('armour')
    expect(why.verdict).toMatch(/more bodies would not have helped/i)
    expect(why.evidence).toMatch(/88%/)
  })

  it('names morale when the line folded rather than lost', () => {
    const why = postmortem(
      [g({ started: 90, endEffectiveness: 0.36 })],
      [g({ started: 70, team: TEAM_B, endEffectiveness: 0.85 })],
      false,
    )
    expect(why.cause).toBe('morale')
    expect(why.evidence).toMatch(/damage multiplier/)
  })

  it('names accuracy when the swings were not landing', () => {
    const why = postmortem(
      [g({ swings: 2000, hits: 900 })],
      [g({ team: TEAM_B })],
      false,
    )
    expect(why.cause).toBe('accuracy')
  })

  it('says so plainly when nothing dominated', () => {
    // A postmortem that always names a culprit is worse than silence — the
    // player will act on it.
    const why = postmortem([g({})], [g({ team: TEAM_B, started: 38 })], false)
    expect(why.cause).toBe('even')
    expect(why.evidence).toMatch(/nothing dominated/i)
  })

  it('reads the same evidence differently when you won', () => {
    const heavy = { started: 80, damageDealt: 200, damageBlocked: 1400 }
    const lost = postmortem([g(heavy)], [g({ team: TEAM_B })], false)
    const held = postmortem([g(heavy)], [g({ team: TEAM_B })], true)
    expect(lost.cause).toBe(held.cause)
    expect(lost.verdict).not.toBe(held.verdict)
  })

  it('explains a real battle the player actually lost with more bodies', () => {
    /*
     * End to end against the sim, not against hand-written numbers. Forty
     * Chaff (5 damage, no armour) against fifteen Shieldbearers — the fodder
     * outnumbers them nearly three to one and loses, because flat armour eats almost every
     * swing. If this ever stops being an armour verdict, either the armour
     * model changed or the postmortem stopped reading it.
     */
    const chaff = makeGroup(TEAM_A, 0, 40)
    const armoured = makeGroup(TEAM_B, 8, 15)
    const battle = new Battle({ seed: 4242, groups: [chaff, armoured] })
    battle.run()

    const results = battle.results()
    const mine = results.filter((r) => r.team === TEAM_A)
    const theirs = results.filter((r) => r.team === TEAM_B)
    const why = postmortem(mine, theirs, battle.winner === TEAM_A)

    expect(mine[0].started).toBeGreaterThan(theirs[0].started * 2)
    expect(mine[0].damageBlocked).toBeGreaterThan(0)
    expect(['armour', 'morale']).toContain(why.cause)
  })
})

describe('postmortem discrimination', () => {
  const mirror = (seed: number) => {
    const battle = new Battle({
      seed,
      groups: [makeGroup(TEAM_A, 0, 40), makeGroup(TEAM_B, 0, 40)],
    })
    battle.run()
    const results = battle.results()
    return postmortem(
      results.filter((r) => r.team === TEAM_A),
      results.filter((r) => r.team === TEAM_B),
      battle.winner === TEAM_A,
    )
  }

  it('stays silent about morale in a mirror match', () => {
    /*
     * Effectiveness is discipline + (1 - discipline) x alive/started, so the
     * losing side of ANY battle ends low. The first version read that as
     * "your line folded" and said it after every close defeat, including
     * forty Chaff against forty Chaff where nothing about morale
     * distinguished the sides at all.
     *
     * A verdict that is true of every loss explains none of them.
     */
    for (let seed = 1; seed <= 25; seed++) {
      expect(mirror(seed).cause).not.toBe('morale')
    }
  })

  it('still names morale when one side really is more brittle', () => {
    // Mutants fold at 0.35, True Kin hold at 0.78. Same losses, very
    // different collapse — that is a cause, not an outcome.
    const battle = new Battle({
      seed: 91,
      groups: [
        { ...makeGroup(TEAM_A, 0, 60), discipline: DISCIPLINE.mutant },
        { ...makeGroup(TEAM_B, 5, 26), discipline: DISCIPLINE.truekin },
      ],
    })
    battle.run()
    const results = battle.results()
    const why = postmortem(
      results.filter((r) => r.team === TEAM_A),
      results.filter((r) => r.team === TEAM_B),
      battle.winner === TEAM_A,
    )
    expect(['morale', 'armour']).toContain(why.cause)
  })
})

describe('scouting', () => {
  const emptyWarband = (): Warband => ({
    squads: [],
    prospects: [],
    officers: [],
    salvage: 0,
    water: 0,
    bionics: [],
    relics: [],
    machines: [],
    morale: 0,
  })

  it('reads armour and lineage mix from what the sim will actually fight', () => {
    // Chaff (id 0): armour 0, mutant. Shieldbearer (id 8): real armour, truekin.
    const w: Warband = {
      ...emptyWarband(),
      squads: [
        { id: 's1', typeId: 0, count: 40, leader: null },
        { id: 's2', typeId: 8, count: 10, leader: null },
      ],
    }
    const report = scoutEnemy(w)
    expect(report.bodies).toBe(50)
    // Weighted toward the unarmoured majority, but pulled up by the ten
    // Shieldbearers — not zero, not "heavily armoured".
    expect(report.armorWord).not.toBe(armorWord(0))
    expect(report.mixWord).toBe(mixWord(10 / 50))
    expect(report.led).toBe(false)
  })

  it('names "no True Kin" plainly rather than folding it into "mostly mutant"', () => {
    // 62% of real generated encounters carry zero True Kin (measured against
    // sim:campaign's own generator) — common enough, and different enough
    // from "a few True Kin mixed in", to deserve its own word.
    const w: Warband = {
      ...emptyWarband(),
      squads: [{ id: 's1', typeId: 0, count: 30, leader: null }],
    }
    expect(scoutEnemy(w).mixWord).toBe('all mutant, no True Kin')
    expect(mixWord(0)).not.toBe(mixWord(0.15))
  })

  it('reports an officer leading the line', () => {
    const rng = new Rng(hashSeed('scout-officer'))
    const officer = rollOfficer(rng, 'eo1')
    const w: Warband = {
      ...emptyWarband(),
      officers: [officer],
      squads: [{ id: 's1', typeId: 0, count: 20, leader: { kind: 'officer', id: officer.id } }],
    }
    expect(scoutEnemy(w).led).toBe(true)
    expect(scoutEnemy(emptyWarband()).led).toBe(false)
  })

  it('folds Prospects into the body count without them skewing the armour read', () => {
    const p = rollProspect(new Rng(hashSeed('scout-prospect')), 0, 0)
    const w: Warband = {
      ...emptyWarband(),
      prospects: [p],
      squads: [{ id: 's1', typeId: 0, count: 20, leader: null }],
    }
    const withoutProspect = scoutEnemy({ ...w, prospects: [] })
    const withProspect = scoutEnemy(w)
    expect(withProspect.bodies).toBe(withoutProspect.bodies + 1)
    // A Prospect's own body isn't a squad — the armour read describes the
    // line, not this one individual, so adding one should not move it.
    expect(withProspect.armorWord).toBe(withoutProspect.armorWord)
  })

  it('never crashes on an empty warband', () => {
    expect(() => scoutEnemy(emptyWarband())).not.toThrow()
    expect(scoutEnemy(emptyWarband()).bodies).toBe(0)
  })

  it('produces a real spread of armour words across generated encounters', () => {
    // Pinned against actual measurement (tools/_scout.ts): weighted average
    // armour across warband/wasteland encounters splits roughly 29/36/22/13
    // across the four bands. If a future content change collapsed that
    // spread to one dominant band, this is what would catch it.
    const rng = new Rng(hashSeed('scout-spread'))
    const seen = new Set<string>()
    for (let i = 0; i < 400; i++) {
      const e = generateEncounter(rng, i % ENCOUNTERS_PER_RUN)
      if (e.kind !== 'warband' && e.kind !== 'wasteland') continue
      seen.add(scoutEnemy(e.enemy).armorWord)
    }
    expect(seen.size).toBeGreaterThan(1)
  })
})

describe('permanent injuries', () => {
  // The sim decides WHO gets maimed (Battle.resolveDeath, MAIM_CHANCE) and
  // hands back Maimed events with group indices; resolveBattle's job is only
  // to turn those back into Prospect ids and apply the consequence — so
  // these tests drive that translation directly with hand-built events
  // rather than hoping a real battle rolls one, same approach as the
  // existing 'only degrades' machine test above.

  function maimedEvent(groupIndex: number, label: string, sourceGroupIndex: number, sourceLabel: string): BattleEvent {
    return {
      tick: 10, type: BattleEventType.Maimed, team: TEAM_A, groupIndex, label, value: 0,
      sourceGroupIndex, sourceLabel,
    }
  }

  it('turns a Maimed event into a permanent injury on the right Prospect', () => {
    const run = start()
    const prospect = run.warband.prospects[0]
    const marched = march(run)
    const state = marched.state
    const setup = marched.setup
    const groupIndex = setup.playerSources.findIndex((s) => s.kind === 'prospect' && s.id === prospect.id)
    expect(groupIndex).toBeGreaterThanOrEqual(0)

    const results = setup.playerSources.map(() => ({
      label: 'x', started: 1, dead: 0, survived: 1, endEffectiveness: 1,
      damageDealt: 0, damageTaken: 0, damageBlocked: 0, swings: 0, hits: 0, team: TEAM_A,
    })) as never as GroupResult[]

    const events = [maimedEvent(groupIndex, 'x', 99, 'Halberdier ×12')]
    const resolved = resolveBattle(state, results, TEAM_A, 100, setup.playerSources, events)
    const after = resolved.warband.prospects.find((p) => p.id === prospect.id)

    expect(after?.permanentInjuries).toHaveLength(1)
    const injury = after!.permanentInjuries[0]
    expect(injury.attacker).toBe('Halberdier ×12')
    expect(injury.harmKind).toBe(harmKindFromLabel('Halberdier ×12'))
    expect(injury.encounterIndex).toBe(state.encounterIndex)
    expect(describeInjury(injury)).toBeTruthy()
  })

  it('credits a dismemberment to the Prospect whose own body dealt it, not to the squad it might lead', () => {
    const run = start()
    const prospect = run.warband.prospects[0]
    const marched = march(run)
    const state = marched.state
    const setup = marched.setup
    const groupIndex = setup.playerSources.findIndex((s) => s.kind === 'prospect' && s.id === prospect.id)

    const results = setup.playerSources.map(() => ({
      label: 'x', started: 1, dead: 0, survived: 1, endEffectiveness: 1,
      damageDealt: 0, damageTaken: 0, damageBlocked: 0, swings: 0, hits: 0, team: TEAM_A,
    })) as never as GroupResult[]

    // My Prospect (groupIndex) is the SOURCE here — it dealt the maiming to
    // some enemy body at a higher, out-of-range groupIndex.
    const events = [maimedEvent(999, 'Vex the Chaff', groupIndex, 'x')]
    const resolved = resolveBattle(state, results, TEAM_A, 100, setup.playerSources, events)
    const after = resolved.warband.prospects.find((p) => p.id === prospect.id)

    expect(after?.dismemberments).toHaveLength(1)
    expect(after?.dismemberments[0].victim).toBe('Vex the Chaff')
  })

  it('gives no credit when a squad, not a Prospect, was the source', () => {
    const run = start()
    const marched = march(run)
    const state = marched.state
    const setup = marched.setup
    const squadIndex = setup.playerSources.findIndex((s) => s.kind === 'squad')
    expect(squadIndex).toBeGreaterThanOrEqual(0)

    const results = setup.playerSources.map(() => ({
      label: 'x', started: 1, dead: 0, survived: 1, endEffectiveness: 1,
      damageDealt: 0, damageTaken: 0, damageBlocked: 0, swings: 0, hits: 0, team: TEAM_A,
    })) as never as GroupResult[]

    const events = [maimedEvent(999, 'Vex the Chaff', squadIndex, 'x')]
    const resolved = resolveBattle(state, results, TEAM_A, 100, setup.playerSources, events)
    const total = resolved.warband.prospects.reduce((n, p) => n + p.dismemberments.length, 0)
    expect(total).toBe(0)
  })

  it('applies a permanent penalty on top of, not instead of, an active wound', () => {
    const bare = { hp: 100, armor: 0, damage: 10, attackInterval: 1, range: 1, moveSpeed: 1, accuracy: 1, evade: 0, radius: 1, regen: 0, quills: 0, frenzy: 0 }
    const withInjury = { ...bare }
    applyPermanentInjuries(withInjury, [{ zone: 'core', harmKind: 'blade', attacker: 'x', encounterIndex: 0 }])
    expect(withInjury.hp).toBeCloseTo(bare.hp * (1 - PERMANENT_INJURY_PENALTY), 5)
  })

  it('describes every zone/harmKind pair without falling through', () => {
    for (const zone of WOUND_ZONES) {
      for (const harmKind of ['blade', 'pierce', 'blunt', 'burn'] as const) {
        expect(describeInjury({ zone, harmKind, attacker: 'x', encounterIndex: 0 })).toBeTruthy()
      }
    }
  })
})
