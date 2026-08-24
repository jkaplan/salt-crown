import type { GroupResult } from '@salt/sim'

/**
 * Why the battle went the way it did, in a sentence.
 *
 * This exists because of a real report: "I had significantly more fighters and
 * it's really hard to tell why I lost." That is not a reporting gap, it is the
 * game's three least visible mechanics all being invisible at once:
 *
 *   armour     is FLAT reduction, so a Chaff swinging 5 into 7 armour lands 1.
 *              Bringing twice as many bodies changes nothing at all. This is
 *              the usual answer, and until now the sim discarded the evidence
 *              at the moment it computed it.
 *   morale     is a damage multiplier, not an exit. A mutant squad at 0.35
 *              discipline that has lost half its bodies swings at 0.68 and
 *              keeps falling — so a big fragile force out-collapses a small
 *              steady one while still looking like it is winning on numbers.
 *   accuracy   is checked against evade, and a whole line of misses looks
 *              exactly like a line that is fighting.
 *
 * A table of numbers does not fix this, because the player has to already
 * know which number matters. So the report leads with the dominant cause
 * stated plainly, and puts the number that proves it underneath.
 *
 * Everything here is DERIVED from what the sim recorded. Nothing is guessed,
 * and if the numbers disagree with the sentence, the sentence is wrong.
 */
export interface Postmortem {
  /** The one-line answer. */
  verdict: string
  /** The number that backs it, already phrased. */
  evidence: string
  /** Which mechanic dominated. Lets the UI colour it. */
  cause: 'armour' | 'morale' | 'accuracy' | 'numbers' | 'even'
}

function sum(rows: GroupResult[], pick: (r: GroupResult) => number): number {
  let total = 0
  for (const r of rows) total += pick(r)
  return total
}

/** Bodies-weighted mean effectiveness at the end. */
function endMorale(rows: GroupResult[]): number {
  const started = sum(rows, (r) => r.started)
  if (started === 0) return 1
  return sum(rows, (r) => r.endEffectiveness * r.started) / started
}

/**
 * How steady a side actually was, recovered from what it ended on.
 *
 * Effectiveness is `discipline + (1 - discipline) x alive/started`, so a side
 * that lost badly always ends low — which is why "your line folded" fired on
 * every close defeat, including a 40 v 40 mirror match where nothing about
 * morale distinguished the two sides at all. A verdict that is true of every
 * loss explains none of them.
 *
 * Inverting for discipline is what separates "you were fragile" from "you
 * lost". Two sides that fold identically under identical losses have the same
 * number here, and the morale verdict correctly stays silent.
 */
function impliedDiscipline(rows: GroupResult[]): number {
  const started = sum(rows, (r) => r.started)
  if (started === 0) return 1
  let total = 0
  let weight = 0
  for (const r of rows) {
    if (r.started === 0) continue
    const alive = r.survived / r.started
    // At full strength effectiveness says nothing about discipline: the term
    // it multiplies is zero. Skip rather than divide by almost nothing.
    if (alive > 0.95) continue
    total += ((r.endEffectiveness - alive) / (1 - alive)) * r.started
    weight += r.started
  }
  return weight === 0 ? 1 : total / weight
}

/**
 * Thresholds are deliberately conservative.
 *
 * A postmortem that fires on every battle is noise, and one that names a cause
 * that was not the cause is worse than silence — the player will act on it.
 * When nothing dominates, say so.
 */
const ARMOUR_DOMINANT = 0.4
const MORALE_DOMINANT = 0.6
/** How much steadier they have to be before it counts as the reason. */
const MORALE_GAP = 0.15
const ACCURACY_DOMINANT = 0.45
const NUMBERS_EDGE = 1.35

export function postmortem(
  player: GroupResult[],
  enemy: GroupResult[],
  won: boolean,
): Postmortem {
  const dealt = sum(player, (r) => r.damageDealt)
  const blocked = sum(player, (r) => r.damageBlocked)
  const swings = sum(player, (r) => r.swings)
  const hits = sum(player, (r) => r.hits)

  const startedUs = sum(player, (r) => r.started)
  const startedThem = sum(enemy, (r) => r.started)

  // Of everything the warband swung, how much armour ate before it landed.
  const blockedShare = dealt + blocked > 0 ? blocked / (dealt + blocked) : 0
  const missShare = swings > 0 ? 1 - hits / swings : 0
  const morale = endMorale(player)
  const theirMorale = endMorale(enemy)
  const steadiness = impliedDiscipline(player)
  const theirSteadiness = impliedDiscipline(enemy)
  const outnumbered = startedThem > 0 ? startedUs / startedThem : 1


  const pct = (n: number) => `${Math.round(n * 100)}%`

  /*
   * Ordered by how badly the player needs to hear it, not by magnitude.
   * Armour first: it is the only one where the obvious response — bring more
   * bodies — actively makes things worse.
   */
  if (blockedShare >= ARMOUR_DOMINANT) {
    return {
      cause: 'armour',
      verdict: won
        ? 'Their armour blunted most of what you swung. You won through anyway.'
        : 'Their armour blunted you. More bodies would not have helped.',
      evidence: `${pct(blockedShare)} of your damage was stopped by armour before it landed. Armour is flat reduction — bodies that hit for less than it do almost nothing, however many of them there are.`,
    }
  }

  /*
   * Fragility, not defeat. The steadiness comparison is what makes this a
   * cause rather than a restatement of the outcome — see impliedDiscipline.
   */
  if (
    morale <= MORALE_DOMINANT &&
    steadiness < theirSteadiness - MORALE_GAP &&
    outnumbered >= 1 / NUMBERS_EDGE
  ) {
    return {
      cause: 'morale',
      verdict: won
        ? 'Your line was folding as it won.'
        : 'Your line folded before it was outfought.',
      evidence: `Your squads finished swinging at ${pct(morale)} strength against their ${pct(theirMorale)}, and they hold far better than you do under the same losses. Morale is a damage multiplier here — a big fragile force collapses faster than a small steady one, so numbers do not save it.`,
    }
  }

  if (missShare >= ACCURACY_DOMINANT) {
    return {
      cause: 'accuracy',
      verdict: won ? 'You mostly missed, and still took it.' : 'You could not hit them.',
      evidence: `${pct(missShare)} of your swings missed. Accuracy is checked against evade, and a line that is missing looks exactly like a line that is fighting.`,
    }
  }

  if (outnumbered < 1 / NUMBERS_EDGE) {
    return {
      cause: 'numbers',
      verdict: won ? 'Outnumbered, and it still went your way.' : 'You were simply outnumbered.',
      evidence: `${startedUs} against ${startedThem}. Combat rewards numbers superlinearly — twice the bodies is closer to four times the force.`,
    }
  }

  if (outnumbered > NUMBERS_EDGE) {
    return {
      cause: won ? 'numbers' : 'even',
      verdict: won
        ? 'Weight of numbers did it.'
        : 'You had the numbers and lost anyway — it was their quality.',
      evidence: `${startedUs} against ${startedThem}, and you still finished at ${pct(morale)} strength. When numbers do not decide it, the difference is per-body: armour, damage, and what your leaders are carrying.`,
    }
  }

  return {
    cause: 'even',
    verdict: won ? 'A close one.' : 'It was close.',
    evidence: `${startedUs} against ${startedThem}, ${pct(blockedShare)} of your damage stopped by armour, ${pct(missShare)} of your swings missed. Nothing dominated.`,
  }
}
