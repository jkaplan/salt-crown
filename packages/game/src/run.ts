import { Rng, TEAM_A, TEAM_B, hashSeed } from '@salt/sim'
import type { BattleConfig, GroupResult, SimGroup, Winner } from '@salt/sim'
import { ENCOUNTERS_PER_RUN, generateEncounter } from './encounters.js'
import type { Encounter } from './encounters.js'
import { rollOffers } from './shop.js'
import type { Offer } from './shop.js'
import { toSimGroups, totalBodies, unitType } from './roster.js'
import type { GroupSource, Squad, SquadLeader, Warband } from './roster.js'
import { potentialTitle, rollPotential } from './potentials.js'
import { MUTANT_TYPES } from './units.js'
import { rollOfficer } from './officers.js'
import type { Officer } from './officers.js'

export type Phase = 'camp' | 'battle' | 'report' | 'over'

export interface SquadLoss {
  label: string
  started: number
  dead: number
  survived: number
  /** Damage multiplier it ended on. Low means it was collapsing. */
  endEffectiveness: number
  /** Total damage this squad dealt. */
  damageDealt: number
  /** Total damage this squad took. */
  damageTaken: number
}

export interface PotentialLoss {
  name: string
  label: string
  died: boolean
  battles: number
}

export interface BattleReport {
  won: boolean
  encounterName: string
  salvageEarned: number
  squads: SquadLoss[]
  potentials: PotentialLoss[]
  enemy: GroupResult[]
  ticks: number
}

export interface RunState {
  seedText: string
  rng: Rng
  phase: Phase
  encounterIndex: number
  warband: Warband
  offers: Offer[]
  encounter: Encounter
  report: BattleReport | null
  outcome: 'won' | 'lost' | null
}

/** One officer, a pile of fodder, and a single Potential to care about. */
function startingWarband(rng: Rng, selectedOfficer?: Officer): Warband {
  const officer = selectedOfficer || rollOfficer(rng, 'off-start')
  const squads: Squad[] = [
    { id: 'sq-start-1', typeId: MUTANT_TYPES[0].id, count: 18, leader: { kind: 'officer', id: officer.id } },
    { id: 'sq-start-2', typeId: MUTANT_TYPES[2].id, count: 8, leader: null },
  ]
  return {
    squads,
    potentials: [rollPotential(rng, MUTANT_TYPES[2].id, 0)],
    officers: [officer],
    salvage: 120,
  }
}

export function newRun(seedText: string, selectedOfficer?: Officer): RunState {
  const rng = new Rng(hashSeed(seedText))
  const warband = startingWarband(rng, selectedOfficer)
  return {
    seedText,
    rng,
    phase: 'camp',
    encounterIndex: 0,
    warband,
    offers: rollOffers(rng, 0),
    encounter: generateEncounter(rng, 0),
    report: null,
    outcome: null,
  }
}

export function buy(state: RunState, offerId: string): RunState {
  const offer = state.offers.find((o) => o.id === offerId)
  if (!offer || offer.cost > state.warband.salvage) return state

  const warband: Warband = {
    ...state.warband,
    salvage: state.warband.salvage - offer.cost,
    squads: [...state.warband.squads],
    potentials: [...state.warband.potentials],
    officers: [...state.warband.officers],
  }

  if (offer.kind === 'squad') {
    warband.squads.push({
      id: offer.id,
      typeId: offer.typeId,
      count: offer.count,
      leader: null,
    })
    warband.potentials.push(...offer.potentials)
  } else {
    warband.officers.push(offer.officer)
  }

  return { ...state, warband, offers: state.offers.filter((o) => o.id !== offerId) }
}

/**
 * One leader per squad, of either kind, so assigning is genuinely a choice
 * between an Officer's flat bonus and a Potential's mutation leak. A
 * Potential can only lead its own kind — a mutant does not command True Kin.
 * Any leader can only lead one squad at a time.
 */
export function assignLeader(
  state: RunState,
  squadId: string,
  leader: SquadLeader | null,
): RunState {
  const target = state.warband.squads.find((sq) => sq.id === squadId)
  if (!target) return state

  if (leader?.kind === 'potential' && unitType(target.typeId).lineage !== 'mutant') {
    return state
  }

  const squads = state.warband.squads.map((sq) => {
    if (sq.id === squadId) return { ...sq, leader }
    if (
      leader &&
      sq.leader &&
      sq.leader.kind === leader.kind &&
      sq.leader.id === leader.id
    ) {
      return { ...sq, leader: null }
    }
    return sq
  })
  return { ...state, warband: { ...state.warband, squads } }
}

export interface BattleSetup {
  config: BattleConfig
  /** Parallel to the leading team-A groups in `config.groups`. */
  playerSources: GroupSource[]
}

export function buildBattle(state: RunState): BattleSetup {
  const player = toSimGroups(state.warband, TEAM_A)
  const enemy = toSimGroups(state.encounter.enemy, TEAM_B)
  const groups: SimGroup[] = [...player.groups, ...enemy.groups]

  return {
    config: { seed: state.rng.next(), groups },
    playerSources: player.sources,
  }
}

export function march(state: RunState): RunState {
  return { ...state, phase: 'battle' }
}

/**
 * Applies the battle outcome to the warband.
 *
 * Battles are fought to the finish, so a defeat leaves nothing standing. That
 * is why losing ends the run — see docs/V0-DESIGN.md §7.
 *
 * A Potential always fights as its own body, whether or not it is leading a
 * squad, so it can die independently of the squad it leads — losing a leader
 * mid-battle just means the squad finishes the fight on its own stats.
 * Potentials that live gain a battle towards Firstborn (M2).
 */
export function resolveBattle(
  state: RunState,
  results: GroupResult[],
  winner: Winner,
  ticks: number,
  playerSources: GroupSource[],
): RunState {
  const playerResults = results.slice(0, playerSources.length)
  const enemyResults = results.slice(playerSources.length)
  const won = winner === TEAM_A

  const squadResult = new Map<string, GroupResult>()
  const potentialResult = new Map<string, GroupResult>()
  playerSources.forEach((src, i) => {
    if (src.kind === 'squad') squadResult.set(src.id, playerResults[i])
    else potentialResult.set(src.id, playerResults[i])
  })

  const squadLosses: SquadLoss[] = []
  const squads = state.warband.squads
    .map((sq) => {
      const r = squadResult.get(sq.id)
      if (!r) return sq
      squadLosses.push({
        label: r.label,
        started: r.started,
        dead: r.dead,
        survived: r.survived,
        endEffectiveness: r.endEffectiveness,
        damageDealt: r.damageDealt,
        damageTaken: r.damageTaken,
      })
      return { ...sq, count: r.survived }
    })
    .filter((sq) => sq.count > 0)

  const potentialLosses: PotentialLoss[] = []
  const potentials = state.warband.potentials
    .map((p) => {
      const r = potentialResult.get(p.id)
      const died = r ? r.survived === 0 : false
      potentialLosses.push({
        name: p.name,
        label: potentialTitle(p, unitType(p.typeId).name),
        died,
        battles: p.battles + (died ? 0 : 1),
      })
      return died ? null : { ...p, battles: p.battles + 1 }
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)

  // A leader who died no longer leads anyone.
  const livingPotentials = new Set(potentials.map((p) => p.id))
  const livingOfficers = new Set(state.warband.officers.map((o) => o.id))
  const survivingSquads = squads.map((sq) => {
    if (!sq.leader) return sq
    const alive =
      sq.leader.kind === 'officer'
        ? livingOfficers.has(sq.leader.id)
        : livingPotentials.has(sq.leader.id)
    return alive ? sq : { ...sq, leader: null }
  })

  const salvageEarned = won ? state.encounter.reward : 0

  return {
    ...state,
    phase: 'report',
    warband: {
      ...state.warband,
      squads: survivingSquads,
      potentials,
      salvage: state.warband.salvage + salvageEarned,
    },
    report: {
      won,
      encounterName: state.encounter.name,
      salvageEarned,
      squads: squadLosses,
      potentials: potentialLosses,
      enemy: enemyResults,
      ticks,
    },
  }
}

/**
 * Report -> next camp.
 *
 * Battles run to annihilation, so a lost battle means a lost warband and a
 * lost run. Attrition still does the killing — it is the reason you arrive at
 * an encounter too thin to win it — it just isn't a separate failure track.
 */
export function advance(state: RunState): RunState {
  if (!state.report?.won || totalBodies(state.warband) === 0) {
    return { ...state, phase: 'over', outcome: 'lost' }
  }

  const next = state.encounterIndex + 1
  if (next >= ENCOUNTERS_PER_RUN) {
    return { ...state, phase: 'over', outcome: 'won' }
  }

  return {
    ...state,
    phase: 'camp',
    encounterIndex: next,
    offers: rollOffers(state.rng, next),
    encounter: generateEncounter(state.rng, next),
    report: null,
  }
}

export { ENCOUNTERS_PER_RUN }
