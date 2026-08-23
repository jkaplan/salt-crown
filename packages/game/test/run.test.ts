import { describe, expect, it } from 'vitest'
import { Rng, hashSeed } from '@salt/sim'
import {
  ENCOUNTERS_PER_RUN,
  assignLeader,
  buildBattle,
  buy,
  moveSquad,
  newRun,
  placeSquad,
  rollOfficer,
  squadLabel,
  toSimGroups,
  totalBodies,
  totalFodder,
  unitType,
} from '@salt/game'
import type { RunState } from '@salt/game'
import { TEAM_A } from '@salt/sim'

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
        (o) => o.kind === 'squad' && o.potentials.length > 0 && o.cost <= run.warband.salvage,
      )
      if (!offer || offer.kind !== 'squad') continue
      const after = buy(run, offer.id)
      expect(after.warband.potentials.length).toBe(
        run.warband.potentials.length + offer.potentials.length,
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

  it('refuses to put a Potential in charge of True Kin', () => {
    // A mutant does not command True Kin. Design invariant, not a UI nicety.
    const run = start()
    const potential = run.warband.potentials[0]
    expect(potential).toBeDefined()

    const trueKin = run.warband.squads.find((s) => unitType(s.typeId).lineage === 'truekin')
    if (!trueKin) return // starting warband is all mutant; covered by the shop path

    const after = assignLeader(run, trueKin.id, { kind: 'potential', id: potential.id })
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
    expect(fielded).toBe(totalFodder(run.warband) + run.warband.potentials.length)
  })

  it('fields a leading Potential as its own killable body', () => {
    // Regression. Leading Potentials were skipped when building groups, so
    // their body never reached the field AND resolveBattle — which maps
    // outcomes back through these groups — could never record them as dead.
    // Promoting your best standout to leader made it immortal.
    const run = start()
    const potential = run.warband.potentials[0]
    const squad = run.warband.squads.find((s) => unitType(s.typeId).lineage === 'mutant')
    expect(potential && squad).toBeTruthy()

    const led = assignLeader(run, squad!.id, { kind: 'potential', id: potential.id })
    const { groups, sources } = toSimGroups(led.warband, TEAM_A)

    expect(sources).toContainEqual({ kind: 'potential', id: potential.id })
    const fielded = groups.reduce((n, g) => n + g.count, 0)
    expect(fielded).toBe(totalFodder(led.warband) + led.warband.potentials.length)
  })

  it('leaks a leader’s mutations into the squad it leads', () => {
    const run = start()
    const potential = run.warband.potentials[0]
    const squad = run.warband.squads.find((s) => unitType(s.typeId).lineage === 'mutant')!
    if (potential.mutations.length === 0) return

    const before = toSimGroups(run.warband, TEAM_A).groups.find((g) => g.label === squadLabel(squad))
    const led = assignLeader(run, squad.id, { kind: 'potential', id: potential.id })
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
