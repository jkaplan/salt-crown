/**
 * The march — docs/plans/travel.md.
 *
 * The road between camps used to be an instant cut: `march()` charged Water
 * and started a battle. It is now a walk of several legs at a chosen pace,
 * with something ahead of you that is also moving.
 *
 * The chase is what makes pace mean anything. Oregon Trail's pace system
 * trades health and supply for *calendar days*, and it only works because
 * winter is coming; Salt Crown has no calendar and never will. A quarry that
 * is running supplies its own clock — push harder, close the gap; take it easy
 * on the wounded, and it widens. So the gap is the pressure, and no deadline
 * has to be invented beside it.
 *
 * Note the direction, because the first draft of this plan had it backwards:
 * pushing costs MORE supply, not less. Oregon Trail charges food per mile and
 * raises the rate with pace — grueling 4/mile against normal's 2 — so a hard
 * march costs roughly double for the same ground. What it buys is ground, not
 * savings.
 *
 * PLACEHOLDER NUMBERS throughout. Tune against sim:campaign, never by feel.
 */

/**
 * Real marching terms, so none of them needs a tooltip. "Forced march" is the
 * actual phrase for covering ground faster than is good for you, and "a
 * killing pace" says exactly what the third one does.
 */
export type Pace = 'column' | 'forced' | 'killing'

export const PACES: readonly Pace[] = ['column', 'forced', 'killing']

/** How a pace reads on a screen, when there is one. */
export const PACE_NAMES: Record<Pace, string> = {
  column: 'Column',
  forced: 'Forced march',
  killing: 'Killing pace',
}

/**
 * Legs in one march. Fixed for now, deliberately: it keeps every reading in
 * sim:campaign comparable, and the number is trivial to change once there is
 * an opinion about whether the road feels thin or draggy.
 *
 * Variable length is a later change and safe only on one condition — that the
 * distance is visible in camp BEFORE the buy. A hidden variable distance is an
 * unearned run-killer; a visible one is a forecast you plan around.
 */
export const LEGS_PER_MARCH = 3

/**
 * Water for the whole march, as a multiple of the ordinary upkeep bill.
 *
 * Column is 1 exactly, and that is load-bearing: a player who picks nothing
 * different must pay nothing different, or this is a silent rebalance wearing
 * a new feature's clothes.
 */
export const PACE_WATER_MULT: Record<Pace, number> = {
  column: 1,
  forced: 1.4,
  killing: 2,
}

/**
 * Days the gap moves over one march. Positive means the quarry gained ground.
 *
 * Column loses a day every time, which is what stops the safe option being
 * free: walk gently for long enough and the trail goes cold on its own.
 */
export const PACE_GAP_MOVE: Record<Pace, number> = {
  column: +1,
  forced: 0,
  killing: -1,
}

/** How far ahead the quarry is when a run opens. */
export const STARTING_GAP = 6

/** At this many days behind, the trail is cold and the quarry is gone. */
export const TRAIL_LOST_AT = 12

/**
 * What a warband is carrying while it walks.
 *
 * The water bill is fixed when you set out rather than recomputed per leg. You
 * loaded the wagons for this trip at this pace; bodies lost along the way do
 * not make the crossing retroactively cheaper.
 */
export interface TravelState {
  pace: Pace
  legsDone: number
  /**
   * What the crossing was quoted at when the warband set out — the number a
   * player is shown before committing to a pace.
   *
   * A quote, not a contract. Each leg is charged against the warband that is
   * actually walking it, so bodies lost on the road make the rest of the road
   * cheaper. Fixing the bill instead was tried and measured: it compounds a
   * shortfall, because a shrinking column keeps paying the rate it was quoted
   * for a bigger one. Bot completion fell from 10.3% to 3.0% on 300 runs.
   */
  waterBill: number
  /**
   * What the road has actually taken so far. Accumulated per leg because the
   * battle report still wants one number for the crossing, and by the time it
   * is asked for, the legs that spent it are gone.
   */
  spent: number
  deserted: number
}

/** The march's whole Water bill, at a given pace. */
export function marchWaterBill(upkeep: number, pace: Pace): number {
  return Math.round(upkeep * PACE_WATER_MULT[pace])
}

/**
 * What this one leg costs, given the bill and how many legs are already done.
 *
 * Charged as the difference between two cumulative shares rather than a flat
 * third, so the legs always sum to exactly the bill however it divides. At
 * Column that means the march costs precisely one ordinary upkeep, which is
 * the promise the whole design rests on.
 */
export function legWaterCost(bill: number, legsDone: number): number {
  const soFar = Math.round((bill * legsDone) / LEGS_PER_MARCH)
  const after = Math.round((bill * (legsDone + 1)) / LEGS_PER_MARCH)
  return after - soFar
}
