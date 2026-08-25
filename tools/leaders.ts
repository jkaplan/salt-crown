/**
 * How much is a leader actually worth?
 *
 *   npm run sim:leaders -- --budget 400 --seeds 60
 *
 * Everything here is reported as BODY EQUIVALENCE, not win rate — see the
 * comment further down for why: at a calibrated 50/50 baseline, combat's
 * Lanchester-square shape means any real advantage saturates win rate to
 * 100%, which cannot tell two good options apart. Fight the option against a
 * plain squad and binary-search the size that brings it back to even
 * instead: "this is worth N extra bodies" is directly comparable to what
 * those bodies cost.
 *
 * Four things measured, in order:
 *   1. An Officer's rank bonus, against a light attacker and a heavy one
 *      (armour is flat reduction, so a rank that only pays off against one
 *      of those is not a rank — see the comment at FOES).
 *   2. That leading a squad is discipline-only now — see roster.ts's
 *      resolveSquadStats. A leading Prospect's mutations do not reach their
 *      squad any more, at any level; this proves that with mutation held
 *      fixed, only whether they lead, and whether they are a Firstborn,
 *      moves the number.
 *   3. What mutations still buy: the Prospect's OWN body, fighting as
 *      itself, independent of anything it may or may not be leading.
 *   4. What promotion still buys, with mutation held fixed: a Firstborn's
 *      own body is tougher (FIRSTBORN_HP_MULT), which is what the ten
 *      battles survived to earn it are actually paying for now.
 *
 * A leader that is worth fewer bodies than its price buys is a trap.
 */
import { Battle, TEAM_A, TEAM_B } from '@salt/sim'
import { MUTATIONS, OFFICER_RANKS, UNIT_TYPES, toSimGroups } from '@salt/game'
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

const SHOWCASE = ['horns', 'carapace', 'quills', 'frenzy']

/*
 * A leading Prospect no longer touches the squad's STATS at all — see
 * roster.ts's resolveSquadStats: "nothing explains how one body's mutation
 * applies to twenty others." Leadership now grants discipline only, the same
 * honest mechanism an Officer already uses to steady a line.
 *
 * This has to be isolated as (leading - unled), NOT read off raw numbers at
 * different levels directly. A fielded Prospect is worth something on the
 * field purely by fighting as itself (measured separately below), and that
 * own-body contribution genuinely DOES scale with mutation level — a level-6
 * Horns Prospect is a harder-hitting individual than a level-2 one whether or
 * not it is leading anybody. An earlier version of this compared raw leading
 * totals at two different levels and warned that a difference between them
 * would mean a regression, which was wrong: it would conflate that expected,
 * legitimate own-body scaling with an actual leak. Subtracting the matched
 * "unled at that same level" baseline cancels the own-body term out, leaving
 * only what leadership itself contributed.
 */
console.log('  leading a squad, isolated as (leading - unled): discipline only')
console.log('  mutation level should not move this number\n')

function leadershipContribution(level: number, titled: boolean): number {
  const p = { ...prospect(CHAFF, 'horns', level), titled }
  const unled = equivalentVs(warband([squad(CHAFF, baseCount)], [], [p]), CHAFF)
  const led = equivalentVs(
    warband([squad(CHAFF, baseCount, { kind: 'prospect', id: 'pot' })], [], [p]),
    CHAFF,
  )
  return led - unled
}

console.log(
  `  ordinary, horns 2                +${leadershipContribution(2, false)} bodies`,
)
console.log(
  `  ordinary, horns 6                +${leadershipContribution(6, false)} bodies` +
    '   <- should match the row above',
)
console.log(`  Firstborn, horns 6                +${leadershipContribution(6, true)} bodies`)

console.log()

/*
 * What mutations DO still buy: the Prospect's own body, fighting as itself.
 *
 * Every Prospect is its own group regardless of whether it's leading (see
 * toSimGroups), so a highly-mutated one is worth something on the field
 * purely by existing — this measures that directly, fielded alongside an
 * otherwise-plain squad it is NOT leading, so leadership's discipline bonus
 * can't bleed into the number.
 */
console.log("  a Prospect's own worth, fighting as their own body (not leading)")
console.log('  ----------------------------------------------------------------------')
const bare0 = equivalentVs(warband([squad(CHAFF, baseCount)], [], []), CHAFF)
for (const id of SHOWCASE) {
  if (!MUTATIONS.some((m) => m.id === id)) continue
  for (const level of [2, 6]) {
    const p = prospect(CHAFF, id, level)
    const withOne = equivalentVs(warband([squad(CHAFF, baseCount)], [], [p]), CHAFF)
    console.log(`  ${`${id} ${level}`.padEnd(30)}${pad(`+${withOne - bare0}`, 5)} bodies`)
  }
}

console.log()

/*
 * Promotion, isolated from mutation level. A Firstborn's body is tougher
 * (FIRSTBORN_HP_MULT vs PROSPECT_HP_MULT — see prospects.ts) quite apart from
 * anything it leads, so the same mutation at the same level should still be
 * worth more once titled — this is what ten battles survived actually buys,
 * now that it does not also buy a squad-wide multiplier.
 */
console.log('  promotion, same mutation and level: ordinary vs Firstborn')
console.log('  ----------------------------------------------------------------------')
for (const id of SHOWCASE) {
  if (!MUTATIONS.some((m) => m.id === id)) continue
  const ordinary = prospect(CHAFF, id, 6)
  const titled = { ...ordinary, titled: true }
  const a = equivalentVs(warband([squad(CHAFF, baseCount)], [], [ordinary]), CHAFF)
  const b = equivalentVs(warband([squad(CHAFF, baseCount)], [], [titled]), CHAFF)
  console.log(`  ${`${id} 6`.padEnd(30)}${pad(`+${a - bare0}`, 5)}  ->${pad(`+${b - bare0}`, 5)}   (Firstborn)`)
}

console.log('\nA leader that is worth fewer bodies than its price buys is a trap.')
