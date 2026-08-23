/**
 * How much is a leader actually worth?
 *
 *   npm run sim:leaders -- --budget 400 --seeds 60
 *
 * A leading Potential was silently missing from the battlefield entirely and
 * nothing looked wrong. That is evidence the whole named tier is close to
 * decorative, so measure it directly: take a fixed force, then spend the same
 * salvage three ways — on an Officer, on a Potential, or on more bodies — and
 * see which wins more.
 *
 * If "more bodies" wins every column, leaders are a trap and the tier needs
 * to be stronger, cheaper, or both.
 */
import { Battle, TEAM_A, TEAM_B } from '@salt/sim'
import {
  MUTATIONS,
  OFFICER_RANKS,
  UNIT_TYPES,
  toSimGroups,
  unitType,
} from '@salt/game'
import type { Officer, Potential, Squad, Warband } from '@salt/game'

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`)
  if (i === -1) return fallback
  const v = Number(process.argv[i + 1])
  return Number.isFinite(v) ? v : fallback
}

const budget = arg('budget', 400)
const seeds = arg('seeds', 60)

const CHAFF = 0
const FOE_TYPE = 0 // mirror fodder, so only the leader differs

function squad(typeId: number, count: number, leader: Squad['leader'] = null): Squad {
  return { id: `sq-${typeId}`, typeId, count, leader }
}

function officer(rankId: string): Officer {
  return { id: 'off', rankId, name: 'Test', house: 'Vantry' }
}

function potential(typeId: number, mutationId: string, level: number): Potential {
  return { id: 'pot', typeId, name: 'Test', mutations: [{ id: mutationId, level }], battles: 0 }
}

function warband(squads: Squad[], officers: Officer[], potentials: Potential[]): Warband {
  return { squads, officers, potentials, salvage: 0 }
}

/** Win rate of `player` against `foe` over `seeds` deterministic battles. */
function winRate(player: Warband, foe: Warband): number {
  let wins = 0
  for (let s = 1; s <= seeds; s++) {
    const a = toSimGroups(player, TEAM_A)
    const b = toSimGroups(foe, TEAM_B)
    const battle = new Battle({ seed: s * 7919, groups: [...a.groups, ...b.groups] })
    battle.run()
    if (battle.winner === TEAM_A) wins++
  }
  return wins / seeds
}

function pad(s: string | number, w: number): string {
  return String(s).padStart(w)
}

const chaffCost = UNIT_TYPES[CHAFF].cost
const baseCount = Math.floor(budget / chaffCost)

/*
 * Calibrate the opponent so the unled baseline sits near 50%.
 *
 * Combat is Lanchester-square, so a 12% numbers edge is already decisive —
 * pick the foe size by hand and every row saturates at 0% or 100%, which
 * measures nothing. Binary-search the size that makes the baseline a coin
 * flip, and leader effects show up as movement instead.
 */
const bare = (n: number) => warband([squad(CHAFF, n)], [], [])

let lo = baseCount
let hi = Math.round(baseCount * 1.3)
let foeCount = baseCount
for (let i = 0; i < 8 && lo < hi; i++) {
  foeCount = Math.round((lo + hi) / 2)
  const w = winRate(bare(baseCount), warband([squad(FOE_TYPE, foeCount)], [], []))
  if (w > 0.5) lo = foeCount + 1
  else hi = foeCount - 1
}
const foe = warband([squad(FOE_TYPE, foeCount)], [], [])

console.log('Salt Crown — leader value')
console.log(`${budget} salvage of ${UNIT_TYPES[CHAFF].name} (${baseCount}) vs ${foeCount} calibrated`)
console.log(`${seeds} seeds per row\n`)

const baseline = winRate(bare(baseCount), foe)
console.log(`baseline, no leader                    ${pad((baseline * 100).toFixed(0), 4)}%\n`)

/*
 * How steep is the numbers advantage? Combat is Lanchester-square, so a big
 * blob concentrates fire and wins superlinearly. If a 2% edge already decides
 * the fight, then force size swamps every other decision and composition is
 * not really the depth the design claims it is.
 */
console.log('Numbers advantage vs win rate (same unit both sides):')
console.log('  edge     bodies     win')
console.log('  --------------------------')
for (const edge of [0, 0.02, 0.05, 0.1, 0.2]) {
  const mine = Math.round(foeCount * (1 + edge))
  const w = winRate(bare(mine), foe)
  console.log(
    `  ${pad(`+${(edge * 100).toFixed(0)}%`, 5)}   ${pad(mine, 6)}   ${pad((w * 100).toFixed(0), 4)}%`,
  )
}
console.log()

console.log('  spend            option                       win     vs base   same salvage')
console.log('  ------------------------------------------------------------------ in bodies')

/** What the same salvage buys if spent on fodder instead. */
function bodiesInstead(cost: number): number {
  return winRate(
    warband([squad(CHAFF, baseCount + Math.floor(cost / chaffCost))], [], []),
    foe,
  )
}

for (const rank of OFFICER_RANKS) {
  const led = warband(
    [squad(CHAFF, baseCount, { kind: 'officer', id: 'off' })],
    [officer(rank.id)],
    [],
  )
  const w = winRate(led, foe)
  const alt = bodiesInstead(rank.cost)
  console.log(
    `  ${pad(rank.cost, 3)} salvage    officer: ${rank.rank.padEnd(20)}` +
      `${pad((w * 100).toFixed(0), 4)}%   ${pad(((w - baseline) * 100).toFixed(0), 5)}pp   ` +
      `${pad((alt * 100).toFixed(0), 4)}%`,
  )
}

console.log()

// A representative spread of mutations, at low / mid / max level.
const SHOWCASE = ['horns', 'carapace', 'quills', 'frenzy']
for (const id of SHOWCASE) {
  if (!MUTATIONS.some((m) => m.id === id)) continue
  for (const level of [2, 6]) {
    const cost = unitType(CHAFF).cost + level * 9
    const led = warband(
      [squad(CHAFF, baseCount, { kind: 'potential', id: 'pot' })],
      [],
      [potential(CHAFF, id, level)],
    )
    const w = winRate(led, foe)
    const alt = bodiesInstead(cost)
    console.log(
      `  ${pad(cost, 3)} salvage    potential: ${`${id} ${level}`.padEnd(18)}` +
        `${pad((w * 100).toFixed(0), 4)}%   ${pad(((w - baseline) * 100).toFixed(0), 5)}pp   ` +
        `${pad((alt * 100).toFixed(0), 4)}%`,
    )
  }
}

console.log('\nRightmost column is the same salvage spent on extra bodies instead.')
console.log('A leader that loses to its own price in fodder is a trap.')
