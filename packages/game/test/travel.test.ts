import { describe, expect, it } from 'vitest'
import {
  PACE_GAP_MOVE,
  STARTING_GAP,
  TRAIL_LOST_AT,
  forecastPace,
  marchWaterBill,
  waterUpkeep,
} from '../src/index.js'
import type { Warband } from '../src/index.js'

/**
 * A warband with one squad and a named cistern, so every figure below is
 * arithmetic a reader can check by hand rather than a campaign artifact.
 */
function band(water: number, count = 20): Warband {
  return {
    squads: [{ id: 'sq-0', typeId: 0, count, leader: null }],
    prospects: [],
    officers: [],
    machines: [],
    bionics: [],
    relics: [],
    salvage: 0,
    water,
    morale: 0,
  }
}

describe('forecastPace', () => {
  it('quotes the same bill the march will actually charge', () => {
    const w = band(999)
    for (const pace of ['column', 'forced', 'killing'] as const) {
      expect(forecastPace(w, STARTING_GAP, false, pace).bill).toBe(
        marchWaterBill(waterUpkeep(w), pace),
      )
    }
  })

  it('a fuller cistern is not a cheaper march, only a quieter one', () => {
    const w = band(3)
    const f = forecastPace(w, STARTING_GAP, false, 'column')
    expect(f.bill).toBe(marchWaterBill(waterUpkeep(w), 'column'))
    expect(f.deserters).toBeGreaterThan(0)
    expect(forecastPace(band(999), STARTING_GAP, false, 'column').deserters).toBe(0)
  })

  it('names who walks before the player commits, and a harder pace costs more of them', () => {
    const w = band(30)
    const column = forecastPace(w, STARTING_GAP, false, 'column')
    const killing = forecastPace(w, STARTING_GAP, false, 'killing')
    expect(killing.bill).toBeGreaterThan(column.bill)
    expect(killing.deserters).toBeGreaterThanOrEqual(column.deserters)
  })

  it('moves the gap the way the pace moves it', () => {
    for (const pace of ['column', 'forced', 'killing'] as const) {
      expect(forecastPace(band(999), 10, false, pace).gapAfter).toBe(10 + PACE_GAP_MOVE[pace])
    }
  })

  it('warns before the trail goes cold rather than after', () => {
    const onTheEdge = TRAIL_LOST_AT - PACE_GAP_MOVE.column
    expect(forecastPace(band(999), onTheEdge, false, 'column').losesTrail).toBe(true)
    expect(forecastPace(band(999), onTheEdge, false, 'forced').losesTrail).toBe(false)
  })

  it('cannot promise a catch on a trail that is already cold', () => {
    const closing = forecastPace(band(999), 1, false, 'killing')
    expect(closing.catches).toBe(true)
    expect(forecastPace(band(999), 1, true, 'killing').catches).toBe(false)
  })
})
