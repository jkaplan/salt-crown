import { TEAM_A, TEAM_B } from '@salt/sim'
import type { ResolvedStats, SimGroup, UnitType } from '@salt/sim'
import { MUTATIONS_BY_ID, leakLevel } from './mutations.js'
import type { MutationRoll } from './mutations.js'
import { OFFICER_RANKS_BY_ID, officerTitle } from './officers.js'
import type { Officer } from './officers.js'
import { POTENTIAL_HP_MULT, potentialTitle } from './potentials.js'
import type { Potential } from './potentials.js'
import { DISCIPLINE, UNIT_TYPES } from './units.js'
import { applyWoundPenalty, officerBonusMultiplier } from './wounds.js'

/**
 * Three tiers, in descending order of how much the player should care:
 *
 *   Officers    True Kin, named, recruited. Lead a squad and grant it a flat
 *               bonus plus discipline.
 *   Potentials  Mutants that came out of the vats with something useful.
 *               Individually tracked, individually simulated, permanently
 *               dead when killed. Lead a squad by leaking their mutations to
 *               it at half level — so a Horns 5 standout gives its whole
 *               squad Horns 3. This is what makes mutations an army-wide
 *               multiplier rather than one fighter's stat line.
 *   Squads      Anonymous fodder, by unit type. A number, not a list of people.
 *
 * Fodder itself carries no mutations. Mutation is individual and rare, which
 * is what makes a Potential worth noticing — twenty identically-mutated
 * fighters is not how a random process works. See docs/V0-DESIGN.md §4.
 *
 * A Potential can only lead its own kind — a mutant does not command True
 * Kin. One leader per squad, of either kind, so the choice is real.
 */
export type SquadLeader = { kind: 'officer'; id: string } | { kind: 'potential'; id: string }

export interface Squad {
  id: string
  typeId: number
  count: number
  leader: SquadLeader | null
}

export interface Warband {
  squads: Squad[]
  potentials: Potential[]
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

export function findLeadingPotential(w: Warband, squad: Squad): Potential | null {
  if (squad.leader?.kind !== 'potential') return null
  return w.potentials.find((p) => p.id === squad.leader!.id) ?? null
}

/**
 * A squad led by a Potential inherits that Potential's mutations at half
 * level (min 1) — the leak. A squad led by an Officer gets the officer's flat
 * bonus instead. Only one can apply.
 */
export function resolveSquadStats(
  squad: Squad,
  officer: Officer | null,
  leader: Potential | null = null,
): ResolvedStats {
  const s = baseStats(squad.typeId)
  if (officer) {
    OFFICER_RANKS_BY_ID.get(officer.rankId)?.apply(s, officerBonusMultiplier(officer.wound))
  } else if (leader) {
    for (const roll of leader.mutations) {
      MUTATIONS_BY_ID.get(roll.id)?.apply(s, leakLevel(roll.level))
    }
  }
  return clamp(s)
}

/**
 * Potentials are individuals, so their own mutations apply at full level.
 * They are also sturdier than the fodder they came from — being noticed at
 * all means having survived something.
 */
export function resolvePotentialStats(p: Potential): ResolvedStats {
  const s = baseStats(p.typeId)
  s.hp *= POTENTIAL_HP_MULT
  for (const roll of p.mutations) {
    MUTATIONS_BY_ID.get(roll.id)?.apply(s, roll.level)
  }
  applyWoundPenalty(s, p.wound)
  return clamp(s)
}

export function resolveDiscipline(typeId: number, officer: Officer | null): number {
  const base = DISCIPLINE[unitType(typeId).lineage]
  const bonus = officer ? (OFFICER_RANKS_BY_ID.get(officer.rankId)?.moraleBonus ?? 0) : 0
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
  leader: Potential | null = null,
): number {
  return statPower(resolveSquadStats(squad, officer, leader), squad.count)
}

export function potentialPower(p: Potential): number {
  return statPower(resolvePotentialStats(p), 1)
}

/** Fodder only. Potentials are counted separately because they're people. */
export function totalFodder(w: Warband): number {
  return w.squads.reduce((n, s) => n + s.count, 0)
}

export function totalBodies(w: Warband): number {
  return totalFodder(w) + w.potentials.length
}

export function warbandPower(w: Warband): number {
  return (
    w.squads.reduce(
      (sum, sq) => sum + squadPower(sq, findOfficer(w, sq), findLeadingPotential(w, sq)),
      0,
    ) + w.potentials.reduce((sum, p) => sum + potentialPower(p), 0)
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
  kind: 'squad' | 'potential'
  id: string
}

/**
 * Flattens a warband into the resolved groups the sim consumes, plus a
 * parallel list saying where each group came from, so losses can be applied
 * back afterwards.
 *
 * Every Potential gets its own group, leading or not, so that all of them can
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
    const leader = findLeadingPotential(w, sq)
    groups.push({
      team,
      count: sq.count,
      label: squadLabel(sq),
      color: unitType(sq.typeId).color,
      shape: squadShape(sq.typeId),
      // The leader's mutations leak into the squad's stats...
      stats: resolveSquadStats(sq, officer, leader),
      discipline: resolveDiscipline(sq.typeId, officer),
      // ...but a Potential leader carries its own banner on its own group
      // below, so only an officer labels the squad itself.
      leaderLabel: officer ? officerTitle(officer) : null,
    })
    sources.push({ kind: 'squad', id: sq.id })
  }

  /*
   * EVERY Potential fights as its own body, including one that is leading.
   *
   * Leading Potentials used to be skipped here. That dropped a body from the
   * field, and — because resolveBattle maps outcomes back through these
   * groups — meant a leading Potential could never be recorded as dead. The
   * best standout in the warband became immortal the moment you promoted it,
   * which destroys the permadeath the tier exists for.
   */
  for (const p of w.potentials) {
    const type = unitType(p.typeId)
    groups.push({
      team,
      count: 1,
      label: potentialTitle(p, type.name),
      color: type.color,
      shape: squadShape(p.typeId),
      stats: resolvePotentialStats(p),
      // A Potential is one body; morale scaling on a group of one is noise.
      discipline: 1,
      leaderLabel: p.name,
      named: true,
    })
    sources.push({ kind: 'potential', id: p.id })
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
