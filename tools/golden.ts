import { Battle } from '@salt/sim'
import { GOLDEN_CASES } from '../packages/sim/test/golden.js'

/**
 * Re-records the golden-seed fixtures. `npm run sim:golden`.
 *
 * Run this ONLY when a commit deliberately changes combat behaviour, and say
 * in the commit what moved. The whole value of the fixture is that it fails
 * when nobody meant to change anything — pasting new numbers in to make a red
 * test go green throws that away and leaves no record that the sim moved.
 *
 * Prints the EXPECTED table from golden.test.ts, ready to paste over the old
 * one.
 */
const SAMPLE_TICKS = [20, 60, 150] as const

const rows: string[] = []

for (const c of GOLDEN_CASES) {
  const b = new Battle({ seed: c.seed, groups: c.groups as never })
  const at: number[] = []
  for (const t of SAMPLE_TICKS) {
    while (b.tick < t && !b.finished) b.step()
    at.push(b.hash())
  }
  const ticks = b.run()
  rows.push(
    `  ${c.name}: {\n` +
      SAMPLE_TICKS.map((t, i) => `    t${t}: ${at[i]},`).join('\n') +
      `\n    finalHash: ${b.hash()},\n    ticks: ${ticks},\n    winner: ${b.winner},\n  },`,
  )
  console.error(
    `${c.name.padEnd(10)} ${ticks} ticks, team ${b.winner} wins, ${b.aliveA}v${b.aliveB} left`,
  )
}

console.log('\n' + rows.join('\n'))
