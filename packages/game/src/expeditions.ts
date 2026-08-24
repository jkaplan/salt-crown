import { Rng } from '@salt/sim'
import { escalateWound } from './wounds.js'
import type { Prospect } from './prospects.js'

/**
 * Expeditions — docs/V0-DESIGN.md §9.
 *
 * | Action   | Return                      | Risk                  |
 * |----------|-----------------------------|-----------------------|
 * | Scavenge | ~100% expected value, stable | ~3% injury           |
 * | Delve    | ~220% EV, high variance      | ~18% injury, ~5% death|
 *
 * Survey is cut from V0 — it is an information action and V0 has almost no
 * hidden state worth paying to reveal. (Prospect capacity is the exception,
 * and the Assayer already sells that.)
 *
 * The crew is PROSPECTS. Not fodder, which has no individual identity to
 * carry an injury; not Officers, because True Kin nobility crawling ruins for
 * scrap is off-tone and would need a second "away" flag on top of the one
 * Prospects already have.
 *
 * Using Prospects also puts the decision where it hurts. A leading Prospect
 * leaks its mutations to twenty bodies, so the crew you most want in a ruin is
 * exactly the crew you most want on the field. That is the whole point: §9's
 * real cost is not the risk, it is that "the crew misses the next battle".
 */
export type Verb = 'scavenge' | 'delve'

export interface Expedition {
  verb: Verb
  /** Prospect ids. They do not deploy while away. */
  crew: string[]
  /** Water paid to send them. Refunded in full if they are recalled. */
  staked: number
}

/** What a crew brought back, resolved when the next camp opens. */
export interface ExpeditionResult {
  verb: Verb
  /** What it cost to send them, so the result can be read as a return. */
  staked: number
  salvage: number
  water: number
  /** Bodies found in the ruin. Delve only. */
  found: Prospect[]
  /** Crew who came back hurt, by name. */
  injured: string[]
  /** Crew who did not come back at all. Delve only. */
  lost: string[]
  /** One line of what the ruin was. */
  flavour: string
}

export const MAX_CREW = 3

/**
 * What it costs to outfit one body — rope, lamps, a week of rations, whatever
 * the crew is expected to carry back with. Paid in SALVAGE.
 *
 * Two wrong versions came before this one, and both were measured rather than
 * argued:
 *
 *   no cost at all      delving every camp took the greedy bot from 20.8%
 *                       completion to 66.0%. Benching three Prospects out of
 *                       a fifty-body warband is not a cost.
 *   paid in Water       scavenging dropped the same bot to 0.0%. Water is the
 *                       binding constraint, so ANY trade of water for salvage
 *                       is strictly bad and the whole verb became a trap.
 *
 * The second failure is the useful one. It says what expeditions are FOR:
 * salvage is the resource you end up unable to spend, because Water caps how
 * many bodies you can carry. So the crew is outfitted with salvage, and what
 * they bring back is the thing you actually ran out of.
 */
const OUTLAY = (i: number) => 35 + 14 * i

/** Delving goes deeper and carries more. */
const DELVE_OUTLAY_MULT = 1.35

/**
 * Water per salvage staked, scavenging.
 *
 * Encounters pay about 1.9 salvage per water, so break-even against simply
 * winning the fight is 0.53. Slightly above it: scavenging should be worth
 * doing when you are water-poor and salvage-rich, and never better than
 * fighting.
 */
const SCAVENGE_RATE = 0.62

/**
 * Salvage per salvage staked, delving, BEFORE the ruin multiplier. With
 * delveMultiplier averaging ~2.29 this lands around 1.6x on the outlay —
 * good money, at a 5% chance per head of not coming back.
 */
const DELVE_RATE = 0.7

/** A delve turns up cisterns and sealed tanks too, though it is not the point. */
const DELVE_WATER_RATE = 0.12

/** Chance per member. Scavenging is safe work in a dangerous world. */
const SCAVENGE_INJURY = 0.03

/**
 * Delve pays about 2.2x scavenging on average and almost never pays that.
 *
 * The multiplier is rolled once for the whole expedition rather than per
 * member, because a ruin is either worth crawling or it is not — averaging
 * three independent rolls would sand the variance off and turn the gamble
 * into an annuity, which is exactly what §9 says it must not be.
 */
const DELVE_INJURY = 0.18
const DELVE_DEATH = 0.05

/** Chance a delve turns up a body somebody else left behind. */
const DELVE_PROSPECT_CHANCE = 0.3

const SCAVENGE_FLAVOUR = [
  'A collapsed depot, picked over twice already. They found the third layer.',
  'Rail ties, cable, and a cistern that had not cracked. Unglamorous.',
  'Two days of walking and one afternoon of actual work.',
  'A caravan that did not make it. Nobody had come back for it.',
  'The wind had uncovered something. It will bury it again by winter.',
]

const DELVE_FLAVOUR = [
  'Down past the water table, where the pumps used to run.',
  'A House sublevel, sealed from the inside. They found out why.',
  'Something had been living in it. It is not living in it now.',
  'Six flights down the stairwell still held. The seventh did not.',
  'The lights came on when they entered. That was not reassuring.',
  'A grading floor, benches still laid out, ledgers still open.',
]

/**
 * A ruin's haul multiplier.
 *
 * Deliberately not a normal distribution. A delve is mostly a disappointment
 * with a long tail, which is what makes the memorable ones memorable — a
 * bell curve around 2.2x would just be scavenging with extra steps.
 */
function delveMultiplier(rng: Rng): number {
  const r = rng.float()
  if (r < 0.3) return 0.3 + rng.float() * 0.5 // picked clean
  if (r < 0.8) return 1.4 + rng.float() * 1.4 // worth the walk
  return 3.4 + rng.float() * 2.6 // the one they talk about
}

/**
 * Resolve an expedition.
 *
 * `found` is where bionics and machines will arrive — both are ruin-only by
 * design (§3: Machines are "not purchasable"), so this function is the single
 * door they come through. Today it can only find bodies.
 */
export function resolveExpedition(
  rng: Rng,
  verb: Verb,
  crew: Prospect[],
  encounterIndex: number,
  rollFound: (rng: Rng, index: number) => Prospect,
): { result: ExpeditionResult; crew: Prospect[] } {
  const isDelve = verb === 'delve'
  const mult = isDelve ? delveMultiplier(rng) : 0.9 + rng.float() * 0.2
  const flavourPool = isDelve ? DELVE_FLAVOUR : SCAVENGE_FLAVOUR

  const staked = expeditionCost(verb, crew.length, encounterIndex)
  // Scavenging brings back water and nothing else; delving brings back
  // salvage, a little water, and whatever was down there.
  const salvage = isDelve ? Math.round(staked * DELVE_RATE * mult) : 0
  const water = Math.round(staked * (isDelve ? DELVE_WATER_RATE : SCAVENGE_RATE) * mult)

  const injured: string[] = []
  const lost: string[] = []
  const returned: Prospect[] = []

  for (const p of crew) {
    // Death is rolled first and separately: a body that does not come back
    // cannot also be reported injured, and rolling injury first would let a
    // lucky injury roll shield someone from the death roll.
    if (isDelve && rng.float() < DELVE_DEATH) {
      lost.push(p.name)
      continue
    }
    if (rng.float() < (isDelve ? DELVE_INJURY : SCAVENGE_INJURY)) {
      injured.push(p.name)
      returned.push({ ...p, fielded: true, wound: escalateWound(p.wound, rng) })
    } else {
      returned.push({ ...p, fielded: true })
    }
  }

  const found: Prospect[] = []
  if (isDelve && crew.length > 0 && rng.float() < DELVE_PROSPECT_CHANCE) {
    found.push(rollFound(rng, encounterIndex))
  }

  return {
    result: {
      verb,
      staked,
      salvage,
      water,
      found,
      injured,
      lost,
      flavour: flavourPool[rng.int(flavourPool.length)],
    },
    crew: returned,
  }
}

/** Salvage staked to send this crew. Paid up front, win or lose. */
export function expeditionCost(verb: Verb, crewSize: number, encounterIndex: number): number {
  const per = OUTLAY(encounterIndex) * (verb === 'delve' ? DELVE_OUTLAY_MULT : 1)
  return Math.round(per * crewSize)
}

/** What an expedition is worth on average, for the camp screen's estimate. */
export function expectedHaul(
  verb: Verb,
  crewSize: number,
  encounterIndex: number,
): { salvage: number; water: number } {
  // Matches delveMultiplier's own weighting: 0.3x0.55 + 0.5x2.1 + 0.2x4.7.
  const isDelve = verb === 'delve'
  const mult = isDelve ? 0.3 * 0.55 + 0.5 * 2.1 + 0.2 * 4.7 : 1
  const staked = expeditionCost(verb, crewSize, encounterIndex)
  return {
    salvage: isDelve ? Math.round(staked * DELVE_RATE * mult) : 0,
    water: Math.round(staked * (isDelve ? DELVE_WATER_RATE : SCAVENGE_RATE) * mult),
  }
}

/** Injury and death chance per crew member, for the camp screen. */
export function expeditionRisk(verb: Verb): { injury: number; death: number } {
  return verb === 'delve'
    ? { injury: DELVE_INJURY, death: DELVE_DEATH }
    : { injury: SCAVENGE_INJURY, death: 0 }
}
