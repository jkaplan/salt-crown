/**
 * Equal-salvage matchup matrix.
 *
 *   npm run sim:matchup -- --budget 400 --seeds 40
 *
 * Every unit type against every other, each side given the same salvage to
 * spend. Answers the only question that matters about unit variety: do these
 * things actually behave differently, or are they the same unit at different
 * prices?
 *
 * A row that reads ~50% against everything is a unit with no identity.
 */
import { Battle, TEAM_A, TEAM_B } from '@salt/sim'
import { UNIT_TYPES, makeGroup } from '@salt/game'

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`)
  if (i === -1) return fallback
  const v = Number(process.argv[i + 1])
  return Number.isFinite(v) ? v : fallback
}

const budget = arg('budget', 400)
const seeds = arg('seeds', 40)

function winRate(aType: number, bType: number): number {
  const aCount = Math.max(1, Math.floor(budget / UNIT_TYPES[aType].cost))
  const bCount = Math.max(1, Math.floor(budget / UNIT_TYPES[bType].cost))
  let wins = 0
  for (let s = 1; s <= seeds; s++) {
    const battle = new Battle({
      seed: s * 7919,
      groups: [makeGroup(TEAM_A, aType, aCount), makeGroup(TEAM_B, bType, bCount)],
    })
    battle.run()
    if (battle.winner === TEAM_A) wins++
  }
  return wins / seeds
}

const short = (n: string) => n.slice(0, 5).padStart(5)

console.log('Salt Crown — matchup matrix')
console.log(`${budget} salvage per side, ${seeds} seeds per cell\n`)
console.log('Row wins vs column, as a percentage. ~50 everywhere means no identity.\n')

const header = UNIT_TYPES.map((t) => short(t.name)).join(' ')
console.log(`${' '.repeat(15)}${header}`)

const spread: { name: string; range: number; lo: string; hi: string }[] = []

for (const a of UNIT_TYPES) {
  const cells: string[] = []
  let lo = 2
  let hi = -1
  let loName = ''
  let hiName = ''

  for (const b of UNIT_TYPES) {
    if (a.id === b.id) {
      cells.push('    —')
      continue
    }
    const r = winRate(a.id, b.id)
    cells.push(String(Math.round(r * 100)).padStart(5))
    if (r < lo) {
      lo = r
      loName = b.name
    }
    if (r > hi) {
      hi = r
      hiName = b.name
    }
  }

  const count = Math.max(1, Math.floor(budget / a.cost))
  console.log(`${(a.name + ` x${count}`).padEnd(15)}${cells.join(' ')}`)
  spread.push({ name: a.name, range: hi - lo, lo: loName, hi: hiName })
}

/**
 * 1v1 systematically undervalues anything whose job is to stand in front of
 * something else. Sludge-Waller does almost no damage on purpose; Spitter has
 * no durability on purpose. Neither reads as good alone, and both should.
 *
 * So: same salvage, split between a fragile unit and a screen, against a
 * common opponent. If mixing beats going pure, the screening role is real.
 */
function screenTest(fragile: number, screen: number, foe: number): [number, number] {
  const pureCount = Math.max(1, Math.floor(budget / UNIT_TYPES[fragile].cost))
  const halfFragile = Math.max(1, Math.floor(budget / 2 / UNIT_TYPES[fragile].cost))
  const halfScreen = Math.max(1, Math.floor(budget / 2 / UNIT_TYPES[screen].cost))
  const foeCount = Math.max(1, Math.floor(budget / UNIT_TYPES[foe].cost))

  let pureWins = 0
  let mixWins = 0
  for (let s = 1; s <= seeds; s++) {
    const pure = new Battle({
      seed: s * 7919,
      groups: [makeGroup(TEAM_A, fragile, pureCount), makeGroup(TEAM_B, foe, foeCount)],
    })
    pure.run()
    if (pure.winner === TEAM_A) pureWins++

    const mixed = new Battle({
      seed: s * 7919,
      groups: [
        makeGroup(TEAM_A, fragile, halfFragile),
        makeGroup(TEAM_A, screen, halfScreen),
        makeGroup(TEAM_B, foe, foeCount),
      ],
    })
    mixed.run()
    if (mixed.winner === TEAM_A) mixWins++
  }
  return [pureWins / seeds, mixWins / seeds]
}

console.log('\nScreen test — does putting a body in front actually help?')
console.log('  fragile + screen        vs           pure   mixed')
console.log('  ----------------------------------------------------')
const SCREEN_CASES: [number, number, number][] = [
  [3, 1, 0], // Spitter + Sludge-Waller vs Chaff
  [3, 1, 5], // Spitter + Sludge-Waller vs Levy
  [3, 4, 0], // Spitter + Thornback     vs Chaff
  [7, 1, 0], // Marksman + Sludge-Waller vs Chaff
  [7, 8, 0], // Marksman + Shieldbearer vs Chaff
  [2, 1, 4], // Stiltwalker + Sludge-Waller vs Thornback
]
for (const [fragile, screen, foe] of SCREEN_CASES) {
  const [pure, mixed] = screenTest(fragile, screen, foe)
  const arrow = mixed > pure + 0.1 ? ' <- screen works' : mixed < pure - 0.1 ? ' <- worse mixed' : ''
  const pair = `${UNIT_TYPES[fragile].name} + ${UNIT_TYPES[screen].name}`
  console.log(
    `  ${pair.padEnd(30)}${UNIT_TYPES[foe].name.padEnd(8)}` +
      `${String(Math.round(pure * 100)).padStart(5)}%${String(Math.round(mixed * 100)).padStart(7)}%${arrow}`,
  )
}

console.log('\nIdentity — how much a unit cares who it is fighting:')
console.log('  unit              spread   worst vs        best vs')
console.log('  ------------------------------------------------------')
for (const s of spread.sort((x, y) => y.range - x.range)) {
  const flag = s.range < 0.35 ? '  <- flat' : ''
  console.log(
    `  ${s.name.padEnd(16)}${String(Math.round(s.range * 100)).padStart(5)}%   ` +
      `${s.lo.padEnd(15)} ${s.hi}${flag}`,
  )
}
