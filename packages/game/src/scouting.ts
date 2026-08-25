import type { Warband } from './roster.js'
import { findOfficer, resolveSquadStats, unitType } from './roster.js'

/**
 * A read on what's waiting, before you march — requested directly: "it does
 * feel like I'm a bit lost going into a battle."
 *
 * Composition-under-pressure only feels strategic if you can react to what's
 * coming. Before this, the only thing shown pre-march was a body COUNT —
 * useless for the one thing armour makes true throughout this game: a big
 * warband can be nearly worthless against the wrong opponent (see
 * postmortem.ts's whole reason for existing). This reads the enemy's actual
 * resolved stats — the same ones the sim will fight with — and reports them
 * as words, the same way every other number in this game is reported
 * (moraleWord, waterState, conditionWord): a raw armour average means
 * nothing to anyone, "heavily armoured" tells you to bring quality, not bulk.
 *
 * Deliberately does NOT reveal named individuals, exact stat lines, or
 * anything the player couldn't reasonably read off a warband sighted at a
 * distance. This is intelligence, not a wiki page.
 */
export interface ScoutingReport {
  bodies: number
  /** Weighted average armour across the enemy's squads, bucketed to a word. */
  armorWord: string
  /** True Kin share of the enemy's body count, bucketed to a word. */
  mixWord: string
  /** Whether an Officer leads any part of the enemy line. */
  led: boolean
}

/**
 * Buckets measured against real generated encounters (tools/_scout.ts, not
 * checked in) rather than picked by feel — the same discipline that the
 * boss and the legendaries both needed a retune to actually follow the first
 * time. Weighted average armour across warband/wasteland encounters splits
 * 29% / 36% / 22% / 13% across these four bands, so none of them go unused.
 */
const ARMOR_BANDS: { upTo: number; word: string }[] = [
  { upTo: 0.5, word: 'barely armoured' },
  { upTo: 2.5, word: 'lightly armoured' },
  { upTo: 6, word: 'armoured' },
  { upTo: Infinity, word: 'heavily armoured' },
]

export function armorWord(weightedArmor: number): string {
  for (const band of ARMOR_BANDS) if (weightedArmor < band.upTo) return band.word
  return ARMOR_BANDS[ARMOR_BANDS.length - 1].word
}

/**
 * "Pure mutant" is the single most common reading — 62% of real encounters
 * carry zero True Kin, which is the actual difficulty curve (truekinChance
 * in encounters.ts scales up with act) rather than a calibration artifact.
 * Worth stating plainly rather than folding into "mostly mutant": it is a
 * real, different signal — no officer-grade discipline anywhere possible.
 */
export function mixWord(truekinShare: number): string {
  if (truekinShare <= 0) return 'all mutant, no True Kin'
  if (truekinShare < 0.3) return 'mostly mutant'
  if (truekinShare < 0.65) return 'a real mix'
  return 'True Kin heavy'
}

export function scoutEnemy(enemy: Warband): ScoutingReport {
  let squadBodies = 0
  let armorSum = 0
  let truekinBodies = 0

  for (const sq of enemy.squads) {
    if (sq.count <= 0) continue
    // The officer this squad's OWN leader grants — never the player's,
    // never guessed. Exactly what the sim will actually fight with.
    const officer = findOfficer(enemy, sq)
    const stats = resolveSquadStats(sq, officer, null)
    armorSum += stats.armor * sq.count
    squadBodies += sq.count
    if (unitType(sq.typeId).lineage === 'truekin') truekinBodies += sq.count
  }

  // Prospects are individually tracked but rarely change the read enough to
  // earn their own line — folded into the body count only, same as the sim
  // folds them into the field as their own small groups. Kept out of the
  // armour/mix averages, which describe the SQUADS specifically.
  const bodies = squadBodies + enemy.prospects.length

  if (bodies === 0) {
    return { bodies: 0, armorWord: armorWord(0), mixWord: mixWord(0), led: false }
  }

  return {
    bodies,
    armorWord: armorWord(squadBodies > 0 ? armorSum / squadBodies : 0),
    mixWord: mixWord(squadBodies > 0 ? truekinBodies / squadBodies : 0),
    led: enemy.officers.length > 0,
  }
}
