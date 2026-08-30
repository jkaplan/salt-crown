import { describe, expect, it } from 'vitest'
import { Battle } from '@salt/sim'
import type { SimGroup } from '@salt/sim'
// Straight from the source: these are the sim's internal spacing contract,
// not something the rest of the app has any business reading.
import {
  CELL_SIZE,
  LINE_SPACING,
  MAX_BODY_RADIUS,
  MAX_CONTACT_DISTANCE,
  ROW_SPACING,
} from '../src/battle.js'
import { GOLDEN_CASES } from './golden.js'

/**
 * Golden-seed replay. See golden.ts for why these exist and what determinism
 * tests do NOT cover.
 *
 * Hashes are sampled mid-battle as well as at the end. A final-state-only
 * fixture can pass while the fight that produced it looks completely
 * different — two runs can converge on the same survivors by different routes
 * — and mid-battle samples are what catch a movement or targeting change.
 *
 * A FAILURE HERE MEANS COMBAT BEHAVIOUR CHANGED. That is sometimes the point
 * of the commit. It is never something to fix by pasting in the new number
 * quietly: say what moved and why, then re-record with `npm run sim:golden`.
 */
const EXPECTED: Record<
  string,
  { t20: number; t60: number; t150: number; finalHash: number; ticks: number; winner: number }
> = {
  // Re-recorded for the crit roll: a new rng.float() draw per swing shifts
  // every subsequent roll in the same battle, so mid/late hashes and even
  // tick counts move even though nothing about movement or targeting did.
  even: {
    t20: 3410066792,
    t60: 987613432,
    t150: 322035903,
    finalHash: 3834414113,
    ticks: 496,
    winner: 0,
  },
  lopsided: {
    t20: 3926206773,
    t60: 2659194258,
    t150: 3246300347,
    finalHash: 42474071,
    ticks: 188,
    winner: 0,
  },
  ranged: {
    t20: 3850142319,
    t60: 3452493697,
    t150: 229716419,
    finalHash: 2642510307,
    ticks: 248,
    winner: 0,
  },
  mixed: {
    t20: 1388987572,
    t60: 874963972,
    t150: 1921991970,
    finalHash: 604152171,
    ticks: 762,
    winner: 0,
  },
}

describe('golden-seed replay', () => {
  for (const c of GOLDEN_CASES) {
    it(`replays "${c.name}" exactly`, () => {
      const want = EXPECTED[c.name]
      const b = new Battle({ seed: c.seed, groups: c.groups as never })

      for (const t of [20, 60, 150] as const) {
        while (b.tick < t && !b.finished) b.step()
        expect(b.hash(), `${c.name} diverged by tick ${t}`).toBe(want[`t${t}` as const])
      }

      const ticks = b.run()
      expect(b.hash(), `${c.name} final state changed`).toBe(want.finalHash)
      expect(ticks).toBe(want.ticks)
      expect(b.winner).toBe(want.winner)
    })
  }
})

/**
 * The spacing constants are not independent — three of them have to clear the
 * same distance, and each one fails silently on its own: bodies clip through
 * each other, or a formation spawns inside itself and spends its opening
 * ticks shoving apart instead of advancing.
 *
 * Nothing in the sim reads these at runtime to check them, so this is the
 * check. It costs nothing and it is the difference between "the line looks
 * wrong" and knowing which number moved.
 */
describe('spacing invariants', () => {
  it('sizes the spatial grid to at least the contact distance', () => {
    // separate() compares a cell against itself and four forward neighbours,
    // so anything that can interact further than one cell is never tested.
    expect(CELL_SIZE).toBeGreaterThanOrEqual(MAX_CONTACT_DISTANCE)
  })

  it('spawns formations already clear of each other', () => {
    expect(ROW_SPACING).toBeGreaterThanOrEqual(MAX_CONTACT_DISTANCE)
    expect(LINE_SPACING).toBeGreaterThanOrEqual(ROW_SPACING)
  })

  it('refuses a body wider than the grid can separate', () => {
    const big = {
      ...(GOLDEN_CASES[0].groups[0] as SimGroup),
      stats: { ...GOLDEN_CASES[0].groups[0].stats, radius: MAX_BODY_RADIUS + 1 },
    }
    expect(() => new Battle({ seed: 1, groups: [big] })).toThrow(/MAX_BODY_RADIUS/)
  })
})
