import type { Lineage } from '@salt/sim'
import type { Squad, Warband } from './roster.js'
import { unitType } from './roster.js'

/**
 * Water — docs/V0-DESIGN.md §8.
 *
 * Salvage is what you spend. Water is what you owe, every march, whether or
 * not you did anything with it. That difference is the whole point: Salvage
 * rewards a good decision, Water punishes a big one, and a warband that only
 * ever grows eventually cannot drink.
 *
 * It is the only thing in V0 that makes a body a liability rather than an
 * asset, which is what turns recruiting from "can I afford this" into "do I
 * want to carry this". Without it there is no reason to ever sell, bench, or
 * refuse a squad.
 */

/**
 * Water per body per march, by lineage.
 *
 * Flat per body rather than per unit type: the design table (§3) is written
 * by lineage, and a Chaff and a Sludge-Waller drinking different amounts is a
 * distinction the player cannot see or act on. The scaling that matters is
 * the roster multiplier below, not the per-body rate.
 *
 * Machines are the outlier by design — §3 calls their Water cost "brutal",
 * and it is the price of them being far above everything else in a fight. In
 * V0 Coolant is folded into Water, so this single number carries it.
 */
export const WATER_PER_BODY: Record<Lineage, number> = {
  mutant: 1,
  truekin: 1.2,
  machine: 3,
}

/**
 * The superlinear term — §8's `(1 + roster / 40)`.
 *
 *   20 bodies  x1.50
 *   60 bodies  x2.50
 *  120 bodies  x4.00
 *
 * A hundred and twenty bodies do not cost six times what twenty do. They cost
 * sixteen. That curve is the roster cap: there is no hard limit on warband
 * size anywhere in the game, and there does not need to be one — Battle
 * Brothers holds its roster in check the same way (§1).
 */
export const ROSTER_SCALE_DIVISOR = 40

/** Named tier included: an Officer still drinks, even without a squad. */
export function waterUpkeep(w: Warband): number {
  let raw = 0
  let bodies = 0

  for (const sq of w.squads) {
    raw += WATER_PER_BODY[unitType(sq.typeId).lineage] * sq.count
    bodies += sq.count
  }
  for (const p of w.prospects) {
    raw += WATER_PER_BODY[unitType(p.typeId).lineage]
    bodies++
  }
  for (let i = 0; i < w.officers.length; i++) {
    raw += WATER_PER_BODY.truekin
    bodies++
  }

  return Math.round(raw * (1 + bodies / ROSTER_SCALE_DIVISOR))
}

/**
 * Morale lost per body that walks. Multiplied by the number who left, then
 * folded into the run's morale on top of the salvage-and-morale events.
 *
 * Small on purpose: watching nine people leave should sting a little, and a
 * mass desertion should sting a lot, without one bad march pinning morale at
 * the floor for the rest of the run.
 */
export const MORALE_PER_DESERTER = 0.004

export interface DesertionResult {
  squads: Squad[]
  /** Bodies that walked. 0 when the water covered it. */
  deserted: number
  /** Water actually spent — never more than what was in the cistern. */
  spent: number
  /** Water left after paying. */
  remaining: number
}

/**
 * Pay the march's water, and let people leave if it does not cover.
 *
 * §8: "Water shortfall causes desertion before it causes death. Attrition
 * should feel like a squeeze, never an execution." So:
 *
 *   - Only FODDER walks. Officers and Prospects are the named tier and the
 *     permadeath tier; losing a Firstborn you grew over ten battles to an
 *     arithmetic shortfall would be the most arbitrary death in the game.
 *   - Deserters come off the LARGEST squad each time, so a shortfall thins
 *     the warband instead of deleting whichever squad happened to be listed
 *     first. A unit type vanishing to thirst is an execution.
 *   - They leave one at a time until what remains can be watered. The cost
 *     depends on the roster, so shrinking the roster shrinks the bill — this
 *     converges rather than needing a closed form, and it is bounded by the
 *     roster size.
 *
 * Note this can bottom out with fodder gone and named bodies still thirsty.
 * That is the correct end state: the warband is down to the people who will
 * not leave, and it has no water. The run is in serious trouble and nothing
 * has been executed to say so.
 */
export function payWater(w: Warband): DesertionResult {
  let squads = w.squads
  let deserted = 0
  let cost = waterUpkeep(w)

  if (cost <= w.water) {
    return { squads, deserted, spent: cost, remaining: w.water - cost }
  }

  // Copy once, then mutate the copy — this runs between battles, not in a
  // tick loop, but there is no reason to rebuild the array per deserter.
  squads = squads.map((sq) => ({ ...sq }))

  for (;;) {
    let biggest = -1
    for (let i = 0; i < squads.length; i++) {
      if (squads[i].count > 0 && (biggest === -1 || squads[i].count > squads[biggest].count)) {
        biggest = i
      }
    }
    if (biggest === -1) break // nothing left that is willing to leave

    squads[biggest].count--
    deserted++
    cost = waterUpkeep({ ...w, squads })
    if (cost <= w.water) break
  }

  squads = squads.filter((sq) => sq.count > 0)
  const spent = Math.min(cost, w.water)
  return { squads, deserted, spent, remaining: Math.max(0, w.water - spent) }
}

/** How the cistern reads at a glance. Never a bare ratio. */
export function waterState(water: number, upkeep: number): 'short' | 'tight' | 'held' {
  if (water < upkeep) return 'short'
  if (water < upkeep * 2) return 'tight'
  return 'held'
}
