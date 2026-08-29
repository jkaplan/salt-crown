import { Rng } from '@salt/sim'
import { OFFICER_RANKS_BY_ID, rollOfficer } from './officers.js'
import type { Officer } from './officers.js'
import { prospectCost, rollProspect } from './prospects.js'

/** Fraction of shop standouts that arrive already graded. */
const APPRAISED_STOCK_CHANCE = 0.25
import type { Prospect } from './prospects.js'
import { MUTANT_TYPES, TRUEKIN_TYPES } from './units.js'
import { squadCost } from './roster.js'

/**
 * A batch of bodies. Mutant batches come with one or two Prospects — the
 * standouts that came out with something useful — and the rest is fodder.
 *
 * That's the lottery: you're mostly buying the Prospects, and the fodder is
 * what comes in the same crate. True Kin batches have no Prospects, because
 * True Kin do not mutate.
 */
export interface SquadOffer {
  kind: 'squad'
  id: string
  typeId: number
  count: number
  prospects: Prospect[]
  cost: number
}

export interface OfficerOffer {
  kind: 'officer'
  id: string
  officer: Officer
  cost: number
}

export type Offer = SquadOffer | OfficerOffer

export function newId(rng: Rng, prefix: string): string {
  return `${prefix}${rng.next().toString(36)}`
}

/**
 * Roll one batch of bodies from a given pool — the recruit lottery itself,
 * with no price attached. `rollSquadOffer` below wraps this with a cost for
 * the standing market; an event that hands a batch over directly (a coffle,
 * a splinter band falling in behind you) calls this the same way and prices
 * it however the event's own copy says to, if it charges for it at all.
 */
export function rollSquadBatch(
  rng: Rng,
  encounterIndex: number,
  pool: 'mutant' | 'truekin',
): { typeId: number; count: number; prospects: Prospect[] } {
  const types = pool === 'truekin' ? TRUEKIN_TYPES : MUTANT_TYPES
  const type = types[rng.int(types.length)]
  const count = pool === 'truekin' ? 4 + rng.int(7) : 10 + rng.int(13)

  // Roughly one standout per dozen bodies, sometimes two, sometimes none.
  const prospects: Prospect[] = []
  if (pool === 'mutant') {
    const howMany = rng.float() < 0.18 ? 0 : rng.float() < 0.3 ? 2 : 1
    for (let i = 0; i < howMany; i++) {
      const p = rollProspect(rng, type.id, encounterIndex)
      // Some sellers have had their stock graded and charge for the certainty.
      // The rest is blind, priced on the average, and is where the money is
      // made or lost.
      prospects.push(rng.float() < APPRAISED_STOCK_CHANCE ? { ...p, appraised: true } : p)
    }
  }

  return { typeId: type.id, count, prospects }
}

function rollSquadOffer(rng: Rng, encounterIndex: number, truekinPremium: number): SquadOffer {
  // True Kin get commoner later, when you can actually afford them.
  const truekinChance = 0.2 + encounterIndex * 0.05
  const isTrueKin = rng.float() < truekinChance
  const { typeId, count, prospects } = rollSquadBatch(
    rng,
    encounterIndex,
    isTrueKin ? 'truekin' : 'mutant',
  )

  let cost = squadCost(typeId, count)
  // A standout is priced on what it can become, not just what it is.
  const baseCost = (isTrueKin ? TRUEKIN_TYPES : MUTANT_TYPES).find((t) => t.id === typeId)!.cost
  for (const p of prospects) cost += prospectCost(p, baseCost)
  /*
   * True Kin will not readily serve under a mutant, and price accordingly.
   *
   * Applied to the TOTAL rather than to the bodies, and only to True Kin
   * batches — a mutant crate costs a mutant the same as it costs anybody. This
   * one multiplier is the entire mechanical difference the Freed Firstborn
   * origin makes to the market, which is what §13 means by the asymmetry
   * being data rather than a system.
   */
  if (isTrueKin) cost *= truekinPremium

  return {
    kind: 'squad',
    id: newId(rng, 'o'),
    typeId,
    count,
    prospects,
    cost: Math.round(cost),
  }
}

/**
 * Four batches and one officer, rerolled at every camp.
 *
 * `truekinPremium` defaults to 1 so every existing call site — the harnesses,
 * the tests, Skirmish — stays valid and keeps meaning "the going rate".
 */
export function rollOffers(rng: Rng, encounterIndex: number, truekinPremium = 1): Offer[] {
  const offers: Offer[] = []
  for (let i = 0; i < 4; i++) offers.push(rollSquadOffer(rng, encounterIndex, truekinPremium))

  const officer = rollOfficer(rng, newId(rng, 'off'))
  const rank = OFFICER_RANKS_BY_ID.get(officer.rankId)
  offers.push({
    kind: 'officer',
    id: newId(rng, 'o'),
    officer,
    // An Officer IS a True Kin, and the most direct case of one being asked
    // to take orders from a mutant.
    cost: Math.round((rank?.cost ?? 100) * truekinPremium),
  })

  return offers
}
