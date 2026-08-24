/**
 * How much is a leader actually worth?
 *
 *   npm run sim:leaders -- --budget 400 --seeds 60
 *
 * A leading Prospect was silently missing from the battlefield entirely and
 * nothing looked wrong. That is evidence the whole named tier is close to
 * decorative, so measure it directly: take a fixed force, then spend the same
 * salvage three ways — on an Officer, on a Prospect, or on more bodies — and
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
import type { Officer, Prospect, Squad, Warband } from '@salt/game'

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
  return { id: 'off', rankId, name: 'Test', house: 'Vantry', wound: null, bionics: [] }
}

function prospect(typeId: number, mutationId: string, level: number): Prospect {
  return { id: 'pot', typeId, name: 'Test', mutations: [{ id: mutationId, level }], battles: 0, growth: 0, capacity: 6, appraised: true, fielded: true, wound: null }
}

function warband(squads: Squad[], officers: Officer[], prospects: Prospect[]): Warband {
  return { squads, officers, prospects, salvage: 0, water: 0, bionics: [], machines: [], morale: 0 }
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

/*
 * Win rate cannot compare leaders, and the old table proved it: calibrated to
 * a 50/50 baseline, every single option read 100% — including spending the
 * same salvage on plain bodies. Combat is Lanchester-square, so at a knife
 * edge ANY advantage saturates and the column measures nothing.
 *
 * Body equivalence does not saturate. Fight the led squad against a plain one
 * and binary-search the size that brings it back to even: the answer is "this
 * leader is worth N extra bodies", which is directly comparable to what those
 * bodies cost.
 */
console.log(`Leader value as EXTRA BODIES OF WORTH, for a squad of ${baseCount}.`)
console.log('Two opponents, because armour is flat: a swarm that hits for 5 and a')
console.log('heavy that hits for 14. A rank that only pays against one is not a rank.\n')

/*
 * Two opponents, because one was misleading.
 *
 * Measured against a Chaff mirror alone, the Warden's +2.5 armour read as six
 * times better than any other rank — but a Chaff hits for 5, so flat armour
 * halves its damage outright. That is a fact about the OPPONENT, not about the
 * rank. The same armour against a Halberdier hitting for 14 is worth a sixth
 * as much proportionally, and any balance conclusion drawn from the swarm case
 * alone would have been an artifact of the test.
 *
 * Armour is flat reduction everywhere in this game, so every leader comparison
 * has to be read against at least a light and a heavy attacker.
 */
const FOES: { name: string; typeId: number }[] = [
  { name: 'vs swarm', typeId: CHAFF },
  { name: 'vs heavy', typeId: 6 },
]

function equivalentVs(led: Warband, foeType: number): number {
  let lo = Math.round(baseCount * 0.4)
  let hi = Math.round(baseCount * 4)
  for (let i = 0; i < 10 && lo < hi; i++) {
    const mid = Math.round((lo + hi) / 2)
    const foeSize = Math.max(1, Math.round((mid * chaffCost) / UNIT_TYPES[foeType].cost))
    const w = winRate(led, warband([squad(foeType, foeSize)], [], []))
    if (w > 0.5) lo = mid + 1
    else hi = mid - 1
  }
  return lo
}

const baselineVs = FOES.map((f) => equivalentVs(bare(baseCount), f.typeId))

console.log(
  '  option                      ' +
    FOES.map((f) => pad(f.name, 10)).join('') +
    pad('salvage', 9) +
    pad('buys', 9),
)
console.log('  ----------------------------------------------------------------------')


function row(label: string, cost: number, led: Warband): void {
  const bought = Math.floor(cost / chaffCost)
  const cells = FOES.map((f, i) => pad(`+${equivalentVs(led, f.typeId) - baselineVs[i]}`, 10)).join('')
  console.log(`  ${label.padEnd(28)}${cells}${pad(cost, 9)}${pad(bought, 9)}`)
}

for (const rank of OFFICER_RANKS) {
  row(
    `officer: ${rank.rank}`,
    rank.cost,
    warband([squad(CHAFF, baseCount, { kind: 'officer', id: 'off' })], [officer(rank.id)], []),
  )
}

console.log()

// A representative spread of mutations, at low / mid / max level.
const SHOWCASE = ['horns', 'carapace', 'quills', 'frenzy']
for (const id of SHOWCASE) {
  if (!MUTATIONS.some((m) => m.id === id)) continue
  for (const level of [2, 6]) {
    row(
      `prospect: ${id} ${level}`,
      unitType(CHAFF).cost + level * 9,
      warband(
        [squad(CHAFF, baseCount, { kind: 'prospect', id: 'pot' })],
        [],
        [prospect(CHAFF, id, level)],
      ),
    )
  }
}

console.log()

/*
 * The leak, isolated.
 *
 * A Prospect leaks at half level and a Firstborn at full, so the same body is
 * worth measurably more once promoted. This is the mutant lineage's entire
 * army-scale multiplier — if the gap here is small, the ten battles it takes
 * to earn the title are not buying anything.
 */
console.log('  the leak: same body, half level vs full (vs swarm)')
console.log('  ----------------------------------------------------------------------')
for (const id of SHOWCASE) {
  if (!MUTATIONS.some((m) => m.id === id)) continue
  const half = prospect(CHAFF, id, 6)
  const full = { ...half, titled: true }
  const a = equivalentVs(
    warband([squad(CHAFF, baseCount, { kind: 'prospect', id: 'pot' })], [], [half]),
    CHAFF,
  )
  const b = equivalentVs(
    warband([squad(CHAFF, baseCount, { kind: 'prospect', id: 'pot' })], [], [full]),
    CHAFF,
  )
  console.log(
    `  ${`${id} 6`.padEnd(30)}${pad(`+${a - baselineVs[0]}`, 5)}  ->${pad(`+${b - baselineVs[0]}`, 5)}` +
      `   (Firstborn)`,
  )
}

console.log('\nA leader that is worth fewer bodies than its price buys is a trap.')
