import { Battle, TEAM_A, TEAM_B } from '@salt/sim'
import { UNIT_TYPES, makeGroup, postmortem } from '@salt/game'

/**
 * "I had significantly more fighters and I can't tell why I lost."
 *
 *   npm run sim:why
 *
 * Runs the cases where numbers lose anyway and prints the verdict the report
 * would show. This is here so the postmortem can be checked against fights
 * whose cause is known by construction — a plain-language explanation that is
 * confidently wrong is worse than a table of numbers.
 */
const CASES: { name: string; a: [number, number]; b: [number, number] }[] = [
  { name: 'Chaff vs Shieldbearers', a: [0, 40], b: [8, 15] },
  { name: 'Chaff vs Thornbacks', a: [0, 50], b: [4, 18] },
  { name: 'Chaff vs Marksmen', a: [0, 45], b: [7, 14] },
  { name: 'Chaff vs Stiltwalkers', a: [0, 40], b: [2, 20] },
  { name: 'Stiltwalkers vs Marksmen', a: [2, 30], b: [7, 14] },
  { name: 'Chaff vs Chaff (even)', a: [0, 40], b: [0, 40] },
  { name: 'Chaff swarm vs Levy', a: [0, 70], b: [5, 18] },
]

const name = (id: number) => UNIT_TYPES[id].name

for (const c of CASES) {
  let wins = 0
  let last = null as ReturnType<typeof postmortem> | null
  const runs = 40

  for (let seed = 1; seed <= runs; seed++) {
    const battle = new Battle({
      seed,
      groups: [makeGroup(TEAM_A, c.a[0], c.a[1]), makeGroup(TEAM_B, c.b[0], c.b[1])],
    })
    battle.run()
    const results = battle.results()
    const mine = results.filter((r) => r.team === TEAM_A)
    const theirs = results.filter((r) => r.team === TEAM_B)
    const won = battle.winner === TEAM_A
    if (won) wins++
    // Keep a losing one where possible — that is the case being explained.
    if (!won || last === null) last = postmortem(mine, theirs, won)
  }

  console.log(
    `\n${c.a[1]} ${name(c.a[0])} vs ${c.b[1]} ${name(c.b[0])}` +
      `  — won ${((wins / runs) * 100).toFixed(0)}%`,
  )
  console.log(`  [${last!.cause}] ${last!.verdict}`)
  console.log(`  ${last!.evidence}`)
}
