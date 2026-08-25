import { Rng } from '@salt/sim'
import { rollOfficer } from './officers.js'
import { rollProspect } from './prospects.js'
import type { Warband } from './roster.js'
import { squadCost } from './roster.js'
import { MUTANT_TYPES, TRUEKIN_TYPES, UNIT_TYPES } from './units.js'
import { BOSS_TYPES, FAUNA_TYPES } from './wasteland.js'
import { LEGENDARY_TYPES } from './legendaries.js'

/**
 * Fifteen encounters, three acts of five, boss at the end of each —
 * docs/V0-DESIGN.md §12. Target run length is 25-35 minutes, deliberately
 * short: this has to be playable thirty-plus times and every extra minute
 * taxes iteration speed.
 */
export const ENCOUNTERS_PER_RUN = 15
export const ENCOUNTERS_PER_ACT = 5
export const ACTS = 3

export type EncounterKind = 'warband' | 'wasteland' | 'boss' | 'legendary'

export function actOf(index: number): number {
  return Math.min(ACTS - 1, Math.floor(index / ENCOUNTERS_PER_ACT))
}

/** The last encounter of every act is a boss. */
export function isBossIndex(index: number): boolean {
  return index % ENCOUNTERS_PER_ACT === ENCOUNTERS_PER_ACT - 1
}

/**
 * Salvage-equivalent budget per act, as a base and a slope.
 *
 * Written as three bands rather than one polynomial because acts ARE bands —
 * §12 gives enemy counts of 8-20, 30-70 and 90-200+, which is a step function
 * with a ramp inside each step, and pretending otherwise means picking a curve
 * that fits none of the three properly.
 *
 * Bodies land at roughly budget/9.5, which is what these were solved against.
 */
const ACT_BUDGET_BASE = [54, 220, 648]
const ACT_BUDGET_STEP = [14, 61, 144]

/**
 * A boss encounter is a spike, and most of it is one body.
 *
 * The escort exists so the boss is not fighting alone and the field still
 * looks like a battle; it is deliberately a minority of the budget, because
 * §10's brief is that a boss is "clearly not playing the same game" — one
 * enormous problem, not a bigger version of last week.
 */
const BOSS_BUDGET_MULT = 1.5
const BOSS_ESCORT_SHARE = 0.12

/**
 * Legendaries — docs/V0-DESIGN.md §15. NOT a fourth boss tier: a boss is
 * guaranteed, ordered, escalating; a legendary is a chance, taken inside an
 * ordinary wasteland roll, that most runs will simply never hit. Dreaded for
 * the opposite reason a boss is — you never see it coming.
 *
 * The chance is conditional on the wasteland roll already having happened,
 * so it inherits wasteland's own placement rules for free (never the slot
 * before a boss, roughly one wasteland encounter in three) rather than
 * needing a second, separate placement rule to stay consistent with the
 * first.
 */
/*
 * A fixed-power body hits a structurally weaker warband harder than a
 * stronger one in RELATIVE terms, whatever its absolute tuning — measured
 * directly: at 0.16 the Freed Firstborn origin's campaign completion fell
 * from its pre-legendary baseline (~7-9%) to ~3%, while the Scion barely
 * moved. Softening the creatures further to compensate would have blunted
 * them for the origin they were already working for, so the lever is
 * frequency instead — exposure to the risk, not the risk itself.
 */
const LEGENDARY_CHANCE = 0.09
/** A little richer than the budget alone would pay — the "awe" has to show
 * up somewhere the player can see it, and a receipt is where. */
const LEGENDARY_BUDGET_MULT = 1.2

/**
 * M1 fights rival warbands only — built from the same unit pool you recruit
 * from, so the content is nearly free. Wasteland fauna and the bosses from
 * below arrive in M4 (docs/V0-DESIGN.md §10).
 */
const BAND_PREFIX = [
  'Scav-band of', 'The Rust', 'Outriders of', 'The Low', 'Kin of',
  'The Salt', 'Wallers of', 'The Broken', 'Levies of', 'The Pale',
]

const BAND_SUFFIX = [
  'the Weir', 'Chorus', 'Ashfall', 'Gutter', 'the Ninth Gate',
  'Cinder', 'the Drowned Yard', 'Hollowmarch', 'the Red Cistern', 'Thrum',
]

const FLAVOUR = [
  'They were here first, and they intend to say so.',
  'Somebody paid them. Nobody remembers who.',
  'A House quarrel, three generations old, still being settled.',
  'They have been following your dust for two days.',
  'Neither side will remember what this was about.',
  'They want the ruin you were going to want.',
  'A rival levy, drawn up and waiting.',
  'Something drove them up out of the low country.',
]

export interface Encounter {
  index: number
  /** 0, 1 or 2. Acts are five encounters each. */
  act: number
  kind: EncounterKind
  name: string
  flavour: string
  enemy: Warband
  /** Salvage for winning. */
  reward: number
  /** Water for winning. The only source of it in V0 until expeditions land. */
  waterReward: number
  bodies: number
}


const emptyWarband = (): Warband => ({
  squads: [],
  prospects: [],
  officers: [],
  // Enemy bands never march a campaign, so their cistern is inert.
  salvage: 0,
  water: 0,
  bionics: [],
  relics: [],
  machines: [],
  morale: 0,
})

const newId = (rng: Rng) => `e${rng.next().toString(36)}`

/**
 * Which legendary a 'legendary' encounter used, if any — so the caller can
 * record it as seen. Not carried as its own Encounter field: the id is
 * already sitting in enemy.squads[0].typeId, same as a boss's identity is
 * read off the same slot, and a second field would just be a second place
 * for the two to disagree.
 */
export function encounterLegendaryId(e: Encounter): number | null {
  return e.kind === 'legendary' ? e.enemy.squads[0].typeId : null
}

/** Salvage-equivalent budget for an encounter, before the boss multiplier. */
export function encounterBudget(index: number): number {
  const act = actOf(index)
  const step = Math.min(ENCOUNTERS_PER_ACT - 1, index % ENCOUNTERS_PER_ACT)
  return ACT_BUDGET_BASE[act] + step * ACT_BUDGET_STEP[act]
}

/**
 * A rival warband — §10's first pool, and nearly free content because it is
 * built from the same units the player recruits.
 */
function buildWarband(rng: Rng, index: number, budget: number): Warband {
  const w = emptyWarband()
  const truekinChance = 0.1 + actOf(index) * 0.16 + (index % ENCOUNTERS_PER_ACT) * 0.03
  let left = budget
  let guard = 0

  while (left > 25 && guard++ < 20) {
    const isTrueKin = rng.float() < truekinChance
    const pool = isTrueKin ? TRUEKIN_TYPES : MUTANT_TYPES
    const type = pool[rng.int(pool.length)]
    // Act 3 fields levies, not skirmish parties. Scaling the SQUAD size with
    // the act keeps a 180-body band at a readable half-dozen squads instead of
    // twenty identical ones.
    const scale = 1 + actOf(index) * 1.6
    const count = Math.round((isTrueKin ? 3 + rng.int(6) : 8 + rng.int(14)) * scale)
    const cost = squadCost(type.id, count)
    if (cost > left * 1.35) continue

    w.squads.push({ id: newId(rng), typeId: type.id, count, leader: null })
    // Rival bands throw up standouts the same way you do.
    if (!isTrueKin && rng.float() < 0.5) {
      w.prospects.push(rollProspect(rng, type.id, index))
      left -= type.cost * 3
    }
    left -= cost
  }

  // Fallback so an unlucky roll can never produce an empty warband.
  if (w.squads.length === 0) {
    w.squads.push({
      id: newId(rng),
      typeId: MUTANT_TYPES[0].id,
      count: Math.max(6, Math.round(budget / 8)),
      leader: null,
    })
  }

  // Later bands field an officer of their own.
  if (index >= 2 && rng.float() < 0.5) {
    const officer = rollOfficer(rng, `eo${rng.next().toString(36)}`)
    w.officers.push(officer)
    w.squads[0].leader = { kind: 'officer', id: officer.id }
  }

  return w
}

/**
 * Fauna and flora — §10's second pool. Cheap, weird, atmospheric, doing their
 * own thing.
 *
 * Built deliberately unlike a warband: one or two kinds of thing in quantity,
 * no leaders, no mutations, no mixed composition. The difference the player
 * should feel is one of SHAPE, not of stat lines — a beast encounter reads
 * completely differently on the field from a levy drawn up and waiting.
 */
function buildWasteland(rng: Rng, index: number, budget: number): Warband {
  const w = emptyWarband()
  const kinds = 1 + rng.int(2)
  const share = budget / kinds
  const picked = new Set<number>()

  for (let k = 0; k < kinds; k++) {
    let type = FAUNA_TYPES[rng.int(FAUNA_TYPES.length)]
    for (let tries = 0; tries < 4 && picked.has(type.id); tries++) {
      type = FAUNA_TYPES[rng.int(FAUNA_TYPES.length)]
    }
    picked.add(type.id)
    const count = Math.max(3, Math.round(share / type.cost))
    w.squads.push({ id: newId(rng), typeId: type.id, count, leader: null })
  }

  return w
}

/**
 * A boss — §10's third pool. "Bespoke, clearly not playing the same game as
 * everyone else."
 *
 * One body with more HP than its entire escort, so the fight is a siege
 * against a single problem rather than a bigger version of last week. The
 * escort is there so the field still looks like a battle.
 *
 * The boss is picked by ACT, not rolled: the three of them are an escalation,
 * and meeting the Long Gullet at encounter 5 would be a different game.
 */
function buildBoss(rng: Rng, index: number, budget: number): Warband {
  const act = actOf(index)
  const type = BOSS_TYPES[Math.min(BOSS_TYPES.length - 1, act)]
  const w = buildWarband(rng, index, Math.round(budget * BOSS_ESCORT_SHARE))

  // The boss leads the list, so it is the first thing the formation places
  // and the first thing the player's eye lands on.
  w.squads.unshift({ id: newId(rng), typeId: type.id, count: 1, leader: null })
  return w
}

/**
 * A legendary — one body, no escort, and never the same one twice in a run.
 *
 * No escort on purpose: a boss gets one so the field still looks like a
 * battle around a siege; a legendary is the opposite kind of encounter, one
 * dangerous individual met alone on the flats, and giving it a retinue would
 * make it read as a smaller boss instead of its own thing.
 *
 * Falls back to `null` — and the caller falls back to an ordinary wasteland
 * roll — once every legendary has already appeared this run, rather than
 * repeating one. Meeting "the" Widowsalt twice in one run undoes the entire
 * point of the word.
 */
function buildLegendary(
  rng: Rng,
  seenLegendaries: readonly number[],
): { warband: Warband; typeId: number } | null {
  const available = LEGENDARY_TYPES.filter((t) => !seenLegendaries.includes(t.id))
  if (available.length === 0) return null

  const type = available[rng.int(available.length)]
  const w = emptyWarband()
  w.squads.push({ id: newId(rng), typeId: type.id, count: 1, leader: null })
  return { warband: w, typeId: type.id }
}

const WASTELAND_NAMES = [
  'A Pack on the Flats', 'Something in the Wash', 'The Drift',
  'Rooted in the Cut', 'What the Pipes Brought Up', 'A Bad Stretch of Road',
]

const WASTELAND_FLAVOUR = [
  'It is not here for you. That will not help.',
  'They have been following the water, and so have you.',
  'Nothing about this is personal, which somehow makes it worse.',
  'The animals left this stretch two days ago. These are not the animals.',
  'It was already here. It will be here after.',
]

const BOSS_FLAVOUR = [
  'The column stops without being told to.',
  'Everyone has been hearing it for three days and nobody said so.',
  'There is no line to form up against. There is only the one thing.',
]

/**
 * Enemy strength scales by salvage-equivalent budget, which naturally produces
 * escalating body counts — cheap mutants early, True Kin mixed in later.
 *
 * Difficulty is FIXED, never scaled to the player's warband. Rubber-banding
 * would kill the break-run pillar: if being strong doesn't trivialise fights,
 * breaking the game isn't a reward. See docs/V0-DESIGN.md §7.
 *
 * `seenLegendaries` defaults to empty so every existing call site — the
 * harnesses, the tests, the opening camp — stays valid; a caller that never
 * passes it simply never rules a legendary out.
 */
export function generateEncounter(
  rng: Rng,
  index: number,
  seenLegendaries: readonly number[] = [],
): Encounter {
  const act = actOf(index)
  const boss = isBossIndex(index)
  // Fauna are an interruption, not a rotation: about one in three, and never
  // in the slot before a boss, so the act builds toward the thing ending it.
  const wasteland =
    !boss &&
    rng.float() < 0.34 &&
    index % ENCOUNTERS_PER_ACT !== ENCOUNTERS_PER_ACT - 2

  /*
   * A legendary is a sub-roll INSIDE a wasteland roll, not a fourth
   * independent placement rule — it inherits wasteland's own restrictions
   * this way rather than needing to be kept in sync with them by hand.
   *
   * Excluded from the first two encounters specifically. A fixed-power body
   * hits a warband that has had zero camps to build up harder than one with
   * even a little slack in it — measured directly against the Freed
   * Firstborn origin, which starts with no Officers at all: campaign
   * completion for that origin did not meaningfully recover from cutting
   * LEGENDARY_CHANCE alone, because frequency does not fix a per-encounter
   * mismatch, it only changes how often you roll the dice on one. This gives
   * every run at least one camp's worth of buildup — a purchase, a growth
   * pick, a leader assigned — before the roaming danger pool turns on.
   */
  const legendary =
    wasteland && index >= 2 && rng.float() < LEGENDARY_CHANCE
      ? buildLegendary(rng, seenLegendaries)
      : null

  const kind: EncounterKind = boss ? 'boss' : legendary ? 'legendary' : wasteland ? 'wasteland' : 'warband'

  const budgetMult = boss ? BOSS_BUDGET_MULT : kind === 'legendary' ? LEGENDARY_BUDGET_MULT : 1
  const budget = Math.round(encounterBudget(index) * budgetMult)

  const enemy =
    kind === 'boss'
      ? buildBoss(rng, index, budget)
      : kind === 'legendary'
        ? legendary!.warband
        : kind === 'wasteland'
          ? buildWasteland(rng, index, budget)
          : buildWarband(rng, index, budget)

  const bodies = enemy.squads.reduce((n, s) => n + s.count, 0) + enemy.prospects.length

  const name =
    kind === 'boss' || kind === 'legendary'
      ? UNIT_TYPES[enemy.squads[0].typeId].name
      : kind === 'wasteland'
        ? WASTELAND_NAMES[rng.int(WASTELAND_NAMES.length)]
        : `${BAND_PREFIX[rng.int(BAND_PREFIX.length)]} ${BAND_SUFFIX[rng.int(BAND_SUFFIX.length)]}`

  const flavour =
    kind === 'boss'
      ? BOSS_FLAVOUR[Math.min(BOSS_FLAVOUR.length - 1, act)]
      : kind === 'legendary'
        ? UNIT_TYPES[enemy.squads[0].typeId].blurb
        : kind === 'wasteland'
          ? WASTELAND_FLAVOUR[rng.int(WASTELAND_FLAVOUR.length)]
          : FLAVOUR[rng.int(FLAVOUR.length)]

  return {
    index,
    act,
    kind,
    name,
    flavour,
    enemy,
    /*
     * Payouts are a fraction of the budget rather than a curve of their own,
     * so retuning difficulty cannot silently break the economy — the two move
     * together by construction. Tuned against sim:campaign.
     */
    reward: Math.round(60 + budget * 0.52),
    waterReward: Math.round(50 + budget * 0.3),
    bodies,
  }
}
