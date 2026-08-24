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
 *
 * Two bots, because Water made one insufficient:
 *
 *   greedy   buys until broke. This is the behaviour Water exists to punish,
 *            so its desertion count is the measurement of whether the squeeze
 *            has any teeth at all.
 *   thrifty  --thrifty. Stops buying when the next march's upkeep would
 *            outrun what a win pays back. This is the floor for "can someone
 *            who is paying attention still finish", which greedy alone cannot
 *            answer once overbuying is punished.
 *
 * If greedy and thrifty complete at the same rate, Water is not doing
 * anything. If thrifty cannot finish either, the curve is too steep.
 *
 * --scavenge / --delve send a crew every camp on top of whichever bot is
 * running. The comparison that matters is against the same bot with no
 * expedition: if sending three Prospects into a ruin every single camp is
 * strictly better than keeping them on the field, the cost side of V0-DESIGN
 * §9 is not being paid.
 */
import { Battle } from '@salt/sim'
import {
  ENCOUNTERS_PER_RUN,
  advance,
  assignLeader,
  buy,
  march,
  newRun,
  resolveBattle,
  prospectPower,
  squadPower,
  totalBodies,
  unitType,
  waterUpkeep,
  sendExpedition,
  MAX_CREW,
} from '@salt/game'
import type { Offer, RunState } from '@salt/game'

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
function shop(state: RunState, thrifty: boolean): RunState {
  let s = state
  for (let guard = 0; guard < 8; guard++) {
    /*
     * A thrifty bot will not buy a body it cannot water.
     *
     * Two separate constraints, and an earlier version of this only checked
     * the second — which is why it deserted almost as much as greedy did:
     *
     *   solvency  can the cistern pay the march that is about to happen
     *   steady    does the roster cost more per march than a win pays back
     *
     * A roster can be solvent today and still shrinking, and it can be
     * sustainable in the long run while being unable to pay this week. The
     * player sees both in camp — the cistern and the bill — so the bot reads
     * both too.
     */
    if (thrifty) {
      const upkeep = waterUpkeep(s.warband)
      if (upkeep > s.warband.water || upkeep >= s.encounter.waterReward) break
    }
    /*
     * Checked on the state AFTER the purchase, not before. Checking before
     * lets exactly one squad through the gate every camp, which is why a bot
     * that refused to overbuy still went short on 17.7% of its marches.
     */
    const affordableWater = (o: Offer): boolean => {
      if (!thrifty) return true
      const projected = { ...s.warband, squads: [...s.warband.squads] }
      if (o.kind === 'officer') projected.officers = [...projected.officers, o.officer]
      else {
        projected.squads.push({ id: o.id, typeId: o.typeId, count: o.count, leader: null })
        projected.prospects = [...projected.prospects, ...o.prospects]
      }
      return waterUpkeep(projected) <= s.warband.water
    }

    const scored = s.offers
      .filter((o) => o.cost <= s.warband.salvage && affordableWater(o))
      .map((o) => {
        if (o.kind === 'officer') return { id: o.id, value: 45 / o.cost }
        const power =
          squadPower({ id: o.id, typeId: o.typeId, count: o.count, leader: null }, null) +
          o.prospects.reduce((n, p) => n + prospectPower(p), 0)
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

  // Prospects lead the biggest still-unled mutant squad they qualify for.
  const led = new Set(s.warband.squads.filter((sq) => sq.leader).map((sq) => sq.id))
  for (const p of s.warband.prospects) {
    const target = s.warband.squads
      .filter((sq) => !led.has(sq.id) && unitType(sq.typeId).lineage === 'mutant')
      .sort((a, b) => b.count - a.count)[0]
    if (!target) continue
    s = assignLeader(s, target.id, { kind: 'prospect', id: p.id })
    led.add(target.id)
  }
  return s
}

function playRun(seedText: string, thrifty: boolean, verb: 'scavenge' | 'delve' | null) {
  let state = newRun(seedText)
  let reached = 0
  let deserted = 0
  let shortMarches = 0

  while (state.phase !== 'over') {
    if (state.phase === 'camp') {
      state = shop(state, thrifty)
      if (verb) {
        // Bluntly greedy: always send the maximum crew. This is the upper
        // bound on how much expeditions can be exploited, not a good player.
        const crew = state.warband.prospects
          .filter((p) => p.fielded)
          .slice(0, MAX_CREW)
          .map((p) => p.id)
        if (crew.length > 0) state = sendExpedition(state, verb, crew)
      }
      const marched = march(state)
      const setup = marched.setup
      state = marched.state
      const battle = new Battle(setup.config)
      battle.run()
      if (state.lastUpkeep && state.lastUpkeep.deserted > 0) {
        deserted += state.lastUpkeep.deserted
        shortMarches++
      }
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
    water: state.warband.water,
    deserted,
    shortMarches,
  }
}

const runs = arg('runs', 200)
const thrifty = process.argv.includes('--thrifty')
const verb = process.argv.includes('--delve')
  ? ('delve' as const)
  : process.argv.includes('--scavenge')
    ? ('scavenge' as const)
    : null
console.log('Salt Crown — campaign harness')
console.log(
  `${runs} runs, ${thrifty ? 'thrifty' : 'greedy'} buyer, ${ENCOUNTERS_PER_RUN} encounters each\n`,
)

let won = 0
let deserted = 0
let shortMarches = 0
let marches = 0
const reachedHist = new Array(ENCOUNTERS_PER_RUN + 1).fill(0)
const finalBodies: number[] = []

const started = Date.now()
for (let i = 1; i <= runs; i++) {
  const r = playRun(`seed-${i}`, thrifty, verb)
  deserted += r.deserted
  shortMarches += r.shortMarches
  marches += r.reached + 1
  if (r.outcome === 'won') {
    won++
    finalBodies.push(r.bodies)
  }
  reachedHist[r.reached]++
}
const elapsed = Date.now() - started

console.log(`runs won   ${pad(won, 5)}  ${((won / runs) * 100).toFixed(1)}%`)
console.log(
  `water      ${pad(deserted, 5)} deserters over ${marches} marches, ` +
    `${((shortMarches / marches) * 100).toFixed(1)}% of marches short\n`,
)
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
