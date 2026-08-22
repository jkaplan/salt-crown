/**
 * Headless batch simulator and perf probe.
 *
 *   npm run sim:batch -- --seeds 1000 --a 60 --b 60
 *   npm run sim:perf
 *
 * This exists in M0 rather than M5 on purpose. Superlinear upkeep and a
 * 10-12% break-run rate are statistical targets — you cannot hand-playtest
 * your way to them. See docs/ROADMAP.md sequencing rule 2.
 */
import { Battle, MS_PER_TICK, TEAM_A, TEAM_B, TICKS_PER_SECOND } from '@salt/sim'
import { UNIT_TYPES, makeGroup } from '@salt/game'

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`)
  if (i === -1) return fallback
  const v = Number(process.argv[i + 1])
  return Number.isFinite(v) ? v : fallback
}

function make(seed: number, a: number, b: number): Battle {
  return new Battle({
    seed,
    groups: [makeGroup(TEAM_A, 0, a), makeGroup(TEAM_B, 0, b)],
  })
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[i]
}

function pad(s: string | number, w: number): string {
  return String(s).padStart(w)
}

function batch(): void {
  const seeds = arg('seeds', 1000)
  const a = arg('a', 60)
  const b = arg('b', 60)

  console.log('Salt Crown — batch sim')
  const unit = UNIT_TYPES[0].name
  console.log(`seeds ${seeds}   A: ${a} ${unit}   B: ${b} ${unit}\n`)

  // Determinism gate. If this fails nothing below is meaningful.
  const p = make(1, a, b)
  const q = make(1, a, b)
  p.run()
  q.run()
  const deterministic = p.hash() === q.hash() && p.tick === q.tick
  console.log(
    `determinism  ${deterministic ? 'PASS' : 'FAIL'}  (seed 1 -> 0x${p.hash().toString(16)}, ${p.tick} ticks)\n`,
  )
  if (!deterministic) process.exitCode = 1

  let aWins = 0
  let bWins = 0
  let draws = 0
  const ticks: number[] = []
  const survivors: number[] = []

  const started = Date.now()
  for (let seed = 1; seed <= seeds; seed++) {
    const battle = make(seed, a, b)
    battle.run()
    if (battle.winner === TEAM_A) {
      aWins++
      survivors.push(battle.aliveA)
    } else if (battle.winner === TEAM_B) {
      bWins++
      survivors.push(battle.aliveB)
    } else {
      draws++
    }
    ticks.push(battle.tick)
  }
  const elapsed = Date.now() - started

  ticks.sort((m, n) => m - n)
  survivors.sort((m, n) => m - n)
  const mean = ticks.reduce((s, t) => s + t, 0) / ticks.length
  const pct = (n: number) => `${((n / seeds) * 100).toFixed(1)}%`

  console.log(`A wins  ${pad(aWins, 6)}  ${pad(pct(aWins), 6)}`)
  console.log(`B wins  ${pad(bWins, 6)}  ${pad(pct(bWins), 6)}`)
  console.log(`draws   ${pad(draws, 6)}  ${pad(pct(draws), 6)}\n`)

  console.log(
    `ticks   mean ${pad(mean.toFixed(0), 5)}   p50 ${pad(percentile(ticks, 50), 5)}` +
      `   p95 ${pad(percentile(ticks, 95), 5)}   max ${pad(ticks[ticks.length - 1], 5)}`,
  )
  console.log(`        ${(mean / TICKS_PER_SECOND).toFixed(1)}s mean battle at ${TICKS_PER_SECOND} Hz\n`)

  console.log(
    `winner survivors   p50 ${pad(percentile(survivors, 50), 4)}` +
      `   p95 ${pad(percentile(survivors, 95), 4)}   (of ${Math.max(a, b)})`,
  )
  console.log(`\n${seeds} battles in ${elapsed}ms  (${(elapsed / seeds).toFixed(2)}ms each)`)
}

function perf(): void {
  console.log('Salt Crown — sim perf probe\n')
  console.log('Pure sim cost, no rendering. Headroom is how many times faster')
  console.log(`than realtime the sim runs at ${TICKS_PER_SECOND} Hz.\n`)
  console.log('  per side     total    ms/tick    headroom')
  console.log('  ---------------------------------------------')

  for (const perSide of [50, 110, 220, 500, 1000, 2000, 4000]) {
    const battle = make(1234, perSide, perSide)
    // Warm up past the approach phase so we measure units actually fighting.
    for (let i = 0; i < 60 && !battle.finished; i++) battle.step()

    const samples = 120
    const started = process.hrtime.bigint()
    let stepped = 0
    for (let i = 0; i < samples && !battle.finished; i++) {
      battle.step()
      stepped++
    }
    const ns = Number(process.hrtime.bigint() - started)
    const msPerTick = ns / 1e6 / Math.max(1, stepped)
    const headroom = MS_PER_TICK / msPerTick

    console.log(
      `  ${pad(perSide, 8)}  ${pad(perSide * 2, 8)}  ${pad(msPerTick.toFixed(3), 9)}  ${pad(headroom.toFixed(1) + 'x', 10)}`,
    )
  }

  console.log('\nThe spec guessed a ceiling of 220 fully simulated entities.')
  console.log('Anything above 1.0x headroom sustains realtime on this machine;')
  console.log('phones are roughly 3-6x slower. Record the real number in docs/TECH.md.')
}

if (process.argv.includes('--perf')) perf()
else batch()
