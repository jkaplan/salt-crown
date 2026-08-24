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
  POTENTIAL_HP_MULT,
  POTENTIAL_COST_PER_LEVEL,
  rollPotential,
  potentialCost,
  potentialTitle,
  isReadyToMutate,
  isMaxed,
  canBecomeFirstborn,
  rollCapacity,
  capacityGrade,
  POTENTIAL_COST_PER_CAPACITY,
  isFirstborn,
  earnedGrowth,
  rollGrowthChoices,
  BATTLES_PER_MUTATION,
  FIRSTBORN_AT_MUTATIONS,
} from './potentials.js'
export type { Potential } from './potentials.js'
export {
  unitType,
  squadLabel,
  squadCost,
  resolveSquadStats,
  resolvePotentialStats,
  resolveDiscipline,
  squadShape,
  statPower,
  squadPower,
  potentialPower,
  warbandPower,
  findOfficer,
  findLeadingPotential,
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
  PotentialLoss,
  BattleSetup,
  GrowthOffer,
} from './run.js'
