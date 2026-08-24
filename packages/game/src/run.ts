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
  MAX_FIELDED_PROSPECTS,
  fieldedCount,
  isFirstborn,
  isReadyToMutate,
  prospectTitle,
  revealIfMaxed,
  rollGrowthChoices,
  rollProspect,
  sellValue,
} from './prospects.js'
import type { MutationRoll } from './mutations.js'
import { clampMorale, rollEvent } from './events.js'
import type { GameEvent } from './events.js'
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

export interface ProspectLoss {
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
  prospects: ProspectLoss[]
  enemy: GroupResult[]
  ticks: number
}

/** A Prospect that has survived enough to earn a mutation, and its options. */
export interface GrowthOffer {
  prospectId: string
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
  /** The camp's pending event. Blocks the march — a skippable choice is not one. */
  event: GameEvent | null
  /** Events already fired, so a run never repeats one. */
  seenEvents: string[]
  outcome: 'won' | 'lost' | null
}

/** One officer, a pile of fodder, and a single Prospect to care about. */
function startingWarband(rng: Rng, selectedOfficer?: Officer): Warband {
  const officer = selectedOfficer || rollOfficer(rng, 'off-start')
  const prospect = rollProspect(rng, MUTANT_TYPES[2].id, 0)
  const squads: Squad[] = [
    { id: 'sq-start-1', typeId: MUTANT_TYPES[0].id, count: 18, leader: { kind: 'officer', id: officer.id } },
    { id: 'sq-start-2', typeId: MUTANT_TYPES[2].id, count: 8, leader: { kind: 'prospect', id: prospect.id } },
  ]
  return {
    squads,
    prospects: [prospect],
    officers: [officer],
    salvage: 120,
    morale: 0,
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
    event: null,
    seenEvents: [],
    outcome: null,
  }
}

/**
 * Rolls the growth options for every Prospect that has earned one.
 *
 * Done once when a camp opens and stored on the run, so the choices cannot be
 * rerolled by navigating away and back — the pick is meant to be a
 * commitment, and a rerollable commitment is not one.
 */
function rollGrowth(rng: Rng, warband: Warband, encounterIndex: number): GrowthOffer[] {
  return warband.prospects
    .filter(isReadyToMutate)
    .map((p) => ({ prospectId: p.id, choices: rollGrowthChoices(rng, p, encounterIndex) }))
    .filter((offer) => offer.choices.length > 0)
}

/** Take one of the offered mutations. Permanent — there is no undo. */
export function chooseMutation(
  state: RunState,
  prospectId: string,
  choiceIndex: number,
): RunState {
  const offer = state.growth.find((g) => g.prospectId === prospectId)
  const choice = offer?.choices[choiceIndex]
  if (!offer || !choice) return state

  const before = state.warband.prospects.find((p) => p.id === prospectId)
  const prospects = state.warband.prospects.map((p) =>
    p.id === prospectId
      ? revealIfMaxed({ ...p, mutations: [...p.mutations, choice], growth: p.growth + 1 })
      : p,
  )

  /*
   * Promotion is derived, not stored — a Firstborn is simply a Prospect with
   * enough mutations, so there is no flag to keep in sync. But the *moment*
   * has to be announced: this is the rarest thing in a run and the player
   * should not have to notice a title quietly changing in a list.
   */
  const after = prospects.find((p) => p.id === prospectId)
  const promoted =
    before && after && !isFirstborn(before) && isFirstborn(after) ? after.id : null

  return {
    ...state,
    warband: { ...state.warband, prospects },
    growth: state.growth.filter((g) => g.prospectId !== prospectId),
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
export function appraise(state: RunState, prospectId: string): RunState {
  const target = state.warband.prospects.find((p) => p.id === prospectId)
  if (!target || target.appraised) return state
  if (state.warband.salvage < APPRAISAL_COST) return state

  return {
    ...state,
    warband: {
      ...state.warband,
      salvage: state.warband.salvage - APPRAISAL_COST,
      prospects: state.warband.prospects.map((p) =>
        p.id === prospectId ? { ...p, appraised: true } : p,
      ),
    },
  }
}

/**
 * Pay to advance one rung of recovery — docs/V0-DESIGN.md §7's "spend to
 * heal, or send them in hurt and risk the next rung." One rung per payment,
 * same step size as free recovery, so a badly wounded Prospect is a choice
 * of how many times to pay rather than one lump sum.
 */
export function treatWound(state: RunState, prospectId: string): RunState {
  const target = state.warband.prospects.find((p) => p.id === prospectId)
  if (!target || !target.wound) return state
  if (state.warband.salvage < TREAT_COST) return state

  return {
    ...state,
    warband: {
      ...state.warband,
      salvage: state.warband.salvage - TREAT_COST,
      prospects: state.warband.prospects.map((p) =>
        p.id === prospectId ? { ...p, wound: recoverWound(p.wound, 1) } : p,
      ),
    },
  }
}

/**
 * Pay to treat an Officer.
 *
 * Officers pick up wounds too — resolveBattle gives one to any Officer whose
 * squad ended the battle collapsing — and until now there was no way to spend
 * on it. A wounded Officer scales its ENTIRE squad bonus down (wounds.ts and
 * officerBonusMultiplier), so a Crippled Warden hands its squad 1.55 armour
 * instead of 2.5 and the player had no lever at all. Same cost and same
 * one-rung step as a Prospect, because it is the same decision: pay now, or
 * field them hurt and risk the next rung.
 */
export function treatOfficer(state: RunState, officerId: string): RunState {
  const target = state.warband.officers.find((o) => o.id === officerId)
  if (!target || !target.wound) return state
  if (state.warband.salvage < TREAT_COST) return state

  return {
    ...state,
    warband: {
      ...state.warband,
      salvage: state.warband.salvage - TREAT_COST,
      officers: state.warband.officers.map((o) =>
        o.id === officerId ? { ...o, wound: recoverWound(o.wound, 1) } : o,
      ),
    },
  }
}

/**
 * Bench or field a Prospect.
 *
 * Fielding is capped; holding is not. Comparable games all cap what you field
 * rather than what you own (docs/V0-DESIGN.md §5b), and the gap is where the
 * reserve lives: bench a wounded body to let it recover, hold a graded one to
 * sell, field the six you actually want fighting.
 */
export function setFielded(state: RunState, prospectId: string, fielded: boolean): RunState {
  const target = state.warband.prospects.find((p) => p.id === prospectId)
  if (!target || target.fielded === fielded) return state
  if (fielded && fieldedCount(state.warband.prospects) >= MAX_FIELDED_PROSPECTS) return state

  const prospects = state.warband.prospects.map((p) =>
    p.id === prospectId ? { ...p, fielded } : p,
  )
  // A benched body cannot lead a squad it is not standing with.
  const squads = fielded
    ? state.warband.squads
    : state.warband.squads.map((sq) =>
        sq.leader?.kind === 'prospect' && sq.leader.id === prospectId
          ? { ...sq, leader: null }
          : sq,
      )

  return { ...state, warband: { ...state.warband, prospects, squads } }
}

/**
 * Sell a body.
 *
 * This is what closes the speculation loop. You buy blind at the assumed
 * price; if it grades out deep you can realise that as salvage instead of
 * only as a fighter. The SELL_RATE spread is what stops buy-appraise-sell
 * being an infinite money loop — a body has to actually grade above average
 * for the round trip to profit.
 */
export function sellProspect(state: RunState, prospectId: string): RunState {
  const target = state.warband.prospects.find((p) => p.id === prospectId)
  if (!target) return state

  const value = sellValue(target, unitType(target.typeId).cost)
  return {
    ...state,
    warband: {
      ...state.warband,
      salvage: state.warband.salvage + value,
      prospects: state.warband.prospects.filter((p) => p.id !== prospectId),
      squads: state.warband.squads.map((sq) =>
        sq.leader?.kind === 'prospect' && sq.leader.id === prospectId
          ? { ...sq, leader: null }
          : sq,
      ),
    },
  }
}

/**
 * Answer the camp's pending event.
 *
 * The resolver is the only thing that knows how to apply an effect, so
 * widening the vocabulary means changing one function rather than every
 * event. Adding an *event* stays a data change — see events.ts.
 */
export function resolveEvent(state: RunState, choiceIndex: number): RunState {
  const choice = state.event?.choices[choiceIndex]
  if (!state.event || !choice) return state
  if (choice.requires !== undefined && state.warband.salvage < choice.requires) return state

  return {
    ...state,
    event: null,
    seenEvents: [...state.seenEvents, state.event.id],
    warband: {
      ...state.warband,
      salvage: state.warband.salvage + (choice.salvage ?? 0),
      morale: clampMorale(state.warband.morale + (choice.morale ?? 0)),
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
    prospects: [...state.warband.prospects],
    officers: [...state.warband.officers],
  }

  if (offer.kind === 'squad') {
    const leader = offer.prospects[0]
    const newSquad = {
      id: offer.id,
      typeId: offer.typeId,
      count: offer.count,
      leader: leader ? { kind: 'prospect' as const, id: leader.id } : null,
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
    warband.prospects.push(...offer.prospects)
  } else {
    warband.officers.push(offer.officer)
  }

  return { ...state, warband, offers: state.offers.filter((o) => o.id !== offerId) }
}

/**
 * One leader per squad, of either kind, so assigning is genuinely a choice
 * between an Officer's flat bonus and a Prospect's mutation leak. A
 * Prospect can only lead its own kind — a mutant does not command True Kin.
 * Any leader can only lead one squad at a time.
 */
export function assignLeader(
  state: RunState,
  squadId: string,
  leader: SquadLeader | null,
): RunState {
  const target = state.warband.squads.find((sq) => sq.id === squadId)
  if (!target) return state

  if (leader?.kind === 'prospect' && unitType(target.typeId).lineage !== 'mutant') {
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
 * A Prospect always fights as its own body, whether or not it is leading a
 * squad, so it can die independently of the squad it leads — losing a leader
 * mid-battle just means the squad finishes the fight on its own stats.
 * Prospects that live gain a battle towards Firstborn (M2).
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
  const prospectResult = new Map<string, GroupResult>()
  playerSources.forEach((src, i) => {
    if (src.kind === 'squad') squadResult.set(src.id, playerResults[i])
    else prospectResult.set(src.id, playerResults[i])
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

  const prospectLosses: ProspectLoss[] = []
  const prospects = state.warband.prospects
    .map((p) => {
      const r = prospectResult.get(p.id)
      const died = r ? r.survived === 0 : false
      prospectLosses.push({
        name: p.name,
        label: prospectTitle(p, unitType(p.typeId).name),
        died,
        battles: p.battles + (died ? 0 : 1),
      })
      if (died) return null
      // Wound ladder — docs/V0-DESIGN.md §7. A Prospect always fights as its
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
  // to every Officer regardless, same as Prospects above.
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
  const livingProspects = new Set(prospects.map((p) => p.id))
  const livingOfficers = new Set(officers.map((o) => o.id))
  const survivingSquads = squads.map((sq) => {
    if (!sq.leader) return sq
    const alive =
      sq.leader.kind === 'officer'
        ? livingOfficers.has(sq.leader.id)
        : livingProspects.has(sq.leader.id)
    return alive ? sq : { ...sq, leader: null }
  })

  const salvageEarned = won ? state.encounter.reward : 0

  return {
    ...state,
    phase: 'report',
    warband: {
      ...state.warband,
      squads: survivingSquads,
      prospects,
      officers,
      salvage: state.warband.salvage + salvageEarned,
    },
    report: {
      won,
      encounterName: state.encounter.name,
      salvageEarned,
      squads: squadLosses,
      prospects: prospectLosses,
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
    event: rollEvent(state.rng, state.seenEvents),
  }
}

export { ENCOUNTERS_PER_RUN }
