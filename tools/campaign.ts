/**
 * Headless campaign harness. Plays whole runs with a greedy buyer so the
 * difficulty curve can be checked without playing 200 runs by hand.
 *
 *   npm run sim:campaign -- --runs 200
 *
 * The AI is deliberately dumb — best power-per-salvage, officers onto the
 * biggest squads. If a greedy bot sweeps every run the encounters are too
 * soft; if it never survives act 2 they're too hard. It is a floor and a
 * ceiling, not a balance oracle.
 */
import { Battle } from '@salt/sim'
import {
  ENCOUNTERS_PER_RUN,
  advance,
  assignLeader,
  buildBattle,
  buy,
  march,
  newRun,
  resolveBattle,
  potentialPower,
  squadPower,
  totalBodies,
  unitType,
} from '@salt/game'
import type { RunState } from '@salt/game'

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`)
  if (i === -1) return fallback
  const v = Number(process.argv[i + 1])
  return Number.isFinite(v) ? v : fallback
}

function pad(s: string | number, w: number): string {
  return String(s).padStart(w)
}

/** Buy whatever gives the most power per salvage, until broke. */
function shop(state: RunState): RunState {
  let s = state
  for (let guard = 0; guard < 8; guard++) {
    const scored = s.offers
      .filter((o) => o.cost <= s.warband.salvage)
      .map((o) => {
        if (o.kind === 'officer') return { id: o.id, value: 45 / o.cost }
        const power =
          squadPower({ id: o.id, typeId: o.typeId, count: o.count, leader: null }, null) +
          o.potentials.reduce((n, p) => n + potentialPower(p), 0)
        return { id: o.id, value: power / o.cost }
      })
      .sort((a, b) => b.value - a.value)

    if (scored.length === 0) break
    const before = s.warband.salvage
    s = buy(s, scored[0].id)
    if (s.warband.salvage === before) break
  }

  // Officers onto the biggest squads first.
  const biggest = [...s.warband.squads].sort((a, b) => b.count - a.count)
  s.warband.officers.forEach((o, i) => {
    if (biggest[i]) s = assignLeader(s, biggest[i].id, { kind: 'officer', id: o.id })
  })

  // Potentials lead the biggest still-unled mutant squad they qualify for.
  const led = new Set(s.warband.squads.filter((sq) => sq.leader).map((sq) => sq.id))
  for (const p of s.warband.potentials) {
    const target = s.warband.squads
      .filter((sq) => !led.has(sq.id) && unitType(sq.typeId).lineage === 'mutant')
      .sort((a, b) => b.count - a.count)[0]
    if (!target) continue
    s = assignLeader(s, target.id, { kind: 'potential', id: p.id })
    led.add(target.id)
  }
  return s
}

function playRun(seedText: string) {
  let state = newRun(seedText)
  let reached = 0

  while (state.phase !== 'over') {
    if (state.phase === 'camp') {
      state = shop(state)
      const setup = buildBattle(state)
      state = march(state)
      const battle = new Battle(setup.config)
      battle.run()
      state = resolveBattle(
        state, battle.results(), battle.winner, battle.tick, setup.playerSources,
      )
    } else if (state.phase === 'report') {
      if (state.report?.won) reached = state.encounterIndex + 1
      state = advance(state)
    }
  }

  return {
    outcome: state.outcome,
    reached,
    bodies: totalBodies(state.warband),
    salvage: state.warband.salvage,
  }
}

const runs = arg('runs', 200)
console.log('Salt Crown — campaign harness')
console.log(`${runs} runs, greedy buyer, ${ENCOUNTERS_PER_RUN} encounters each\n`)

let won = 0
const reachedHist = new Array(ENCOUNTERS_PER_RUN + 1).fill(0)
const finalBodies: number[] = []

const started = Date.now()
for (let i = 1; i <= runs; i++) {
  const r = playRun(`seed-${i}`)
  if (r.outcome === 'won') {
    won++
    finalBodies.push(r.bodies)
  }
  reachedHist[r.reached]++
}
const elapsed = Date.now() - started

console.log(`runs won   ${pad(won, 5)}  ${((won / runs) * 100).toFixed(1)}%\n`)
console.log('  encounters won    runs')
console.log('  ----------------------')
for (let i = 0; i <= ENCOUNTERS_PER_RUN; i++) {
  const bar = '#'.repeat(Math.round((reachedHist[i] / runs) * 40))
  console.log(`  ${pad(i, 14)}  ${pad(reachedHist[i], 6)}  ${bar}`)
}

if (finalBodies.length > 0) {
  finalBodies.sort((a, b) => a - b)
  const mid = finalBodies[Math.floor(finalBodies.length / 2)]
  console.log(`\nwinning warband size  p50 ${mid}  max ${finalBodies[finalBodies.length - 1]}`)
}
console.log(`\n${runs} runs in ${elapsed}ms  (${(elapsed / runs).toFixed(0)}ms each)`)

if (won === runs) console.log('\nWARNING: greedy bot swept every run. Encounters are too soft.')
if (won === 0) console.log('\nWARNING: greedy bot never finished a run. Encounters are too hard.')
