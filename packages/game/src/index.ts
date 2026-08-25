export { UNIT_TYPES, MUTANT_TYPES, TRUEKIN_TYPES, MACHINE_TYPES, DISCIPLINE } from './units.js'
export { MUTATIONS, MUTATIONS_BY_ID, describeRoll } from './mutations.js'
export type { Mutation, MutationRoll } from './mutations.js'
export {
  OFFICER_RANKS,
  OFFICER_RANKS_BY_ID,
  HOUSES,
  rollOfficer,
  officerTitle,
} from './officers.js'
export type { Officer, OfficerRank } from './officers.js'
export {
  PROSPECT_HP_MULT,
  PROSPECT_COST_PER_LEVEL,
  rollProspect,
  prospectCost,
  prospectTitle,
  isReadyToMutate,
  isMaxed,
  canBecomeFirstborn,
  rollCapacity,
  capacityGrade,
  PROSPECT_COST_PER_CAPACITY,
  APPRAISAL_COST,
  ASSUMED_CAPACITY,
  MAX_FIELDED_PROSPECTS,
  SELL_RATE,
  fieldedCount,
  sellValue,
  revealIfMaxed,
  isFirstborn,
  earnedGrowth,
  rollGrowthChoices,
  BATTLES_PER_MUTATION,
  FIRSTBORN_AT_MUTATIONS,
} from './prospects.js'
export type { Prospect } from './prospects.js'
export {
  WOUND_ZONES,
  WOUND_RUNG_NAMES,
  WOUND_ZONE_NAMES,
  WOUND_PENALTY,
  TREAT_COST,
  FREE_RECOVERY_MUTANT,
  FREE_RECOVERY_TRUEKIN,
  OFFICER_WOUND_CHANCE_ON_COLLAPSE,
  escalateWound,
  recoverWound,
  applyWoundPenalty,
  officerBonusMultiplier,
} from './wounds.js'
export type { Wound, WoundZone, WoundRung } from './wounds.js'
export {
  unitType,
  squadLabel,
  squadCost,
  resolveSquadStats,
  resolveProspectStats,
  resolveMachineStats,
  machinePower,
  resolveDiscipline,
  LEADING_PROSPECT_DISCIPLINE_BONUS,
  squadShape,
  statPower,
  squadPower,
  prospectPower,
  warbandPower,
  findOfficer,
  findLeadingProspect,
  totalFodder,
  totalBodies,
  fodderByType,
  toSimGroups,
  makeGroup,
} from './roster.js'
export type { Squad, SquadLeader, Warband, GroupSource } from './roster.js'
export {
  EVENTS,
  MORALE_MIN,
  MORALE_MAX,
  clampMorale,
  moraleWord,
  rollEvent,
} from './events.js'
export type { GameEvent, EventChoice } from './events.js'
export {
  WATER_PER_BODY,
  ROSTER_SCALE_DIVISOR,
  MORALE_PER_DESERTER,
  waterUpkeep,
  payWater,
  waterState,
} from './water.js'
export type { DesertionResult } from './water.js'
export {
  MAX_CREW,
  resolveExpedition,
  expectedHaul,
  expeditionCost,
  expeditionRisk,
} from './expeditions.js'
export type { Expedition, ExpeditionResult, Verb } from './expeditions.js'
export {
  BIONICS,
  BIONICS_BY_ID,
  BIONIC_SLOTS,
  applyBionics,
  bionicValue,
} from './bionics.js'
export type { Bionic } from './bionics.js'
export {
  MACHINE_CONDITION_MAX,
  MACHINE_RUN_COST,
  rollMachine,
  conditionMultiplier,
  conditionWord,
  machineTitle,
  isScrap,
  applyCondition,
} from './machines.js'
export type { Machine } from './machines.js'
export { FAUNA_TYPES, BOSS_TYPES } from './wasteland.js'
export { LEGENDARY_TYPES, LEGENDARY_IDS } from './legendaries.js'
export {
  ORIGINS,
  ORIGINS_BY_ID,
  MAX_FOUNDING_MUTATIONS,
  FOUNDING_LEVELS,
  foundingLevel,
  foundingFirstborn,
  startingWarband,
} from './origins.js'
export type { Origin, OriginId, StartChoice } from './origins.js'
export { postmortem } from './postmortem.js'
export type { Postmortem } from './postmortem.js'
export { scoutEnemy, armorWord, mixWord } from './scouting.js'
export type { ScoutingReport } from './scouting.js'
export { rollOffers } from './shop.js'
export type { Offer, SquadOffer, OfficerOffer } from './shop.js'
export {
  ENCOUNTERS_PER_RUN,
  ENCOUNTERS_PER_ACT,
  ACTS,
  actOf,
  isBossIndex,
  encounterBudget,
  generateEncounter,
  encounterLegendaryId,
} from './encounters.js'
export type { Encounter, EncounterKind } from './encounters.js'
export {
  newRun,
  buy,
  assignLeader,
  chooseMutation,
  appraise,
  setFielded,
  resolveEvent,
  sellProspect,
  treatWound,
  treatOfficer,
  installBionic,
  sendExpedition,
  recallExpedition,
  moveSquad,
  placeSquad,
  buildBattle,
  march,
  resolveBattle,
  advance,
} from './run.js'
export type {
  RunState,
  Phase,
  BattleReport,
  SquadLoss,
  ProspectLoss,
  MachineLoss,
  BattleSetup,
  GrowthOffer,
} from './run.js'
