import { Rng } from '@salt/sim'
import type { ResolvedStats } from '@salt/sim'
import { MACHINE_TYPES } from './units.js'

/**
 * Machines — docs/V0-DESIGN.md §3.
 *
 * The third lineage, and the only one you cannot buy. They are strictly better
 * than anything in the other two pools, and §3 self-balances that with four
 * things at once:
 *
 *   found only     ruins and rare events. No price, at any price.
 *   full power     they arrive as good as they will ever be.
 *   only degrade   every battle costs condition, permanently.
 *   expensive      salvage per battle just to keep one running.
 *
 * So a machine is a depreciating asset, which is a completely different thing
 * to own than a mutant (appreciates by surviving) or an Officer (static, but
 * upgradable with implants). Each lineage has its own relationship with time,
 * and that is more of the difference between them than the stat lines are.
 *
 * They are individuals, not squads. "A hoarded machine core" in §11 is a few
 * of them, not a formation — you never have enough for a machine to be
 * anonymous.
 */
export interface Machine {
  id: string
  typeId: number
  name: string
  /**
   * Condition, counting down. Full when found, one step per battle fought,
   * scrap at zero. Never recovers on its own — only a Tinkerer can put
   * condition back, and that is an event, not a service.
   */
  condition: number
}

/**
 * Battles a machine has in it.
 *
 * Six is most of an eight-encounter run, so a machine found early is a
 * companion for the whole thing and one found late is a closer. Both readings
 * are correct and the player chooses which by choosing when to field it.
 */
export const MACHINE_CONDITION_MAX = 6

/**
 * How far a wreck falls.
 *
 * Measured, not guessed. The first version scaled EVERY stat by the same
 * multiplier, which compounds: at condition 4 a Chrome Warden was on 0.82 of
 * hp AND damage AND armour AND accuracy AND speed, which is about 0.55 of its
 * effective power, and it dropped from 78% wins to 5% in two battles. A
 * machine with six condition should last roughly six battles, not two.
 *
 * So condition touches hp, damage and cycle time only, and the floor is
 * higher. Armour, accuracy and speed are what the thing IS — a worn machine
 * is weaker and slower to fire, not suddenly a bad shot.
 */
const MACHINE_WORST = 0.6

/** Salvage per battle, per machine, just to have it running. */
export const MACHINE_RUN_COST = 55

/**
 * They only need a name because they are individuals. Deliberately not
 * people-names: a machine has a designation somebody scratched into it, or a
 * word the crew started using and never stopped.
 */
const DESIGNATIONS = [
  'Kettle', 'Nine Bells', 'The Quiet One', 'Ferryman', 'Old Argument',
  'Sixty-Four', 'Patient', 'Housekeeper', 'Long Shadow', 'The Clerk',
  'Thursday', 'Grandfather', 'Second Cousin', 'Doorstop', 'Verdict',
]

export function rollMachine(rng: Rng): Machine {
  const type = MACHINE_TYPES[rng.int(MACHINE_TYPES.length)]
  return {
    id: `m${rng.next().toString(36)}`,
    typeId: type.id,
    name: DESIGNATIONS[rng.int(DESIGNATIONS.length)],
    condition: MACHINE_CONDITION_MAX,
  }
}

/**
 * Condition as a stat multiplier.
 *
 * Applied to everything at once rather than to selected stats, because a
 * failing machine is failing generally — this is wear, not a wound with a hit
 * location. Wounds are for bodies, and a machine does not have one.
 */
export function conditionMultiplier(condition: number): number {
  const t = Math.max(0, Math.min(1, condition / MACHINE_CONDITION_MAX))
  return MACHINE_WORST + (1 - MACHINE_WORST) * t
}

export function applyCondition(s: ResolvedStats, condition: number): void {
  const m = conditionMultiplier(condition)
  s.hp *= m
  s.damage *= m
  // A worn machine is slower to cycle, not faster.
  s.attackInterval /= m
}

/** How the condition reads. Never a bare fraction. */
export function conditionWord(condition: number): string {
  if (condition >= MACHINE_CONDITION_MAX) return 'as found'
  if (condition >= 4) return 'serviceable'
  if (condition >= 2) return 'failing'
  if (condition >= 1) return 'barely'
  return 'scrap'
}

export function machineTitle(m: Machine, typeName: string): string {
  return `${typeName} “${m.name}”`
}

/** Nothing left to run. The warband drops it. */
export function isScrap(m: Machine): boolean {
  return m.condition <= 0
}
