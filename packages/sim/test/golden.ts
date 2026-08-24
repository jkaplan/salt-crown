import { TEAM_A, TEAM_B } from '@salt/sim'
import type { ResolvedStats, SimGroup } from '@salt/sim'

/**
 * Golden-seed replay fixtures.
 *
 * CLAUDE.md rule 1 says these exist and that breaking one means you changed
 * combat behaviour. They did not, actually — determinism.test.ts only ever
 * compared two Battles built in the SAME process from the same config, which
 * proves the sim is not reading the clock or Math.random and nothing else. A
 * refactor that silently retuned the movement dead band would have sailed
 * straight through it.
 *
 * These are the real thing: hashes recorded from a known-good build and
 * checked back on every run. If one fails, combat behaviour moved. That is
 * sometimes correct and sometimes a bug — but it is never something to fix by
 * pasting in the new number without saying what changed.
 *
 * Stats are spelled out in full rather than drawn from @salt/game on purpose.
 * The fixture has to pin the SIM, so retuning a unit type must not be able to
 * invalidate it.
 */

function stats(over: Partial<ResolvedStats>): ResolvedStats {
  return {
    hp: 30,
    armor: 1,
    damage: 6,
    attackInterval: 12,
    range: 22,
    moveSpeed: 4,
    accuracy: 0.75,
    evade: 0.05,
    radius: 9,
    regen: 0,
    quills: 0,
    frenzy: 0,
    ...over,
  }
}

function group(
  team: typeof TEAM_A | typeof TEAM_B,
  count: number,
  over: Partial<ResolvedStats>,
  extra: Partial<SimGroup> = {},
): SimGroup {
  return {
    team,
    count,
    label: 'golden',
    color: 0x888888,
    shape: 0,
    stats: stats(over),
    discipline: 0.5,
    leaderLabel: null,
    ...extra,
  }
}

/**
 * Four scenarios, chosen to touch the parts of the tick loop that a "harmless"
 * refactor is most likely to move:
 *
 *   even        the baseline mirror match — formation, closing, separation
 *   lopsided    collapse and the morale multiplier under real attrition
 *   ranged      the engage dead band and the range/radius interaction, which
 *               is where the 1-D range bug lived
 *   mixed       group ordering, a named body, and behavioural mutation stats
 *               (regen/quills/frenzy) all in one battle
 */
export const GOLDEN_CASES = [
  {
    name: 'even',
    seed: 424242,
    groups: [group(TEAM_A, 40, {}), group(TEAM_B, 40, {})],
  },
  {
    name: 'lopsided',
    seed: 8675309,
    groups: [
      group(TEAM_A, 60, {}, { discipline: 0.35 }),
      group(TEAM_B, 24, {}, { discipline: 0.78 }),
    ],
  },
  {
    name: 'ranged',
    seed: 13579,
    groups: [
      group(TEAM_A, 18, { range: 240, moveSpeed: 3.2, damage: 9, attackInterval: 22, radius: 8 }),
      group(TEAM_A, 30, { range: 22, moveSpeed: 5.2, radius: 7, hp: 22 }),
      group(TEAM_B, 44, { range: 26, moveSpeed: 6.6, evade: 0.14, radius: 10 }),
    ],
  },
  {
    name: 'mixed',
    seed: 20260824,
    groups: [
      group(TEAM_A, 26, { armor: 4, hp: 55, moveSpeed: 2.4, radius: 12 }, {
        discipline: 0.78,
        leaderLabel: 'Warden Hest of Duon',
      }),
      group(TEAM_A, 1, { hp: 120, damage: 14, regen: 0.4, quills: 0.25, frenzy: 0.5, radius: 11 }, {
        discipline: 1,
        leaderLabel: 'Rust',
        named: true,
      }),
      group(TEAM_B, 52, { hp: 18, damage: 5, moveSpeed: 9, evade: 0.24, radius: 7 }, {
        discipline: 0.35,
      }),
    ],
  },
] as const
