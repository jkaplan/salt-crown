import { Rng } from '@salt/sim'
import { OFFICER_RANKS_BY_ID, rollOfficer } from './officers.js'
import type { Officer } from './officers.js'
import { potentialCost, rollPotential } from './potentials.js'

/** Fraction of shop standouts that arrive already graded. */
const APPRAISED_STOCK_CHANCE = 0.25
import type { Potential } from './potentials.js'
import { MUTANT_TYPES, TRUEKIN_TYPES } from './units.js'
import { squadCost } from './roster.js'

/**
 * A batch of bodies. Mutant batches come with one or two Potentials — the
 * standouts that came out with something useful — and the rest is fodder.
 *
 * That's the lottery: you're mostly buying the Potentials, and the fodder is
 * what comes in the same crate. True Kin batches have no Potentials, because
 * True Kin do not mutate.
 */
export interface SquadOffer {
  kind: 'squad'
  id: string
  typeId: number
  count: number
  potentials: Potential[]
  cost: number
}

export interface OfficerOffer {
  kind: 'officer'
  id: string
  officer: Officer
  cost: number
}

export type Offer = SquadOffer | OfficerOffer

function newId(rng: Rng, prefix: string): string {
  return `${prefix}${rng.next().toString(36)}`
}

function rollSquadOffer(rng: Rng, encounterIndex: number): SquadOffer {
  // True Kin get commoner later, when you can actually afford them.
  const truekinChance = 0.2 + encounterIndex * 0.05
  const isTrueKin = rng.float() < truekinChance
  const pool = isTrueKin ? TRUEKIN_TYPES : MUTANT_TYPES
  const type = pool[rng.int(pool.length)]

  const count = isTrueKin ? 4 + rng.int(7) : 10 + rng.int(13)

  // Roughly one standout per dozen bodies, sometimes two, sometimes none.
  const potentials: Potential[] = []
  if (!isTrueKin) {
    const howMany = rng.float() < 0.18 ? 0 : rng.float() < 0.3 ? 2 : 1
    for (let i = 0; i < howMany; i++) {
      const p = rollPotential(rng, type.id, encounterIndex)
      // Some sellers have had their stock graded and charge for the certainty.
      // The rest is blind, priced on the average, and is where the money is
      // made or lost.
      potentials.push(rng.float() < APPRAISED_STOCK_CHANCE ? { ...p, appraised: true } : p)
    }
  }

  let cost = squadCost(type.id, count)
  // A standout is priced on what it can become, not just what it is.
  for (const p of potentials) cost += potentialCost(p, type.cost)

  return {
    kind: 'squad',
    id: newId(rng, 'o'),
    typeId: type.id,
    count,
    potentials,
    cost: Math.round(cost),
  }
}

/** Four batches and one officer, rerolled at every camp. */
export function rollOffers(rng: Rng, encounterIndex: number): Offer[] {
  const offers: Offer[] = []
  for (let i = 0; i < 4; i++) offers.push(rollSquadOffer(rng, encounterIndex))

  const officer = rollOfficer(rng, newId(rng, 'off'))
  const rank = OFFICER_RANKS_BY_ID.get(officer.rankId)
  offers.push({
    kind: 'officer',
    id: newId(rng, 'o'),
    officer,
    cost: rank?.cost ?? 100,
  })

  return offers
}
