import { describe, expect, it } from 'vitest'
import { Rng, hashSeed } from '@salt/sim'
import {
  EVENTS,
  LEGS_PER_MARCH,
  TRAIL_EVENTS,
  advanceLeg,
  newRun,
  resolveTrailEvent,
  rollOfficer,
  rollTrailEvent,
  setOut,
  totalBodies,
  travelDone,
} from '../src/index.js'
import type { Pace, RunState } from '../src/index.js'

function start(seed = 'trail-seed'): RunState {
  const leader = rollOfficer(new Rng(hashSeed(seed)), 'leader-0')
  return newRun(seed, { origin: 'scion', officer: leader })
}

/** Walk until something on the road asks a question, or the road runs out. */
function walkUntilEvent(state: RunState, pace: Pace): RunState {
  let s = setOut(state, pace)
  while (!travelDone(s) && !s.trailEvent) s = advanceLeg(s)
  return s
}

/** The first seed of many that produces a trail event at this pace. */
function seedWithEvent(pace: Pace): RunState {
  for (let i = 0; i < 200; i++) {
    const s = walkUntilEvent(start(`trail-${i}`), pace)
    if (s.trailEvent) return s
  }
  throw new Error('no trail event in 200 seeds — the chance is effectively zero')
}

describe('trail events as data', () => {
  it('gives every event at least two branches that differ', () => {
    for (const e of [...EVENTS, ...TRAIL_EVENTS]) {
      expect(e.choices.length, e.id).toBeGreaterThan(1)
      const shapes = new Set(e.choices.map((c) => JSON.stringify({ ...c, label: '', detail: '' })))
      expect(shapes.size, `${e.id} has branches that do the same thing`).toBeGreaterThan(1)
    }
  })

  it('never draws one twice in a run', () => {
    const rng = new Rng(hashSeed('draws'))
    const gates = new Set(['stragglers'] as const)
    const seen: string[] = []
    // The roll is gated on a chance, so most attempts come back empty. What
    // is under test is that the ones that land are never a repeat.
    for (let i = 0; i < 4000 && seen.length < TRAIL_EVENTS.length; i++) {
      const e = rollTrailEvent(rng, seen, gates)
      if (!e) continue
      expect(seen).not.toContain(e.id)
      seen.push(e.id)
    }
    expect(seen).toHaveLength(TRAIL_EVENTS.length)
  })

  it('holds back the ones that need something to act on', () => {
    const gated = TRAIL_EVENTS.filter((e) => e.needs === 'stragglers')
    expect(gated.length, 'no straggler-gated event to test').toBeGreaterThan(0)

    const rng = new Rng(hashSeed('gate'))
    const ungated = TRAIL_EVENTS.filter((e) => e.needs !== 'stragglers').map((e) => e.id)
    for (let i = 0; i < 50; i++) {
      const e = rollTrailEvent(rng, [], new Set())
      if (e) expect(ungated).toContain(e.id)
    }
  })
})

describe('the road stopping to ask', () => {
  it('blocks the next leg until it is answered', () => {
    const stopped = seedWithEvent('killing')
    const legs = stopped.travel!.legsDone
    expect(advanceLeg(stopped).travel!.legsDone).toBe(legs)
    expect(advanceLeg(resolveTrailEvent(stopped, 0)).travel!.legsDone).toBe(legs + 1)
  })

  it('happens at Column too, which is the whole reason it is not a pace tax', () => {
    expect(seedWithEvent('column').trailEvent).not.toBeNull()
  })

  it('clears the event and remembers it', () => {
    const stopped = seedWithEvent('killing')
    const answered = resolveTrailEvent(stopped, 0)
    expect(answered.trailEvent).toBeNull()
    expect(answered.seenEvents).toContain(stopped.trailEvent!.id)
  })

  it('never leaves one pending when the road ends', () => {
    for (let i = 0; i < 40; i++) {
      let s = setOut(start(`ending-${i}`), 'killing')
      for (let guard = 0; guard < LEGS_PER_MARCH * 4 && !travelDone(s); guard++) {
        s = s.trailEvent ? resolveTrailEvent(s, 0) : advanceLeg(s)
      }
      expect(travelDone(s)).toBe(true)
      expect(s.trailEvent).toBeNull()
    }
  })
})

describe('what a branch on the road can do', () => {
  const find = (id: string) => {
    const e = TRAIL_EVENTS.find((x) => x.id === id)
    if (!e) throw new Error(`no trail event ${id}`)
    return e
  }

  it('trades salvage for water, the same trade Scavenge makes', () => {
    const buying = TRAIL_EVENTS.flatMap((e) => e.choices).filter(
      (c) => (c.water ?? 0) > 0 && (c.salvage ?? 0) < 0,
    )
    expect(buying.length, 'no water-for-salvage branch anywhere on the road').toBeGreaterThan(0)
  })

  it('can change the pace the column is already walking at', () => {
    const stopped = seedWithEvent('killing')
    const i = stopped.trailEvent!.choices.findIndex((c) => c.pace)
    if (i === -1) return // not this event; the table-level check below covers it
    expect(resolveTrailEvent(stopped, i).travel!.pace).toBe(stopped.trailEvent!.choices[i].pace)
  })

  it('offers a pace change somewhere on the table, since pace is otherwise locked', () => {
    expect(TRAIL_EVENTS.some((e) => e.choices.some((c) => c.pace))).toBe(true)
  })

  it('puts rallied stragglers back in the column they fell out of', () => {
    const base = setOut(start('rally'), 'killing')
    const squadId = base.warband.squads[0].id
    const stranded: RunState = {
      ...base,
      travel: { ...base.travel!, stragglers: [{ squadId, count: 4 }] },
      trailEvent: find('strung-out'),
    }
    const i = stranded.trailEvent!.choices.findIndex((c) => c.rallyStragglers)
    expect(i, 'strung-out has no rally branch').toBeGreaterThan(-1)

    const rallied = resolveTrailEvent(stranded, i)
    expect(totalBodies(rallied.warband)).toBe(totalBodies(stranded.warband) + 4)
    expect(rallied.travel!.stragglers).toHaveLength(0)
  })

  it('refuses a branch the warband cannot pay for', () => {
    const base = setOut(start('broke'), 'column')
    const costly = TRAIL_EVENTS.find((e) => e.choices.some((c) => (c.requires ?? 0) > 0))
    if (!costly) return
    const i = costly.choices.findIndex((c) => (c.requires ?? 0) > 0)
    const poor: RunState = {
      ...base,
      warband: { ...base.warband, salvage: 0 },
      trailEvent: costly,
    }
    expect(resolveTrailEvent(poor, i).trailEvent).not.toBeNull()
  })
})
