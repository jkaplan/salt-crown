import { COLLAPSE_THRESHOLD, Rng, TEAM_A, TEAM_B, hashSeed } from '@salt/sim'
import type { BattleConfig, GroupResult, SimGroup, Winner } from '@salt/sim'
import { ENCOUNTERS_PER_RUN, generateEncounter } from './encounters.js'
import type { Encounter } from './encounters.js'
import { rollOffers } from './shop.js'
import type { Offer } from './shop.js'
import { toSimGroups, totalBodies, unitType } from './roster.js'
import type { GroupSource, Squad, SquadLeader, Warband } from './roster.js'
import {
  APPRAISAL_COST,
  isFirstborn,
  isReadyToMutate,
  potentialTitle,
  revealIfMaxed,
  rollGrowthChoices,
  rollPotential,
} from './potentials.js'
import type { MutationRoll } from './mutations.js'
import { MUTANT_TYPES } from './units.js'
import { rollOfficer } from './officers.js'
import type { Officer } from './officers.js'
import {
  escalateWound,
  FREE_RECOVERY_MUTANT,
  FREE_RECOVERY_TRUEKIN,
  OFFICER_WOUND_CHANCE_ON_COLLAPSE,
  recoverWound,
  TREAT_COST,
} from './wounds.js'

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

/** A Potential that has survived enough to earn a mutation, and its options. */
export interface GrowthOffer {
  potentialId: string
  choices: MutationRoll[]
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
  /** Growth picks waiting at this camp. Rolled once so they cannot be rerolled. */
  growth: GrowthOffer[]
  /** Prospects promoted to Firstborn since the last camp. Announced, then cleared. */
  promoted: string[]
  outcome: 'won' | 'lost' | null
}

/** One officer, a pile of fodder, and a single Potential to care about. */
function startingWarband(rng: Rng, selectedOfficer?: Officer): Warband {
  const officer = selectedOfficer || rollOfficer(rng, 'off-start')
  const potential = rollPotential(rng, MUTANT_TYPES[2].id, 0)
  const squads: Squad[] = [
    { id: 'sq-start-1', typeId: MUTANT_TYPES[0].id, count: 18, leader: { kind: 'officer', id: officer.id } },
    { id: 'sq-start-2', typeId: MUTANT_TYPES[2].id, count: 8, leader: { kind: 'potential', id: potential.id } },
  ]
  return {
    squads,
    potentials: [potential],
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
    growth: [],
    promoted: [],
    outcome: null,
  }
}

/**
 * Rolls the growth options for every Potential that has earned one.
 *
 * Done once when a camp opens and stored on the run, so the choices cannot be
 * rerolled by navigating away and back — the pick is meant to be a
 * commitment, and a rerollable commitment is not one.
 */
function rollGrowth(rng: Rng, warband: Warband, encounterIndex: number): GrowthOffer[] {
  return warband.potentials
    .filter(isReadyToMutate)
    .map((p) => ({ potentialId: p.id, choices: rollGrowthChoices(rng, p, encounterIndex) }))
    .filter((offer) => offer.choices.length > 0)
}

/** Take one of the offered mutations. Permanent — there is no undo. */
export function chooseMutation(
  state: RunState,
  potentialId: string,
  choiceIndex: number,
): RunState {
  const offer = state.growth.find((g) => g.potentialId === potentialId)
  const choice = offer?.choices[choiceIndex]
  if (!offer || !choice) return state

  const before = state.warband.potentials.find((p) => p.id === potentialId)
  const potentials = state.warband.potentials.map((p) =>
    p.id === potentialId
      ? revealIfMaxed({ ...p, mutations: [...p.mutations, choice], growth: p.growth + 1 })
      : p,
  )

  /*
   * Promotion is derived, not stored — a Firstborn is simply a Prospect with
   * enough mutations, so there is no flag to keep in sync. But the *moment*
   * has to be announced: this is the rarest thing in a run and the player
   * should not have to notice a title quietly changing in a list.
   */
  const after = potentials.find((p) => p.id === potentialId)
  const promoted =
    before && after && !isFirstborn(before) && isFirstborn(after) ? after.id : null

  return {
    ...state,
    warband: { ...state.warband, potentials },
    growth: state.growth.filter((g) => g.potentialId !== potentialId),
    promoted: promoted ? [...state.promoted, promoted] : state.promoted,
  }
}

/**
 * Pay an Assayer to read a body's capacity.
 *
 * The Assayers are what is left of the breeding programmes' grading staff —
 * a profession that exists because the Houses needed to price stock. Buying
 * blind is cheap and variable; this is how you convert a gamble into a known
 * quantity, and it is worth doing before you decide whether a body is worth
 * protecting.
 */
export function appraise(state: RunState, potentialId: string): RunState {
  const target = state.warband.potentials.find((p) => p.id === potentialId)
  if (!target || target.appraised) return state
  if (state.warband.salvage < APPRAISAL_COST) return state

  return {
    ...state,
    warband: {
      ...state.warband,
      salvage: state.warband.salvage - APPRAISAL_COST,
      potentials: state.warband.potentials.map((p) =>
        p.id === potentialId ? { ...p, appraised: true } : p,
      ),
    },
  }
}

/**
 * Pay to advance one rung of recovery — docs/V0-DESIGN.md §7's "spend to
 * heal, or send them in hurt and risk the next rung." One rung per payment,
 * same step size as free recovery, so a badly wounded Potential is a choice
 * of how many times to pay rather than one lump sum.
 */
export function treatWound(state: RunState, potentialId: string): RunState {
  const target = state.warband.potentials.find((p) => p.id === potentialId)
  if (!target || !target.wound) return state
  if (state.warband.salvage < TREAT_COST) return state

  return {
    ...state,
    warband: {
      ...state.warband,
      salvage: state.warband.salvage - TREAT_COST,
      potentials: state.warband.potentials.map((p) =>
        p.id === potentialId ? { ...p, wound: recoverWound(p.wound, 1) } : p,
      ),
    },
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
    const leader = offer.potentials[0]
    const newSquad = {
      id: offer.id,
      typeId: offer.typeId,
      count: offer.count,
      leader: leader ? { kind: 'potential' as const, id: leader.id } : null,
    }
    // Land next to the last squad of the same type instead of always at the
    // tail, so repeat buys cluster in the battle line instead of scattering.
    // Squads stay separate — two batches of the same type can still carry
    // different leaders — this only changes where a fresh one lands.
    let lastOfType = -1
    for (let i = 0; i < warband.squads.length; i++) {
      if (warband.squads[i].typeId === offer.typeId) lastOfType = i
    }
    if (lastOfType === -1) warband.squads.push(newSquad)
    else warband.squads.splice(lastOfType + 1, 0, newSquad)
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

/**
 * Reorders squads in camp. Order matters because squad order feeds directly
 * into battle formation placement.
 */
export function moveSquad(state: RunState, squadId: string, dir: -1 | 1): RunState {
  const from = state.warband.squads.findIndex((sq) => sq.id === squadId)
  if (from < 0) return state
  const to = from + dir
  if (to < 0 || to >= state.warband.squads.length) return state

  const squads = [...state.warband.squads]
  const [picked] = squads.splice(from, 1)
  squads.splice(to, 0, picked)
  return { ...state, warband: { ...state.warband, squads } }
}

/**
 * Places a squad at an explicit index, used by drag-and-drop ordering.
 */
export function placeSquad(state: RunState, squadId: string, toIndex: number): RunState {
  const from = state.warband.squads.findIndex((sq) => sq.id === squadId)
  if (from < 0) return state
  if (toIndex < 0 || toIndex >= state.warband.squads.length) return state
  if (from === toIndex) return state

  const squads = [...state.warband.squads]
  const [picked] = squads.splice(from, 1)
  squads.splice(toIndex, 0, picked)
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
      if (died) return null
      // Wound ladder — docs/V0-DESIGN.md §7. A Potential always fights as its
      // own body (see the doc comment above), so the trigger is direct: it
      // survived and still took damage. Free recovery (Mutant: 2 rungs) is
      // applied in the same pass, so a fresh wound already has a chance to
      // shrink before the player sees the report.
      let wound = r && r.damageTaken > 0 ? escalateWound(p.wound, state.rng) : p.wound
      wound = recoverWound(wound, FREE_RECOVERY_MUTANT)
      return { ...p, battles: p.battles + 1, wound }
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)

  // Officers have no body of their own (§4 — a pure stat modifier), so they
  // can't use the direct hit trigger above. Proxy: if the squad they led
  // ended the battle COLLAPSING, they were in the thick of a losing fight and
  // have a chance of a wound too. Free recovery (True Kin: 1 rung) applies
  // to every Officer regardless, same as Potentials above.
  const officerSquadResult = new Map<string, GroupResult>()
  for (const sq of state.warband.squads) {
    if (sq.leader?.kind === 'officer') {
      const r = squadResult.get(sq.id)
      if (r) officerSquadResult.set(sq.leader.id, r)
    }
  }
  const officers = state.warband.officers.map((o) => {
    const r = officerSquadResult.get(o.id)
    const collapsed = r ? r.endEffectiveness < COLLAPSE_THRESHOLD : false
    let wound =
      collapsed && state.rng.float() < OFFICER_WOUND_CHANCE_ON_COLLAPSE
        ? escalateWound(o.wound, state.rng)
        : o.wound
    wound = recoverWound(wound, FREE_RECOVERY_TRUEKIN)
    return { ...o, wound }
  })

  // A leader who died no longer leads anyone.
  const livingPotentials = new Set(potentials.map((p) => p.id))
  const livingOfficers = new Set(officers.map((o) => o.id))
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
      officers,
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
    growth: rollGrowth(state.rng, state.warband, next),
    promoted: [],
  }
}

export { ENCOUNTERS_PER_RUN }
