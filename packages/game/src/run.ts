import { BattleEventType, COLLAPSE_THRESHOLD, Rng, TEAM_A, TEAM_B, hashSeed } from '@salt/sim'
import type { BattleConfig, BattleEvent, GroupResult, SimGroup, Winner } from '@salt/sim'
import { ENCOUNTERS_PER_RUN, encounterLegendaryId, generateEncounter } from './encounters.js'
import type { Encounter } from './encounters.js'
import { newId, rollOffers, rollSquadBatch } from './shop.js'
import type { Offer } from './shop.js'
import { rollOfficer } from './officers.js'
import { toSimGroups, totalBodies, unitType } from './roster.js'
import type { GroupSource, SquadLeader, Warband } from './roster.js'
import {
  APPRAISAL_COST,
  INSTABILITY_PER_PUSH,
  MAX_FIELDED_PROSPECTS,
  fieldedCount,
  isFirstborn,
  isPastCapacity,
  isReadyToMutate,
  prospectTitle,
  resolveInstabilityFlares,
  revealIfMaxed,
  rollGrowthChoices,
  rollProspect,
  sellValue,
} from './prospects.js'
import type { MutationRoll } from './mutations.js'
import type { Prospect } from './prospects.js'
import type { Machine } from './machines.js'
import { clampMorale, rollCampEvent, rollCampOptions } from './events.js'
import type { CampOption, EventCategory } from './events.js'
import { MORALE_PER_DESERTER, payWater } from './water.js'
import { BIONICS, BIONICS_BY_ID, BIONIC_SLOTS } from './bionics.js'
import { RELICS, RELICS_BY_ID } from './relics.js'
import { postmortem } from './postmortem.js'
import type { Postmortem } from './postmortem.js'
import {
  MACHINE_CONDITION_MAX,
  MACHINE_RUN_COST,
  isScrap,
  machineTitle,
  rollMachine,
} from './machines.js'
import { MAX_CREW, expeditionCost, resolveExpedition } from './expeditions.js'
import type { Expedition, ExpeditionResult, Verb } from './expeditions.js'
import type { GameEvent } from './events.js'
import { MUTANT_TYPES } from './units.js'
import { ORIGINS, ORIGINS_BY_ID, startingWarband } from './origins.js'
import type { OriginId, StartChoice } from './origins.js'
import {
  escalateWound,
  FREE_RECOVERY_MUTANT,
  FREE_RECOVERY_TRUEKIN,
  OFFICER_WOUND_CHANCE_ON_COLLAPSE,
  recoverWound,
  TREAT_COST,
  WOUND_ZONES,
  harmKindFromLabel,
} from './wounds.js'
import type { PermanentInjury } from './wounds.js'

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
  /** Damage this squad lost to enemy armour before it landed. */
  damageBlocked: number
}

export interface MachineLoss {
  name: string
  label: string
  destroyed: boolean
  /** Condition left after the battle wore it down. */
  condition: number
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
  waterEarned: number
  /** What getting here cost, and who walked rather than march thirsty. */
  upkeep: { spent: number; deserted: number; cold: number } | null
  squads: SquadLoss[]
  prospects: ProspectLoss[]
  machines: MachineLoss[]
  enemy: GroupResult[]
  /** Why it went the way it did — see postmortem.ts. */
  why: Postmortem
  ticks: number
}

/** A Prospect that has survived enough to earn a mutation, and its options. */
export interface GrowthOffer {
  prospectId: string
  choices: MutationRoll[]
}

export interface RunState {
  seedText: string
  /** Who you are. Decides the starting roster and what True Kin charge you. */
  origin: OriginId
  rng: Rng
  phase: Phase
  encounterIndex: number
  warband: Warband
  offers: Offer[]
  /** Times this camp's offers have been rerolled. Resets to 0 at the next camp. */
  rerollCount: number
  encounter: Encounter
  report: BattleReport | null
  /** Growth picks waiting at this camp. Rolled once so they cannot be rerolled. */
  growth: GrowthOffer[]
  /** Prospects promoted to Firstborn since the last camp. Announced, then cleared. */
  promoted: string[]
  /**
   * The crossroads: 1-3 rumors of what the next stop might be, none of them
   * naming it outright. Blocks the march the same way `event` does, and
   * resolves into one via `chooseCampOption` — never both set at once.
   */
  campOptions: CampOption[]
  /** The camp's pending event. Blocks the march — a skippable choice is not one. */
  event: GameEvent | null
  /** Events already fired, so a run never repeats one. */
  seenEvents: string[]
  /** Legendary type ids already encountered, so a run never repeats one — see
   * docs/V0-DESIGN.md §15 and encounters.ts's buildLegendary. */
  seenLegendaries: number[]
  /**
   * What the last march cost, and who walked because of it. Cleared when the
   * next camp opens. Desertion happens on the march, so this is how the
   * report and the next camp can say what happened rather than leaving the
   * player to notice a smaller warband.
   */
  lastUpkeep: { spent: number; deserted: number; cold: number } | null
  /**
   * The crew that is out. Sent at camp, resolved when the NEXT camp opens —
   * so the battle in between is fought without them and without knowing
   * whether it paid off. That gap is the gamble; resolving on send would make
   * it a purchase.
   */
  expedition: Expedition | null
  /** What the last crew brought back. Shown at camp, then cleared. */
  expeditionResult: ExpeditionResult | null
  outcome: 'won' | 'lost' | null
}

export function newRun(seedText: string, choice: StartChoice = { origin: 'scion' }): RunState {
  const rng = new Rng(hashSeed(seedText))
  const warband = startingWarband(rng, choice)
  const origin = ORIGINS_BY_ID.get(choice.origin) ?? ORIGINS[0]
  const encounter = generateEncounter(rng, 0)
  const legendaryId = encounterLegendaryId(encounter)

  return {
    seedText,
    origin: origin.id,
    rng,
    phase: 'camp',
    encounterIndex: 0,
    warband,
    offers: rollOffers(rng, 0, origin.truekinPremium),
    rerollCount: 0,
    encounter,
    report: null,
    growth: [],
    promoted: [],
    campOptions: [],
    event: null,
    seenEvents: [],
    seenLegendaries: legendaryId === null ? [] : [legendaryId],
    lastUpkeep: null,
    expedition: null,
    expeditionResult: null,
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
  // A pick taken while the body is already at or past its own capacity is a
  // push — the body being forced somewhere it wasn't built to hold. See
  // Instability, docs/V0-DESIGN.md §15.
  const pushed = before !== undefined && isPastCapacity(before)
  const prospects = state.warband.prospects.map((p) =>
    p.id === prospectId
      ? revealIfMaxed({
          ...p,
          mutations: [...p.mutations, choice],
          growth: p.growth + 1,
          instability: pushed ? p.instability + INSTABILITY_PER_PUSH : p.instability,
        })
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
 * Answer the crossroads: pick which rumor to follow. Rolls the real event
 * fresh, right now — nothing was decided when the rumor was only a hint, so
 * this is the first moment the RNG has any opinion about which of the
 * category's events it actually is.
 */
export function chooseCampOption(state: RunState, category: EventCategory): RunState {
  if (!state.campOptions.some((o) => o.category === category)) return state
  const has = new Set<'machine'>(state.warband.machines.length > 0 ? (['machine'] as const) : [])
  const event = rollCampEvent(state.rng, state.seenEvents, has, category)
  return { ...state, campOptions: [], event }
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

  /*
   * The Tinkerer — §3's "exception that proves the rule". The only thing in
   * the game that puts condition back, and it arrives as an event rather than
   * a service because a shop that sells repairs turns a decaying asset into an
   * ordinary one.
   *
   * Applied to the MOST WORN machine, which is what somebody would actually
   * work on, and which means the player never has to pick a target inside an
   * event choice.
   */
  let machines = state.warband.machines
  if (choice.restoreMachine && machines.length > 0) {
    let worst = 0
    for (let i = 1; i < machines.length; i++) {
      if (machines[i].condition < machines[worst].condition) worst = i
    }
    machines = machines.map((m, i) =>
      i === worst
        ? { ...m, condition: Math.min(MACHINE_CONDITION_MAX, m.condition + choice.restoreMachine!) }
        : m,
    )
  }

  /*
   * A coffle, a splinter band, a garrison walking off its post — granted
   * straight into the warband rather than turned into offers, because the
   * event already IS the decision to take them on. Rolled from the same
   * lottery the market uses (rollSquadBatch), so the odds of a batch
   * carrying a Prospect are the odds a player already knows from shopping.
   */
  let squads = state.warband.squads
  let prospects = state.warband.prospects
  if (choice.grantSquads) {
    for (let i = 0; i < choice.grantSquads.count; i++) {
      const batch = rollSquadBatch(state.rng, state.encounterIndex, choice.grantSquads.pool)
      squads = [
        ...squads,
        { id: newId(state.rng, 's'), typeId: batch.typeId, count: batch.count, leader: null },
      ]
      prospects = [...prospects, ...batch.prospects]
    }
  }

  let officers = state.warband.officers
  if (choice.grantOfficer) {
    officers = [...officers, rollOfficer(state.rng, newId(state.rng, 'off'))]
  }

  /*
   * The caravan's whole reason for existing: reveal this camp's market
   * instead of leaving it empty. Any other event leaves `offers` exactly as
   * it was — [] unless this camp's event already opened it.
   */
  const offers = choice.opensMarket
    ? rollOffers(
        state.rng,
        state.encounterIndex,
        ORIGINS_BY_ID.get(state.origin)?.truekinPremium ?? 1,
      )
    : state.offers

  return {
    ...state,
    event: null,
    seenEvents: [...state.seenEvents, state.event.id],
    offers,
    warband: {
      ...state.warband,
      machines,
      squads,
      prospects,
      officers,
      salvage: state.warband.salvage + (choice.salvage ?? 0),
      morale: clampMorale(state.warband.morale + (choice.morale ?? 0)),
    },
  }
}

/**
 * Send a crew into a ruin.
 *
 * The crew stops being fielded, which is the existing mechanism for "does not
 * deploy, does not accrue battles towards Firstborn, cannot die in the
 * battle" — exactly what being somewhere else means. setFielded also drops
 * their squad leadership, so a squad does not keep the discipline bonus of a
 * Prospect who is two days away down a stairwell.
 */
export function sendExpedition(state: RunState, verb: Verb, crew: string[]): RunState {
  if (state.expedition) return state
  if (crew.length === 0 || crew.length > MAX_CREW) return state

  const unique = [...new Set(crew)]
  if (unique.length !== crew.length) return state
  if (!unique.every((id) => state.warband.prospects.some((p) => p.id === id))) return state

  /*
   * Outfitting the crew is paid in SALVAGE, and staked whether or not they
   * find anything. Without a cost, expeditions were free and delving every
   * camp took the greedy bot from 20.8% to 66.0%. Charging WATER over-
   * corrected it to 0.0% — water is the binding constraint, so trading it
   * away is never right. Salvage is what a warband ends up unable to spend,
   * which is exactly what should be at risk here.
   */
  const cost = expeditionCost(verb, unique.length, state.encounterIndex)
  if (cost > state.warband.salvage) return state

  let next = state
  for (const id of unique) next = setFielded(next, id, false)

  return {
    ...next,
    warband: { ...next.warband, salvage: next.warband.salvage - cost },
    expedition: { verb, crew: unique, staked: cost },
  }
}

/** Call the crew back before they leave. Free — nothing has happened yet. */
export function recallExpedition(state: RunState): RunState {
  if (!state.expedition) return state
  // Full refund. They have not left camp, and a partial refund would only
  // punish the player for changing their mind inside the same screen.
  let next: RunState = {
    ...state,
    expedition: null,
    warband: { ...state.warband, salvage: state.warband.salvage + state.expedition.staked },
  }
  for (const id of state.expedition.crew) next = setFielded(next, id, true)
  return next
}

/**
 * Bring the crew home. Called when the next camp opens.
 *
 * Anyone lost is removed the same way a battle death removes them — this is
 * the permadeath tier, and a ruin is allowed to keep people.
 */
function returnExpedition(state: RunState): RunState {
  const out = state.expedition
  if (!out) return { ...state, expeditionResult: null }

  const crew = state.warband.prospects.filter((p) => out.crew.includes(p.id))
  const { result, crew: returned } = resolveExpedition(
    state.rng,
    out.verb,
    crew,
    state.encounterIndex,
    (rng, index) => rollProspect(rng, MUTANT_TYPES[rng.int(MUTANT_TYPES.length)].id, index),
    (rng) => BIONICS[rng.int(BIONICS.length)].id,
    rollMachine,
    (rng) => RELICS[rng.int(RELICS.length)].id,
  )

  const byId = new Map(returned.map((p) => [p.id, p]))
  const prospects = state.warband.prospects
    .map((p) => (out.crew.includes(p.id) ? (byId.get(p.id) ?? null) : p))
    .filter((p): p is Prospect => p !== null)
  prospects.push(...result.found)

  // A crew member who did not come back cannot still be leading a squad.
  const alive = new Set(prospects.map((p) => p.id))
  const squads = state.warband.squads.map((sq) =>
    sq.leader?.kind === 'prospect' && !alive.has(sq.leader.id) ? { ...sq, leader: null } : sq,
  )

  return {
    ...state,
    expedition: null,
    expeditionResult: result,
    warband: {
      ...state.warband,
      squads,
      prospects,
      salvage: state.warband.salvage + result.salvage,
      water: state.warband.water + result.water,
      bionics: [...state.warband.bionics, ...result.salvaged],
      machines: [...state.warband.machines, ...result.machines],
      relics: [...state.warband.relics, ...result.relics],
    },
  }
}

/**
 * Fit a found implant to an Officer — §6's "Install" lever.
 *
 * Finding it is free; fitting it is not. That gap is why a True Kin build is
 * described as taxed rather than locked (§13): the parts come out of ruins you
 * delved instead of reinforcing, and then you pay again to use them.
 *
 * Slots are scarce on purpose. Three is enough for a build to have a shape and
 * not enough to install everything you find, so a fourth find is a decision
 * rather than an inventory update.
 */
export function installBionic(state: RunState, officerId: string, bionicId: string): RunState {
  const officer = state.warband.officers.find((o) => o.id === officerId)
  const bionic = BIONICS_BY_ID.get(bionicId)
  if (!officer || !bionic) return state
  if (!state.warband.bionics.includes(bionicId)) return state
  if (officer.bionics.length >= BIONIC_SLOTS) return state
  // One of each. Two Carbide Edges on one body is an inventory exploit, not
  // a build.
  if (officer.bionics.includes(bionicId)) return state
  if (state.warband.salvage < bionic.cost) return state

  // Remove exactly one copy — the warband can hold duplicates from separate
  // delves, and they should be installable into separate officers.
  const stock = [...state.warband.bionics]
  stock.splice(stock.indexOf(bionicId), 1)

  return {
    ...state,
    warband: {
      ...state.warband,
      salvage: state.warband.salvage - bionic.cost,
      bionics: stock,
      officers: state.warband.officers.map((o) =>
        o.id === officerId ? { ...o, bionics: [...o.bionics, bionicId] } : o,
      ),
    },
  }
}

/**
 * Bind a found relic to a squad — the relic answer to installBionic above.
 *
 * One per squad, and binding over an existing one is refused rather than
 * silently discarding it: a relic came out of a ruin, not a shop, so losing
 * one to a misclick should not be possible.
 */
export function assignRelic(state: RunState, squadId: string, relicId: string): RunState {
  const squad = state.warband.squads.find((sq) => sq.id === squadId)
  const relic = RELICS_BY_ID.get(relicId)
  if (!squad || !relic) return state
  if (squad.relicId) return state
  if (!state.warband.relics.includes(relicId)) return state
  if (state.warband.salvage < relic.cost) return state

  const stock = [...state.warband.relics]
  stock.splice(stock.indexOf(relicId), 1)

  return {
    ...state,
    warband: {
      ...state.warband,
      salvage: state.warband.salvage - relic.cost,
      relics: stock,
      squads: state.warband.squads.map((sq) =>
        sq.id === squadId ? { ...sq, relicId } : sq,
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
 * Salvage to reroll THIS camp's four offers, escalating within the same
 * visit — the on-curve buying measurement showed composition choice is a
 * real lever, but a player who scouts a fight and gets four useless offers
 * has no way to act on what they now know. This is that lever.
 *
 * Escalates per reroll, reset at the next camp, so it stays "pay to fix a
 * genuinely bad draw" rather than "pay to keep drawing until the market
 * stops being a lottery" — the market's whole point (§8: buying blind is
 * roughly break-even in expectation) would collapse if a rich player could
 * just reroll to a guaranteed-good set for a flat fee.
 */
export function rerollCost(index: number, rerollCount: number): number {
  return 20 + 5 * index + 25 * rerollCount
}

export function rerollOffers(state: RunState): RunState {
  // Nothing to reroll if no caravan opened this camp's market in the first
  // place — otherwise this would be a back door to buying a market into
  // existence for the price of one reroll, which defeats the entire point of
  // gating it behind an event.
  if (state.offers.length === 0) return state
  const cost = rerollCost(state.encounterIndex, state.rerollCount)
  if (state.warband.salvage < cost) return state

  return {
    ...state,
    warband: { ...state.warband, salvage: state.warband.salvage - cost },
    offers: rollOffers(
      state.rng, state.encounterIndex, ORIGINS_BY_ID.get(state.origin)?.truekinPremium ?? 1,
    ),
    rerollCount: state.rerollCount + 1,
  }
}

/**
 * One leader per squad, of either kind, so assigning is genuinely a choice
 * between an Officer's flat bonus and a Prospect's discipline bonus. A
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

/**
 * Break camp. The march is where the water is spent.
 *
 * Charged BEFORE the battle, not after, so a shortfall costs you bodies in
 * the fight it caused rather than being a bookkeeping note afterwards. Camp
 * shows the bill and names the exact number who will walk, so this is never a
 * surprise — it is a decision the player declined to make.
 *
 * Returns the battle setup along with the state, rather than leaving the
 * caller to call buildBattle itself. Both callers used to build the battle
 * from the pre-march warband, which was harmless until the march started
 * removing bodies — deserters would have marched anyway. Handing back a setup
 * that is already consistent with the state makes that ordering impossible to
 * get wrong.
 */
export function march(state: RunState): { state: RunState; setup: BattleSetup } {
  const { squads, deserted, spent, remaining } = payWater(state.warband)

  /*
   * Machines cost salvage per battle just to run — §3's "expensive to merely
   * own". Anything the warband cannot pay for stays cold and does not march:
   * a visible consequence, rather than a hidden extra step of degradation
   * that the player would only notice as a machine dying early.
   *
   * Cheapest possible rule, deliberately: they come off the end of the list,
   * so the player controls which ones by ordering them, the same way the
   * battle line works.
   */
  let salvage = state.warband.salvage
  const running: Machine[] = []
  const cold: Machine[] = []
  for (const m of state.warband.machines) {
    if (salvage >= MACHINE_RUN_COST) {
      salvage -= MACHINE_RUN_COST
      running.push(m)
    } else {
      cold.push(m)
    }
  }

  const marched: RunState = {
    ...state,
    phase: 'battle',
    warband: {
      ...state.warband,
      squads,
      salvage,
      water: remaining,
      // Only the machines that are running take the field. The cold ones are
      // still owned, still drink, and are back on the list next camp.
      machines: running,
      morale: clampMorale(state.warband.morale - deserted * MORALE_PER_DESERTER),
    },
    lastUpkeep: { spent, deserted, cold: cold.length },
  }

  const setup = buildBattle(marched)
  // Put the cold ones back before handing the state on, so they are not
  // quietly lost between the march and the report.
  return {
    state: { ...marched, warband: { ...marched.warband, machines: [...running, ...cold] } },
    setup,
  }
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
  events: BattleEvent[] = [],
): RunState {
  const playerResults = results.slice(0, playerSources.length)
  const enemyResults = results.slice(playerSources.length)
  const won = winner === TEAM_A

  const squadResult = new Map<string, GroupResult>()
  const prospectResult = new Map<string, GroupResult>()
  const machineResult = new Map<string, GroupResult>()
  playerSources.forEach((src, i) => {
    if (src.kind === 'squad') squadResult.set(src.id, playerResults[i])
    else if (src.kind === 'machine') machineResult.set(src.id, playerResults[i])
    else prospectResult.set(src.id, playerResults[i])
  })

  /*
   * Permanent injuries — docs/V0-DESIGN.md §15. The sim already decided WHO
   * survived maimed instead of dying (Battle.resolveDeath, MAIM_CHANCE); all
   * that's left is turning its group-index events back into Prospect ids,
   * which only this layer can do (the sim is lineage-blind — see wounds.ts's
   * harmKindFromLabel comment for why harm kind is guessed from a label
   * instead of threaded through as a real type).
   */
  const newInjuries = new Map<string, PermanentInjury[]>()
  const newDismemberments = new Map<string, { victim: string; encounterIndex: number }[]>()
  for (const e of events) {
    if (e.type !== BattleEventType.Maimed) continue

    // Victim: one of MY Prospects took the maiming.
    if (e.groupIndex < playerSources.length) {
      const src = playerSources[e.groupIndex]
      if (src.kind === 'prospect') {
        const injury: PermanentInjury = {
          zone: WOUND_ZONES[state.rng.int(WOUND_ZONES.length)],
          harmKind: harmKindFromLabel(e.sourceLabel),
          attacker: e.sourceLabel,
          encounterIndex: state.encounterIndex,
        }
        const list = newInjuries.get(src.id) ?? []
        list.push(injury)
        newInjuries.set(src.id, list)
      }
    }

    // Attacker: one of MY Prospects dealt the maiming. Only a Prospect's own
    // body earns the credit — an anonymous squad landing the same hit has no
    // one specific to credit it to.
    if (e.sourceGroupIndex >= 0 && e.sourceGroupIndex < playerSources.length) {
      const src = playerSources[e.sourceGroupIndex]
      if (src.kind === 'prospect') {
        const list = newDismemberments.get(src.id) ?? []
        list.push({ victim: e.label, encounterIndex: state.encounterIndex })
        newDismemberments.set(src.id, list)
      }
    }
  }

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
        damageBlocked: r.damageBlocked,
      })
      return { ...sq, count: r.survived }
    })
    .filter((sq) => sq.count > 0)

  const prospectLosses: ProspectLoss[] = []
  const prospects = state.warband.prospects
    .map((p) => {
      const r = prospectResult.get(p.id)
      const died = r ? r.survived === 0 : false
      /*
       * A body that never left camp is not part of this battle. It earns no
       * battle towards Firstborn, and it does not appear in the report as a
       * survivor of a fight it sat out.
       *
       * prospects.ts states the rule outright — "Unfielded Prospects are
       * stock: they do not deploy, do not accrue battles towards Firstborn"
       * — and nothing enforced it, which made benching strictly better than
       * fielding: the body could not die and grew anyway. Read from the sim
       * result rather than from the fielded flag, so credit follows having
       * actually been in the fight; fielded is the upstream mechanism that
       * decides it, and expedition crews are unfielded for exactly this
       * reason.
       */
      const fought = r !== undefined
      if (fought) {
        prospectLosses.push({
          name: p.name,
          label: prospectTitle(p, unitType(p.typeId).name),
          died,
          battles: p.battles + (died ? 0 : 1),
        })
      }
      if (died) return null
      // Wound ladder — docs/V0-DESIGN.md §7. A Prospect always fights as its
      // own body (see the doc comment above), so the trigger is direct: it
      // survived and still took damage. Free recovery (Mutant: 2 rungs) is
      // applied in the same pass, so a fresh wound already has a chance to
      // shrink before the player sees the report.
      let wound = r && r.damageTaken > 0 ? escalateWound(p.wound, state.rng) : p.wound
      wound = recoverWound(wound, FREE_RECOVERY_MUTANT)
      const injuries = newInjuries.get(p.id)
      const dealt = newDismemberments.get(p.id)
      return {
        ...p,
        battles: fought ? p.battles + 1 : p.battles,
        wound,
        permanentInjuries: injuries ? [...p.permanentInjuries, ...injuries] : p.permanentInjuries,
        dismemberments: dealt ? [...p.dismemberments, ...dealt] : p.dismemberments,
      }
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

  /*
   * Machines only degrade — §3. One step of condition per battle FOUGHT, so a
   * machine left cold at the march keeps what it has; that is the only lever
   * the player has over the clock, and it is why the running cost is a
   * decision rather than a tax.
   *
   * Destroyed is permanent and total. There is no wound ladder here: a body
   * can be Strained and recover, a machine that stops is scrap. Nobody can
   * build another one.
   */
  const machineLosses: MachineLoss[] = []
  const machines = state.warband.machines
    .map((m) => {
      const r = machineResult.get(m.id)
      if (!r) return m // stayed cold; no wear, no risk
      const destroyed = r.survived === 0
      const worn = { ...m, condition: m.condition - 1 }
      machineLosses.push({
        name: m.name,
        label: machineTitle(m, unitType(m.typeId).name),
        destroyed,
        condition: Math.max(0, worn.condition),
      })
      if (destroyed || isScrap(worn)) return null
      return worn
    })
    .filter((m): m is NonNullable<typeof m> => m !== null)

  const salvageEarned = won ? state.encounter.reward : 0
  // Winning refills the cistern. In V0 this is the only source of water —
  // expeditions (§9) are the other one and are not built yet, which is why
  // the payout has to cover a growing roster on its own.
  const waterEarned = won ? state.encounter.waterReward : 0

  return {
    ...state,
    phase: 'report',
    warband: {
      ...state.warband,
      squads: survivingSquads,
      prospects,
      officers,
      machines,
      salvage: state.warband.salvage + salvageEarned,
      water: state.warband.water + waterEarned,
    },
    report: {
      won,
      encounterName: state.encounter.name,
      salvageEarned,
      waterEarned,
      upkeep: state.lastUpkeep,
      squads: squadLosses,
      prospects: prospectLosses,
      machines: machineLosses,
      enemy: enemyResults,
      why: postmortem(playerResults, enemyResults, won),
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

  const returned = returnExpedition(state)
  // Bodies pushed past their own capacity can mutate on their own before the
  // player ever sees a growth offer this camp — see Instability, §15.
  const home = { ...returned, warband: resolveInstabilityFlares(state.rng, returned.warband) }
  const encounter = generateEncounter(state.rng, next, state.seenLegendaries)
  const legendaryId = encounterLegendaryId(encounter)

  return {
    ...home,
    phase: 'camp',
    encounterIndex: next,
    // Empty by default now — the market is something that has to happen to
    // you (the caravan event, below) rather than a standing shop rerolled at
    // every camp. See events.ts's MARKET_CHANCE.
    offers: [],
    rerollCount: 0,
    encounter,
    seenLegendaries:
      legendaryId === null ? state.seenLegendaries : [...state.seenLegendaries, legendaryId],
    report: null,
    growth: rollGrowth(state.rng, home.warband, next),
    promoted: [],
    // The gate is read from the warband AFTER the crew comes home, so a
    // machine that walked out of a ruin this camp can be worked on this camp.
    // Only the rumors are rolled here — the real event waits for the player
    // to pick one, in chooseCampOption below.
    campOptions: rollCampOptions(
      state.rng,
      state.seenEvents,
      new Set(home.warband.machines.length > 0 ? (['machine'] as const) : []),
    ),
    event: null,
    // The report has already said what the last march cost. Carrying it into
    // the next camp would put a stale number next to the live one.
    lastUpkeep: null,
  }
}

export { ENCOUNTERS_PER_RUN }
