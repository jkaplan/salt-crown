export { UNIT_TYPES, MUTANT_TYPES, TRUEKIN_TYPES, DISCIPLINE } from './units.js'
export { MUTATIONS, MUTATIONS_BY_ID, describeRoll, leakLevel } from './mutations.js'
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
  resolveDiscipline,
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
export { rollOffers } from './shop.js'
export type { Offer, SquadOffer, OfficerOffer } from './shop.js'
export { ENCOUNTERS_PER_RUN, generateEncounter } from './encounters.js'
export type { Encounter } from './encounters.js'
export {
  newRun,
  buy,
  assignLeader,
  chooseMutation,
  appraise,
  treatWound,
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
  BattleSetup,
  GrowthOffer,
} from './run.js'
