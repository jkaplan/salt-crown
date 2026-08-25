import { TEAM_A, TEAM_B } from '@salt/sim'
import type { ResolvedStats, SimGroup, UnitType } from '@salt/sim'
import { MUTATIONS_BY_ID } from './mutations.js'
import type { MutationRoll } from './mutations.js'
import { applyBionics } from './bionics.js'
import { applyRelic } from './relics.js'
import { applyCondition, machineTitle } from './machines.js'
import type { Machine } from './machines.js'
import { OFFICER_RANKS_BY_ID, officerTitle } from './officers.js'
import type { Officer } from './officers.js'
import {
  FIRSTBORN_DISCIPLINE_BONUS,
  FIRSTBORN_HP_MULT,
  PROSPECT_HP_MULT,
  isFirstborn,
  prospectTitle,
} from './prospects.js'
import type { Prospect } from './prospects.js'
import { DISCIPLINE, UNIT_TYPES } from './units.js'
import { BOSS_TYPES } from './wasteland.js'
import { LEGENDARY_TYPES } from './legendaries.js'
import { applyPermanentInjuries, applyWoundPenalty, officerBonusMultiplier } from './wounds.js'

/**
 * Three tiers, in descending order of how much the player should care:
 *
 *   Officers    True Kin, named, recruited. Lead a squad and grant it a flat
 *               bonus plus discipline (plus any fitted implants).
 *   Prospects  Mutants that came out of the vats with something useful.
 *               Individually tracked, individually simulated, permanently
 *               dead when killed. Lead a squad by steadying it — discipline
 *               only, same mechanism an Officer uses. Their own mutations
 *               stay their own; see resolveSquadStats for why that changed
 *               from an earlier "leak" mechanic that let them apply to the
 *               whole squad.
 *   Squads      Anonymous fodder, by unit type. A number, not a list of people.
 *
 * Fodder itself carries no mutations. Mutation is individual and rare, which
 * is what makes a Prospect worth noticing — twenty identically-mutated
 * fighters is not how a random process works. See docs/V0-DESIGN.md §4.
 *
 * A Prospect can only lead its own kind — a mutant does not command True
 * Kin. One leader per squad, of either kind, so the choice is real.
 */
export type SquadLeader = { kind: 'officer'; id: string } | { kind: 'prospect'; id: string }

export interface Squad {
  id: string
  typeId: number
  count: number
  leader: SquadLeader | null
  /**
   * A bound relic — see relics.ts. Optional (not `| null`) so the several
   * places that build a Squad don't all need to remember it, the same reason
   * Prospect's `titled` is optional. Only ever set on the PLAYER's own
   * squads; a rival warband's squads never carry one.
   */
  relicId?: string | null
}

export interface Warband {
  /**
   * Run-level morale, shifted by events between battles and folded into every
   * squad's discipline. A thumb on the scale, not a second health bar.
   */
  morale: number
  squads: Squad[]
  prospects: Prospect[]
  officers: Officer[]
  /** What you spend. Recruit, appraise, treat, install. */
  salvage: number
  /**
   * What you owe. Charged every march, scaled superlinearly by roster size —
   * see water.ts. Salvage rewards a good decision; Water punishes a big one.
   */
  water: number
  /**
   * Machines. Found only, never bought — see machines.ts. Individuals, like
   * Prospects, because you never have enough of them to be anonymous.
   */
  machines: Machine[]
  /**
   * Bionics found and not yet installed. Ruin-only — this is the mechanical
   * reason delving exists for a True Kin warband (V0-DESIGN §3).
   */
  bionics: string[]
  /** Relics found and not yet bound to a squad — see relics.ts. Ruin-only. */
  relics: string[]
}

/**
 * Bosses and legendaries both arrive as an ordinary count-1 Squad, same as
 * any rival levy's single straggler, and toSimGroups only flagged Prospects
 * and Machines as named individuals. Nothing marked either as one, so a boss
 * got no HP bar in the roster HUD, no name banner, no larger sprite on the
 * canvas — every system built for "legendary" already existed and simply
 * never saw one. Legendaries (docs/V0-DESIGN.md §15) get exactly the same
 * treatment for exactly the same reason; a legendary that looked like an
 * ordinary fauna squad would not read as one.
 *
 * Checked by id here rather than adding a field to Squad: both are
 * identifiable from typeId alone, so there is nothing to forget at any of
 * Squad's several construction sites (buy, buildWarband, buildBoss,
 * startingWarband) the way a settable flag could be.
 */
const NAMED_SQUAD_IDS = new Set([...BOSS_TYPES, ...LEGENDARY_TYPES].map((t) => t.id))

const BODY_SHAPE_COUNT = 8

export function squadShape(typeId: number): number {
  const n = typeId % BODY_SHAPE_COUNT
  return n < 0 ? n + BODY_SHAPE_COUNT : n
}

export function unitType(typeId: number): UnitType {
  return UNIT_TYPES[typeId]
}

export function squadLabel(squad: Squad): string {
  return `${unitType(squad.typeId).name} ×${squad.count}`
}

export function squadCost(typeId: number, count: number): number {
  return unitType(typeId).cost * count
}

function baseStats(typeId: number): ResolvedStats {
  return { ...unitType(typeId).base, regen: 0, quills: 0, frenzy: 0 }
}

/** Guard rails, so a bad mutation stack can't produce nonsense. */
function clamp(s: ResolvedStats): ResolvedStats {
  if (s.moveSpeed < 0.8) s.moveSpeed = 0.8
  if (s.armor < 0) s.armor = 0
  if (s.damage < 1) s.damage = 1
  if (s.accuracy < 0.05) s.accuracy = 0.05
  else if (s.accuracy > 0.98) s.accuracy = 0.98
  if (s.evade < 0) s.evade = 0
  else if (s.evade > 0.8) s.evade = 0.8
  if (s.attackInterval < 2) s.attackInterval = 2
  return s
}

export function findOfficer(w: Warband, squad: Squad): Officer | null {
  if (squad.leader?.kind !== 'officer') return null
  return w.officers.find((o) => o.id === squad.leader!.id) ?? null
}

export function findLeadingProspect(w: Warband, squad: Squad): Prospect | null {
  if (squad.leader?.kind !== 'prospect') return null
  return w.prospects.find((p) => p.id === squad.leader!.id) ?? null
}

/**
 * A squad led by an Officer gets the rank's flat bonus and any fitted
 * implants. A squad led by a Prospect gets LEADERSHIP only — see
 * resolveDiscipline — never the leader's own mutations.
 *
 * Mutations used to "leak" onto the whole squad at half level, full for a
 * Firstborn. Cut: nothing explains how one body's mutation applies to twenty
 * others, and the game already has an honest mechanism for a leader making
 * their squad steadier — discipline — without inventing a biological one.
 * Mutations stay exactly what they say they are: what happened to this body.
 * Squad-wide buffs are a job for relics and perks (V0.1), not for leaking.
 */
export function resolveSquadStats(
  squad: Squad,
  officer: Officer | null,
  // Kept in the signature (underscore-prefixed: intentionally unused) so
  // every call site still reads "who leads this" the same way
  // resolveDiscipline's does — even though a Prospect leader has no effect
  // on the squad's STATS any more, only on its discipline.
  _leader: Prospect | null = null,
): ResolvedStats {
  const s = baseStats(squad.typeId)
  if (officer) {
    OFFICER_RANKS_BY_ID.get(officer.rankId)?.apply(s, officerBonusMultiplier(officer.wound))
    // Implants are not scaled by the wound. A wound degrades what a person
    // can do; it does not degrade hardware bolted to their skeleton.
    applyBionics(s, officer.bionics)
  }
  // A leading Prospect contributes nothing to the squad's STATS — only to its
  // discipline, in resolveDiscipline. Leadership steadies a line; it does not
  // rewrite anyone's biology.
  // A relic is the squad's own, independent of who leads it (or doesn't).
  applyRelic(s, squad.relicId, { lineage: unitType(squad.typeId).lineage, count: squad.count })
  return clamp(s)
}

/**
 * Prospects are individuals, so their own mutations apply at full level.
 * They are also sturdier than the fodder they came from — being noticed at
 * all means having survived something.
 */
export function resolveProspectStats(p: Prospect): ResolvedStats {
  const s = baseStats(p.typeId)
  s.hp *= isFirstborn(p) ? FIRSTBORN_HP_MULT : PROSPECT_HP_MULT
  for (const roll of p.mutations) {
    MUTATIONS_BY_ID.get(roll.id)?.apply(s, roll.level)
  }
  applyWoundPenalty(s, p.wound)
  applyPermanentInjuries(s, p.permanentInjuries)
  return clamp(s)
}

/**
 * A machine's own stats, worn down by its condition.
 *
 * No mutations (they are not alive), no bionics (they are not True Kin), no
 * wound ladder (wear is not a hit location). Condition is the whole of it,
 * which is why it is the only number the roster shows.
 */
export function resolveMachineStats(m: Machine): ResolvedStats {
  const s = baseStats(m.typeId)
  applyCondition(s, m.condition)
  return clamp(s)
}

export function machinePower(m: Machine): number {
  // Machines never degrade — that is the balance for them being far above
  // everything else.
  return statPower(resolveMachineStats(m), 1, 1)
}

/** Any Prospect leading a squad, not yet a Firstborn — someone worth holding the line for. */
export const LEADING_PROSPECT_DISCIPLINE_BONUS = 0.05

export function resolveDiscipline(
  typeId: number,
  officer: Officer | null,
  leader: Prospect | null = null,
  morale = 0,
): number {
  const type = unitType(typeId)
  const base = type.discipline ?? DISCIPLINE[type.lineage]
  let bonus = (officer ? (OFFICER_RANKS_BY_ID.get(officer.rankId)?.moraleBonus ?? 0) : 0) + morale
  // Mutants fold at 0.35. Any Prospect worth following steadies that a
  // little; a Firstborn who came back ten times steadies it a great deal.
  if (!officer && leader) {
    bonus += isFirstborn(leader) ? FIRSTBORN_DISCIPLINE_BONUS : LEADING_PROSPECT_DISCIPLINE_BONUS
  }
  return Math.min(0.95, base + bonus)
}

/**
 * A rough strength score. A BOT HEURISTIC — never shown to a player, and not
 * what the encounter generator budgets against (that works in salvage).
 *
 * Discipline belongs in it and was missing.
 *
 * Morale is a damage multiplier, so a group's real output over a battle is
 * closer to its stats times an average effectiveness somewhere between its
 * discipline floor and 1. Leaving it out scored a mutant squad and a True Kin
 * squad with identical stat lines as equally strong, when the mutants collapse
 * to 35% output and the True Kin barely notice — so the buying bot
 * systematically overrated exactly the thing the game is built to punish.
 */
export function statPower(s: ResolvedStats, count: number, discipline = 1): number {
  const dps = (s.damage / s.attackInterval) * s.accuracy
  const tough = s.hp + s.armor * 8
  // Mean effectiveness across a grind from full strength to nothing.
  const hold = (1 + discipline) / 2
  return Math.sqrt(dps * hold * tough) * count
}

export function squadPower(
  squad: Squad,
  officer: Officer | null = null,
  leader: Prospect | null = null,
  morale = 0,
): number {
  return statPower(
    resolveSquadStats(squad, officer, leader),
    squad.count,
    resolveDiscipline(squad.typeId, officer, leader, morale),
  )
}

export function prospectPower(p: Prospect): number {
  // A single body has nothing to lose but itself; morale scaling on a group
  // of one is noise, which is why toSimGroups gives them discipline 1 too.
  return statPower(resolveProspectStats(p), 1, 1)
}

/** Fodder only. Prospects are counted separately because they're people. */
export function totalFodder(w: Warband): number {
  return w.squads.reduce((n, s) => n + s.count, 0)
}

export function totalBodies(w: Warband): number {
  return totalFodder(w) + w.prospects.length + w.machines.length
}

export function warbandPower(w: Warband): number {
  return (
    w.squads.reduce(
      (sum, sq) => sum + squadPower(sq, findOfficer(w, sq), findLeadingProspect(w, sq)),
      0,
    ) +
    w.prospects.reduce((sum, p) => sum + prospectPower(p), 0) +
    w.machines.reduce((sum, m) => sum + machinePower(m), 0)
  )
}

/** Fodder grouped by unit type, for the collapsed infantry readout. */
export function fodderByType(w: Warband): { typeId: number; count: number }[] {
  const map = new Map<number, number>()
  for (const sq of w.squads) map.set(sq.typeId, (map.get(sq.typeId) ?? 0) + sq.count)
  return [...map.entries()]
    .map(([typeId, count]) => ({ typeId, count }))
    .sort((a, b) => b.count - a.count)
}

export interface GroupSource {
  kind: 'squad' | 'prospect' | 'machine'
  id: string
}

/**
 * Flattens a warband into the resolved groups the sim consumes, plus a
 * parallel list saying where each group came from, so losses can be applied
 * back afterwards.
 *
 * Every Prospect gets its own group, leading or not, so that all of them can
 * fight and all of them can die.
 */
export function toSimGroups(
  w: Warband,
  team: typeof TEAM_A | typeof TEAM_B,
): { groups: SimGroup[]; sources: GroupSource[] } {
  const groups: SimGroup[] = []
  const sources: GroupSource[] = []

  for (const sq of w.squads) {
    if (sq.count <= 0) continue
    const officer = findOfficer(w, sq)
    const leader = findLeadingProspect(w, sq)
    groups.push({
      team,
      count: sq.count,
      label: squadLabel(sq),
      color: unitType(sq.typeId).color,
      shape: squadShape(sq.typeId),
      stats: resolveSquadStats(sq, officer, leader),
      // The leader's DISCIPLINE reaches the squad; their mutations do not —
      // see resolveSquadStats.
      discipline: resolveDiscipline(sq.typeId, officer, leader, w.morale),
      // A Prospect leader carries its own banner on its own group below, so
      // an ordinary squad is labelled by its officer or not at all — except
      // a boss, which IS the banner regardless of who is or isn't leading it.
      leaderLabel: officer ? officerTitle(officer) : NAMED_SQUAD_IDS.has(sq.typeId) ? unitType(sq.typeId).name : null,
      // Same treatment Prospects and Machines get: HP bar and name in the
      // battle HUD, bigger sprite on the canvas, team-coloured throughout —
      // see BattleScreen's roster HUD and BattleView's leaderScale.
      named: NAMED_SQUAD_IDS.has(sq.typeId),
    })
    sources.push({ kind: 'squad', id: sq.id })
  }

  /*
   * EVERY Prospect fights as its own body, including one that is leading.
   *
   * Leading Prospects used to be skipped here. That dropped a body from the
   * field, and — because resolveBattle maps outcomes back through these
   * groups — meant a leading Prospect could never be recorded as dead. The
   * best standout in the warband became immortal the moment you promoted it,
   * which destroys the permadeath the tier exists for.
   */
  // Only fielded Prospects fight. The rest are stock — they do not deploy,
  // do not accrue battles, and cannot die. That is what a reserve is for.
  for (const p of w.prospects) {
    if (!p.fielded) continue
    const type = unitType(p.typeId)
    groups.push({
      team,
      count: 1,
      label: prospectTitle(p, type.name),
      color: type.color,
      shape: squadShape(p.typeId),
      stats: resolveProspectStats(p),
      // A Prospect is one body; morale scaling on a group of one is noise.
      discipline: 1,
      leaderLabel: p.name,
      named: true,
      // The only lineage-blind trigger the sim owns — see SimGroup.maimable.
      maimable: true,
    })
    sources.push({ kind: 'prospect', id: p.id })
  }

  /*
   * Machines fight as individuals, like Prospects, and for the same reason —
   * there are never enough of them for one to be anonymous. Discipline 1:
   * a machine does not notice its own losses, which is the balance for it
   * being far above everything else (V0-DESIGN §7).
   */
  for (const m of w.machines) {
    const type = unitType(m.typeId)
    groups.push({
      team,
      count: 1,
      label: machineTitle(m, type.name),
      color: type.color,
      shape: squadShape(m.typeId),
      stats: resolveMachineStats(m),
      discipline: 1,
      leaderLabel: m.name,
      named: true,
    })
    sources.push({ kind: 'machine', id: m.id })
  }

  return { groups, sources }
}

/**
 * A single ad-hoc group with no officer. Used by the batch harness and by
 * Skirmish mode, where there's no warband to draw from.
 */
export function makeGroup(
  team: typeof TEAM_A | typeof TEAM_B,
  typeId: number,
  count: number,
  mutations: MutationRoll[] = [],
): SimGroup {
  const s = baseStats(typeId)
  for (const roll of mutations) MUTATIONS_BY_ID.get(roll.id)?.apply(s, roll.level)
  return {
    team,
    count,
    label: `${unitType(typeId).name} ×${count}`,
    color: unitType(typeId).color,
    shape: squadShape(typeId),
    stats: clamp(s),
    discipline: resolveDiscipline(typeId, null),
    leaderLabel: null,
  }
}

export { TEAM_A, TEAM_B }
