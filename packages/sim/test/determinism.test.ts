import { describe, expect, it } from 'vitest'
import { Battle, Rng, TEAM_A, TEAM_B, hashSeed } from '@salt/sim'
import {
  makeGroup,
  resolvePotentialStats,
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
  }, 30000)

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

describe('Stat resolution', () => {
  const potential = (mutations: { id: string; level: number }[]) => ({
    id: 'x', typeId: 0, name: 'Test', mutations, battles: 0,
  })

  it('leaves fodder unmutated', () => {
    // Mutation is individual and rare. Squads are bodies, nothing more.
    const s = resolveSquadStats({ id: 'x', typeId: 0, count: 20, leader: null }, null)
    expect(s).toEqual({ ...UNIT_TYPES[0].base, regen: 0, quills: 0, frenzy: 0 })
  })

  it('applies a Potential’s mutations at level', () => {
    const bare = resolvePotentialStats(potential([]))
    const horned = resolvePotentialStats(potential([{ id: 'horns', level: 4 }]))
    expect(horned.damage).toBeCloseTo(bare.damage + 6, 5)
  })

  it('makes Potentials sturdier than the fodder they came from', () => {
    const fodder = resolveSquadStats({ id: 'x', typeId: 0, count: 1, leader: null }, null)
    const standout = resolvePotentialStats(potential([]))
    expect(standout.hp).toBeGreaterThan(fodder.hp)
  })

  it('leaks a leading Potential’s mutations to its squad at half level', () => {
    // A Horns 5 standout should give its squad Horns 3 (ceil(5/2)), not the
    // full 5 — that gap is what makes an Officer vs. a Potential leader a
    // real choice rather than a strictly dominant one.
    const leader = potential([{ id: 'horns', level: 5 }])
    const bare = resolveSquadStats({ id: 'x', typeId: 0, count: 20, leader: null }, null)
    const led = resolveSquadStats(
      { id: 'x', typeId: 0, count: 20, leader: { kind: 'potential', id: 'x' } },
      null,
      leader,
    )
    expect(led.damage).toBeCloseTo(bare.damage + 3 * 1.5, 5)
  })

  it('lets an Officer override a Potential leader on the same squad', () => {
    const leader = potential([{ id: 'horns', level: 5 }])
    const officer = { id: 'o', name: 'Test', house: 'Test', rankId: OFFICER_RANKS[0].id }
    const s = resolveSquadStats(
      { id: 'x', typeId: 0, count: 20, leader: { kind: 'officer', id: 'o' } },
      officer,
      leader,
    )
    // The officer bonus applies; the mutation leak does not also stack in.
    const officerOnly = resolveSquadStats({ id: 'x', typeId: 0, count: 20, leader: null }, officer)
    expect(s).toEqual(officerOnly)
  })

  it('clamps a bad mutation stack into legal values', () => {
    const s = resolvePotentialStats(
      potential([
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
