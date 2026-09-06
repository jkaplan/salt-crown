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
  forced: 1.15,
  killing: 1.35,
}

/**
 * Days the gap moves over one march. Positive means the quarry gained ground.
 *
 * Column loses a day every time, which is what stops the safe option being
 * free: walk gently for long enough and the trail goes cold on its own.
 */
export const PACE_GAP_MOVE: Record<Pace, number> = {
  column: +2,
  forced: -1,
  killing: -3,
}

/** How far ahead the quarry is when a run opens. */
export const STARTING_GAP = 12

/** At this many days behind, the trail is cold and the quarry is gone. */
export const TRAIL_LOST_AT = 24

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
  /** Who has fallen behind and might yet catch up. */
  stragglers: Straggler[]
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

/**
 * What the road takes — docs/plans/travel.md step 3.
 *
 * Two costs, both routed through machinery that already exists rather than
 * invented beside it. A hard pace advances the wound ladder; bodies fall
 * behind at a rate set by the discipline stat.
 *
 * Straggling was historically the dominant cost of hard marching — Lee lost a
 * large share of his army to it before Antietam, and Napoleon's 1812 campaign
 * lost far more men to straggling and exhaustion than to any battle. Crucially
 * it is a DISCIPLINE problem before it is a fatigue one, which is why keying
 * it to the stat the game already has is honest rather than merely tidy.
 *
 * PLACEHOLDER NUMBERS. Tune against sim:campaign, never by feel.
 */

/**
 * Chance per leg that a named body's wound worsens a rung.
 *
 * Column is 0 and that is load-bearing, not decorative: the harness walks
 * Column for every recorded figure, so the road must not draw from the seeded
 * stream at all there. Rolling zeroes is not the same as not rolling.
 */
export const PACE_WOUND_CHANCE: Record<Pace, number> = {
  column: 0,
  forced: 0.06,
  killing: 0.14,
}

/**
 * Share of a squad that falls behind on one leg, BEFORE discipline is applied.
 * The real rate is this times `1 - discipline`, so machines (discipline 1)
 * fall out of the formula entirely rather than being special-cased around it.
 */
export const PACE_STRAGGLE_RATE: Record<Pace, number> = {
  column: 0,
  forced: 0.012,
  killing: 0.035,
}

/**
 * Chance a straggler rejoins the column on any later leg.
 *
 * The tail is the whole point: it makes a hard pace a gamble rather than a
 * flat toll, and it makes *arriving early* and *arriving whole* two different
 * things to want.
 */
export const STRAGGLER_RETURN_CHANCE = 0.45

/**
 * How a run finished, when it finished at all.
 *
 * Separate from `outcome` on purpose. `outcome` answers "did the warband
 * survive", which is what every completion figure on record measures and
 * what the harness still counts. This answers "which ending did it reach",
 * which is the question the chase exists to pose.
 */
export type Ending = 'caught' | 'endured'

/** Bodies that fell behind, and the squad they belong to if they catch up. */
export interface Straggler {
  squadId: string
  count: number
}

/** Does this pace cost anything beyond water? */
export function paceIsHard(pace: Pace): boolean {
  return PACE_STRAGGLE_RATE[pace] > 0 || PACE_WOUND_CHANCE[pace] > 0
}
