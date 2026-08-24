import { TEAM_A, TEAM_B } from '@salt/sim'
import type { ResolvedStats, SimGroup, UnitType } from '@salt/sim'
import { MUTATIONS_BY_ID, leakLevel } from './mutations.js'
import type { MutationRoll } from './mutations.js'
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
import { applyWoundPenalty, officerBonusMultiplier } from './wounds.js'

/**
 * Three tiers, in descending order of how much the player should care:
 *
 *   Officers    True Kin, named, recruited. Lead a squad and grant it a flat
 *               bonus plus discipline.
 *   Prospects  Mutants that came out of the vats with something useful.
 *               Individually tracked, individually simulated, permanently
 *               dead when killed. Lead a squad by leaking their mutations to
 *               it at half level — so a Horns 5 standout gives its whole
 *               squad Horns 3. This is what makes mutations an army-wide
 *               multiplier rather than one fighter's stat line.
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
}

export interface Warband {
  squads: Squad[]
  prospects: Prospect[]
  officers: Officer[]
  salvage: number
}

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
 * A squad led by a Prospect inherits that Prospect's mutations at half
 * level (min 1) — the leak. A squad led by an Officer gets the officer's flat
 * bonus instead. Only one can apply.
 */
export function resolveSquadStats(
  squad: Squad,
  officer: Officer | null,
  leader: Prospect | null = null,
): ResolvedStats {
  const s = baseStats(squad.typeId)
  if (officer) {
    OFFICER_RANKS_BY_ID.get(officer.rankId)?.apply(s, officerBonusMultiplier(officer.wound))
  } else if (leader) {
    /*
     * A Prospect leaks at half level. A FIRSTBORN leaks at full.
     *
     * That is the whole payoff for ten battles survived, and it is deliberately
     * large: five mutations at full strength across twenty bodies is the kind
     * of multiplier that beats simply bringing more bodies. See V0-DESIGN 6b —
     * numbers dominate until quality multipliers get big enough, and this is
     * the biggest one in the game.
     */
    const full = isFirstborn(leader)
    for (const roll of leader.mutations) {
      MUTATIONS_BY_ID.get(roll.id)?.apply(s, full ? roll.level : leakLevel(roll.level))
    }
  }
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
  return clamp(s)
}

export function resolveDiscipline(
  typeId: number,
  officer: Officer | null,
  leader: Prospect | null = null,
): number {
  const base = DISCIPLINE[unitType(typeId).lineage]
  let bonus = officer ? (OFFICER_RANKS_BY_ID.get(officer.rankId)?.moraleBonus ?? 0) : 0
  // Mutants fold at 0.35. One of their own who came back ten times is a
  // reason to keep standing.
  if (!officer && leader && isFirstborn(leader)) bonus += FIRSTBORN_DISCIPLINE_BONUS
  return Math.min(0.95, base + bonus)
}

/** A rough strength score. Used only to budget enemy warbands and the bot. */
export function statPower(s: ResolvedStats, count: number): number {
  const dps = (s.damage / s.attackInterval) * s.accuracy
  const tough = s.hp + s.armor * 8
  return Math.sqrt(dps * tough) * count
}

export function squadPower(
  squad: Squad,
  officer: Officer | null = null,
  leader: Prospect | null = null,
): number {
  return statPower(resolveSquadStats(squad, officer, leader), squad.count)
}

export function prospectPower(p: Prospect): number {
  return statPower(resolveProspectStats(p), 1)
}

/** Fodder only. Prospects are counted separately because they're people. */
export function totalFodder(w: Warband): number {
  return w.squads.reduce((n, s) => n + s.count, 0)
}

export function totalBodies(w: Warband): number {
  return totalFodder(w) + w.prospects.length
}

export function warbandPower(w: Warband): number {
  return (
    w.squads.reduce(
      (sum, sq) => sum + squadPower(sq, findOfficer(w, sq), findLeadingProspect(w, sq)),
      0,
    ) + w.prospects.reduce((sum, p) => sum + prospectPower(p), 0)
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
  kind: 'squad' | 'prospect'
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
      // The leader's mutations leak into the squad's stats...
      stats: resolveSquadStats(sq, officer, leader),
      discipline: resolveDiscipline(sq.typeId, officer, leader),
      // ...but a Prospect leader carries its own banner on its own group
      // below, so only an officer labels the squad itself.
      leaderLabel: officer ? officerTitle(officer) : null,
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
    })
    sources.push({ kind: 'prospect', id: p.id })
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
