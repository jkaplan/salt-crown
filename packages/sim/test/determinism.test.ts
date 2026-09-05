import { describe, expect, it } from 'vitest'
import { Battle, BattleEventType, Rng, TEAM_A, TEAM_B, hashSeed } from '@salt/sim'
import {
  makeGroup,
  resolveProspectStats,
  resolveSquadStats,
  OFFICER_RANKS,
  UNIT_TYPES,
} from '@salt/game'

function build(seed: number, a = 40, b = 40, typeId = 0) {
  return new Battle({
    seed,
    groups: [makeGroup(TEAM_A, typeId, a), makeGroup(TEAM_B, typeId, b)],
  })
}

describe('Rng', () => {
  it('is reproducible from a seed', () => {
    const a = new Rng(12345)
    const b = new Rng(12345)
    for (let i = 0; i < 1000; i++) expect(a.next()).toBe(b.next())
  })

  it('produces different streams for different seeds', () => {
    const a = new Rng(1)
    const b = new Rng(2)
    let same = 0
    for (let i = 0; i < 1000; i++) if (a.next() === b.next()) same++
    expect(same).toBeLessThan(5)
  })

  it('stays in range', () => {
    const r = new Rng(99)
    for (let i = 0; i < 10_000; i++) {
      const f = r.float()
      expect(f).toBeGreaterThanOrEqual(0)
      expect(f).toBeLessThan(1)
      expect(r.int(6)).toBeLessThan(6)
    }
  })

  it('hashes seed strings stably', () => {
    expect(hashSeed('salt-crown')).toBe(hashSeed('salt-crown'))
    expect(hashSeed('a')).not.toBe(hashSeed('b'))
  })
})

describe('Battle determinism', () => {
  it('produces identical state at every tick for the same seed', () => {
    const a = build(777)
    const b = build(777)
    for (let t = 0; t < 400 && !a.finished; t++) {
      a.step()
      b.step()
      expect(b.hash()).toBe(a.hash())
    }
    expect(a.tick).toBe(b.tick)
  })

  it('reaches an identical final state across many seeds', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const a = build(seed)
      const b = build(seed)
      a.run()
      b.run()
      expect(b.hash()).toBe(a.hash())
      expect(b.winner).toBe(a.winner)
      expect(b.tick).toBe(a.tick)
    }
  })

  it('gives different outcomes for different seeds', () => {
    const hashes = new Set<number>()
    for (let seed = 1; seed <= 20; seed++) {
      const battle = build(seed)
      battle.run()
      hashes.add(battle.hash())
    }
    expect(hashes.size).toBeGreaterThan(15)
  })
})

describe('Battle resolution', () => {
  it('terminates and declares a winner', () => {
    const battle = build(42)
    const ticks = battle.run()
    expect(battle.finished).toBe(true)
    expect(ticks).toBeLessThan(battle.maxTicks)
    expect([TEAM_A, TEAM_B]).toContain(battle.winner)
  })

  it('is fair at equal strength', () => {
    let aWins = 0
    const runs = 400
    for (let seed = 1; seed <= runs; seed++) {
      const battle = build(seed)
      battle.run()
      if (battle.winner === TEAM_A) aWins++
    }
    // Mirror match, so anything off 50% is an artifact rather than a result.
    // Resolving the tick sequentially instead of simultaneously used to put
    // this at 40/60 — the lower-indexed team closed to range half a tick
    // early. Bounds are ~2 sigma at n=400; tight enough to catch that again.
    expect(aWins / runs).toBeGreaterThan(0.43)
    expect(aWins / runs).toBeLessThan(0.57)
  }, 20_000) // 400 full battles is real work — vitest's 5s default is a machine-load
  // gamble, not a correctness bound. The assertion above is what actually guards
  // fairness; this just gives it room to finish on a busy machine.

  it('rewards numbers superlinearly (Lanchester)', () => {
    let bigWins = 0
    for (let seed = 1; seed <= 40; seed++) {
      const battle = build(seed, 30, 45)
      battle.run()
      if (battle.winner === TEAM_B) bigWins++
    }
    expect(bigWins).toBeGreaterThan(35)
  })
})

describe('Morale as effectiveness', () => {
  it('grinds the losing side down to nothing', () => {
    // Battles are fought to the finish, so a defeat leaves no bodies. That is
    // why losing ends the run — docs/V0-DESIGN.md §7.
    const battle = build(9, 30, 60)
    battle.run()
    expect(battle.winner).toBe(TEAM_B)
    expect(battle.aliveA).toBe(0)
  })

  it('degrades a bleeding squad toward its discipline floor', () => {
    const battle = build(9, 30, 60)
    battle.run()
    const loser = battle.results().find((r) => r.team === TEAM_A)!
    // Mutant discipline is 0.35, so a squad ground to nothing sits just above
    // the floor — morale is recomputed at the top of a tick, so the last value
    // recorded is from when a body or two was still standing.
    expect(loser.endEffectiveness).toBeGreaterThanOrEqual(0.35)
    expect(loser.endEffectiveness).toBeLessThan(0.4)

    // The winner should barely have noticed.
    const winner = battle.results().find((r) => r.team === TEAM_B)!
    expect(winner.endEffectiveness).toBeGreaterThan(loser.endEffectiveness)
  })

  it('never degrades a group whose discipline is 1', () => {
    const groups = [
      { ...makeGroup(TEAM_A, 0, 40), discipline: 1 },
      makeGroup(TEAM_B, 0, 80),
    ]
    const battle = new Battle({ seed: 3, groups })
    battle.run()
    expect(battle.results()[0].endEffectiveness).toBe(1)
  })

  it('accounts for every body exactly once', () => {
    const battle = build(11, 35, 35)
    battle.run()
    for (const r of battle.results()) {
      expect(r.dead + r.survived).toBe(r.started)
    }
  })
})

describe('Battle events', () => {
  // docs/V0-DESIGN.md §5c: notable events for a battle log and a leader HUD
  // to share. Deliberately narrow — only named individuals and squad-level
  // collapses, not a record of every hit.

  it('emits no Hit or Died events for ordinary fodder', () => {
    const battle = build(9, 30, 60)
    battle.run()
    const events = battle.newEventsSince(0)
    expect(events.some((e) => e.type === BattleEventType.Hit)).toBe(false)
    expect(events.some((e) => e.type === BattleEventType.Died)).toBe(false)
  })

  it('still emits Collapsed for a losing fodder squad with no named individual', () => {
    const battle = build(9, 30, 60)
    battle.run()
    const collapsed = battle.newEventsSince(0).filter((e) => e.type === BattleEventType.Collapsed)
    expect(collapsed.length).toBeGreaterThan(0)
    expect(collapsed.every((e) => e.team === TEAM_A)).toBe(true)
  })

  it('fires Collapsed exactly once per group, on the tick it first crosses the threshold', () => {
    const battle = build(9, 30, 60)
    battle.run()
    const collapsed = battle.newEventsSince(0).filter((e) => e.type === BattleEventType.Collapsed)
    const byGroup = new Map<number, number>()
    for (const e of collapsed) byGroup.set(e.groupIndex, (byGroup.get(e.groupIndex) ?? 0) + 1)
    for (const count of byGroup.values()) expect(count).toBe(1)
  })

  it('emits Hit and Died for a named individual, matching its group label', () => {
    const lone = { ...makeGroup(TEAM_A, 0, 1), label: 'Tallow', named: true }
    const battle = new Battle({ seed: 7, groups: [lone, makeGroup(TEAM_B, 0, 20)] })
    battle.run()

    const events = battle.newEventsSince(0)
    const hits = events.filter((e) => e.type === BattleEventType.Hit)
    const died = events.filter((e) => e.type === BattleEventType.Died)

    expect(hits.length).toBeGreaterThan(0)
    expect(hits.every((e) => e.groupIndex === 0 && e.label === 'Tallow' && e.value > 0)).toBe(true)
    // A lone body against 20 does not survive.
    expect(died.length).toBe(1)
    expect(died[0].groupIndex).toBe(0)
    expect(died[0].label).toBe('Tallow')
  })

  it('newEventsSince is cumulative and returns nothing already-read twice', () => {
    const lone = { ...makeGroup(TEAM_A, 0, 1), label: 'Chalk', named: true }
    const battle = new Battle({ seed: 7, groups: [lone, makeGroup(TEAM_B, 0, 20)] })

    let seen = 0
    const all: ReturnType<Battle['newEventsSince']> = []
    while (!battle.finished) {
      battle.step()
      const fresh = battle.newEventsSince(seen)
      all.push(...fresh)
      seen = battle.eventCount
    }

    expect(all.length).toBe(battle.eventCount)
    expect(battle.newEventsSince(seen).length).toBe(0)
  })
})

describe('Maiming', () => {
  // docs/V0-DESIGN.md §15: a maimable body that would die rolls once to
  // survive instead. Gated on SimGroup.maimable specifically — named alone
  // (Officers/Machines/boss squads) is not enough, per the 'Tallow' case
  // above, which already proves a named-but-not-maimable body just dies.

  it('never maims a body that is named but not maimable', () => {
    // Same shape as 'emits Hit and Died for a named individual' above, just
    // swept across enough seeds that a real MAIM_CHANCE roll (0.12) would
    // almost certainly have shown up at least once if this weren't gated.
    for (let seed = 1; seed <= 60; seed++) {
      const lone = { ...makeGroup(TEAM_A, 0, 1), label: 'Tallow', named: true }
      const battle = new Battle({ seed, groups: [lone, makeGroup(TEAM_B, 0, 20)] })
      battle.run()
      expect(battle.newEventsSince(0).some((e) => e.type === BattleEventType.Maimed)).toBe(false)
    }
  })

  it('sometimes lets a maimable body survive at 1 HP instead of dying', () => {
    // Checked tick-by-tick, at the moment Maimed fires — not after the whole
    // battle, because a body maimed at 1 HP against 20 attackers is still
    // extremely likely to die to the NEXT hit, same battle. That's correct
    // (the roll is a save against one blow, not immunity), so asserting
    // "maimed implies never later dead" would be testing for a behaviour
    // this feature was never meant to have.
    let sawMaimed = false
    for (let seed = 1; seed <= 200 && !sawMaimed; seed++) {
      const lone = { ...makeGroup(TEAM_A, 0, 1), label: 'Rust', named: true, maimable: true }
      const battle = new Battle({ seed, groups: [lone, makeGroup(TEAM_B, 0, 20)] })
      let seen = 0
      while (!battle.finished && !sawMaimed) {
        battle.step()
        const fresh = battle.newEventsSince(seen)
        seen = battle.eventCount
        const m = fresh.find((e) => e.type === BattleEventType.Maimed)
        if (!m) continue
        sawMaimed = true
        expect(battle.alive[0]).toBe(1)
        expect(battle.hp[0]).toBe(1)
        // The enemy squad is the only thing that could have landed it.
        expect(m.sourceGroupIndex).toBe(1)
        expect(m.sourceLabel).toBe(makeGroup(TEAM_B, 0, 20).label)
      }
    }
    // ~12% chance per lethal hit — 200 seeds is generous headroom against flakiness.
    expect(sawMaimed).toBe(true)
  })

  it('replays identically at a fixed seed, Maimed events included', () => {
    const build = () => {
      const lone = { ...makeGroup(TEAM_A, 0, 1), label: 'Rust', named: true, maimable: true }
      return new Battle({ seed: 42, groups: [lone, makeGroup(TEAM_B, 0, 20)] })
    }
    const a = build()
    a.run()
    const b = build()
    b.run()
    expect(a.newEventsSince(0)).toEqual(b.newEventsSince(0))
  })
})

describe('Stat resolution', () => {
  const prospect = (mutations: { id: string; level: number }[]) => ({
    id: 'x', typeId: 0, name: 'Test', mutations, battles: 0, growth: 0, capacity: 6, appraised: true, fielded: true,
    wound: null, bionics: [], permanentInjuries: [], dismemberments: [], instability: 0 })

  it('leaves fodder unmutated', () => {
    // Mutation is individual and rare. Squads are bodies, nothing more.
    const s = resolveSquadStats({ id: 'x', typeId: 0, count: 20, leader: null }, null)
    expect(s).toEqual({ ...UNIT_TYPES[0].base, regen: 0, quills: 0, frenzy: 0 })
  })

  it('applies a Prospect’s mutations at level', () => {
    const bare = resolveProspectStats(prospect([]))
    const horned = resolveProspectStats(prospect([{ id: 'horns', level: 4 }]))
    expect(horned.damage).toBeCloseTo(bare.damage + 6, 5)
  })

  it('makes Prospects sturdier than the fodder they came from', () => {
    const fodder = resolveSquadStats({ id: 'x', typeId: 0, count: 1, leader: null }, null)
    const standout = resolveProspectStats(prospect([]))
    expect(standout.hp).toBeGreaterThan(fodder.hp)
  })

  it('never applies a leading Prospect’s mutations to its squad’s stats', () => {
    /*
     * This used to leak at half level (Horns 5 -> squad Horns 3). Cut:
     * nothing explains how one body's mutation reaches twenty others, and a
     * leading Prospect now affects discipline only — see
     * docs/ROADMAP.md's post-M4 entry and roster.ts's resolveSquadStats.
     */
    const leader = prospect([{ id: 'horns', level: 5 }])
    const bare = resolveSquadStats({ id: 'x', typeId: 0, count: 20, leader: null }, null)
    const led = resolveSquadStats(
      { id: 'x', typeId: 0, count: 20, leader: { kind: 'prospect', id: 'x' } },
      null,
      leader,
    )
    expect(led).toEqual(bare)
  })

  it('lets an Officer override a Prospect leader on the same squad', () => {
    const leader = prospect([{ id: 'horns', level: 5 }])
    const officer = { id: 'o', name: 'Test', house: 'Test', rankId: OFFICER_RANKS[0].id, wound: null, bionics: [] }
    const s = resolveSquadStats(
      { id: 'x', typeId: 0, count: 20, leader: { kind: 'officer', id: 'o' } },
      officer,
      leader,
    )
    // The officer bonus applies; a Prospect leader has no stat effect to
    // stack in even when passed (it never overrides an Officer's stats).
    const officerOnly = resolveSquadStats({ id: 'x', typeId: 0, count: 20, leader: null }, officer)
    expect(s).toEqual(officerOnly)
  })

  it('clamps a bad mutation stack into legal values', () => {
    const s = resolveProspectStats(
      prospect([
        { id: 'dense-bone', level: 6 },
        { id: 'serrated-claws', level: 6 },
      ]),
    )
    expect(s.moveSpeed).toBeGreaterThanOrEqual(0.8)
    expect(s.accuracy).toBeGreaterThanOrEqual(0.05)
    expect(s.armor).toBeGreaterThanOrEqual(0)
  })

  it('gives every unit type sane baseline stats', () => {
    for (const t of UNIT_TYPES) {
      expect(t.base.hp).toBeGreaterThan(0)
      expect(t.base.damage).toBeGreaterThan(0)
      expect(t.base.attackInterval).toBeGreaterThan(0)
      expect(t.cost).toBeGreaterThan(0)
    }
  })
})
