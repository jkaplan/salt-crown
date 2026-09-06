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
 * --firstborn plays the mutant origin instead of the Scion. The two should
 * NOT complete at the same rate — they are different games — but neither
 * should be unplayable, and the shape of where runs end matters more than the
 * headline number.
 *
 * --scavenge / --delve send a crew every camp on top of whichever bot is
 * running. The comparison that matters is against the same bot with no
 * expedition: if sending three Prospects into a ruin every single camp is
 * strictly better than keeping them on the field, the cost side of V0-DESIGN
 * §9 is not being paid.
 *
 * --oncurve layers a third lever on top of thrifty spending: instead of
 * buying whatever is best power-per-salvage regardless of the fight ahead, it
 * reads the SAME scouting report the player sees (`scoutEnemy` on the next
 * encounter, generated alongside that camp's offers, so this information is
 * genuinely available before buying) and weights offers toward raw
 * damage-per-hit the more armoured that report reads — the flat-reduction
 * mechanic means a low-damage swarm loses proportionally more to armour than
 * a hard-hitting squad does. Compared against plain --thrifty (same spending
 * discipline, blind buying) to isolate ONE variable: does reacting to who
 * you're about to fight change completion rate, the way spending discipline
 * measurably did not (see the greedy/thrifty note above)?
 */
import { Battle, BattleEventType } from '@salt/sim'
import {
  ENCOUNTERS_PER_RUN,
  advance,
  assignLeader,
  buy,
  march,
  setOut,
  advanceLeg,
  travelDone,
  newRun,
  resolveBattle,
  prospectPower,
  squadPower,
  totalBodies,
  MUTATIONS_BY_ID,
  PACES,
  isFirstborn,
  chooseMutation,
  setFielded,
  canBecomeFirstborn,
  unitType,
  waterUpkeep,
  sendExpedition,
  installBionic,
  BIONICS_BY_ID,
  MAX_CREW,
  scoutEnemy,
  assignRelic,
  RELICS_BY_ID,
  resolveEvent,
  chooseCampOption,
} from '@salt/game'
import type { Offer, Pace, RunState } from '@salt/game'

/** How hard to chase raw damage-per-hit as the enemy's armour reads heavier. */
const ARMOR_PRESSURE: Record<string, number> = {
  'barely armoured': 0,
  'lightly armoured': 0.3,
  armoured: 0.7,
  'heavily armoured': 1.2,
}

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`)
  if (i === -1) return fallback
  const v = Number(process.argv[i + 1])
  return Number.isFinite(v) ? v : fallback
}

function pad(s: string | number, w: number): string {
  return String(s).padStart(w)
}

/**
 * Answer the crossroads the way a greedy player would: always chase market
 * over recruitment over flavour, whichever categories actually came up. A
 * real player might skip market for a flavour event they want more, but the
 * bot exists to measure whether recruitment access gets used, not to play
 * preference.
 */
function chooseCrossroads(state: RunState): RunState {
  if (state.campOptions.length === 0) return state
  const order = ['market', 'recruitment', 'flavor'] as const
  const pick = order.find((c) => state.campOptions.some((o) => o.category === c))
  return chooseCampOption(state, pick ?? state.campOptions[0].category)
}

/**
 * Answer a pending camp event the way a greedy player would: take whichever
 * choice opens the market or hands over recruits outright, if it can be
 * afforded, else take the first choice at all. Real events also carry
 * morale/salvage trades this ignores — the bot is here to measure whether
 * recruitment opportunities exist and get used, not to play the flavour text
 * well.
 */
function answerEvent(state: RunState): RunState {
  if (!state.event) return state
  const salvage = state.warband.salvage
  const choices = state.event.choices
  let pick = choices.findIndex(
    (c) =>
      (c.opensMarket || c.grantSquads || c.grantOfficer) &&
      (c.requires === undefined || salvage >= c.requires),
  )
  if (pick === -1) pick = 0
  return resolveEvent(state, pick)
}

/** Buy whatever gives the most power per salvage, until broke. */
function shop(state: RunState, thrifty: boolean, onCurve: boolean): RunState {
  let s = state
  const pressure = onCurve ? (ARMOR_PRESSURE[scoutEnemy(s.encounter.enemy).armorWord] ?? 0) : 0
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
        // Reward for what a body swings with, not what it's carrying — the
        // resolved squad damage already lives inside `power`, and doubling
        // up on it would just re-count the same edge twice.
        const bite = pressure > 0 ? 1 + pressure * (unitType(o.typeId).base.damage / 15) : 1
        return { id: o.id, value: (power / o.cost) * bite }
      })
      .sort((a, b) => b.value - a.value)

    if (scored.length === 0) break
    const before = s.warband.salvage
    s = buy(s, scored[0].id)
    if (s.warband.salvage === before) break
  }

  /*
   * Fit whatever came out of the ruins, cheapest first, into the officers
   * leading the most bodies. Crude, but it is the only way to measure whether
   * bionics matter at all — an unfitted implant is worth exactly nothing.
   */
  for (let guard = 0; guard < 12 && s.warband.bionics.length > 0; guard++) {
    const stock = [...new Set(s.warband.bionics)].sort(
      (a, b) => (BIONICS_BY_ID.get(a)?.cost ?? 0) - (BIONICS_BY_ID.get(b)?.cost ?? 0),
    )
    const before = s.warband.bionics.length
    for (const o of s.warband.officers) {
      for (const id of stock) {
        s = installBionic(s, o.id, id)
      }
    }
    if (s.warband.bionics.length === before) break
  }

  /*
   * Bind whatever relics turned up to the biggest squad still carrying none,
   * cheapest first. Same crude reasoning as bionics above: an unbound relic
   * is worth exactly nothing, so this is the only way to measure whether the
   * system does anything at all.
   */
  for (let guard = 0; guard < 12 && s.warband.relics.length > 0; guard++) {
    const stock = [...new Set(s.warband.relics)].sort(
      (a, b) => (RELICS_BY_ID.get(a)?.cost ?? 0) - (RELICS_BY_ID.get(b)?.cost ?? 0),
    )
    const target = [...s.warband.squads]
      .filter((sq) => !sq.relicId)
      .sort((a, b) => b.count - a.count)[0]
    if (!target) break
    const before = s.warband.relics.length
    for (const id of stock) {
      s = assignRelic(s, target.id, id)
      if (s.warband.relics.length < before) break
    }
    if (s.warband.relics.length === before) break
  }

  /*
   * Claim every growth pick on offer.
   *
   * rollGrowth only OFFERS a mutation; chooseMutation is what takes it. The
   * bot did neither for a long time, so its Prospects accrued battles and
   * never a single mutation — which is why the harness reported zero
   * Firstborn across 400 runs and made it look like a tuning problem. It was
   * a harness that had never played the mutation game at all.
   *
   * Picks the highest level offered. A player would weigh the effect; this at
   * least measures the pipeline instead of ignoring it.
   */
  for (const offer of s.growth) {
    let best = 0
    for (let i = 1; i < offer.choices.length; i++) {
      if (offer.choices[i].level > offer.choices[best].level) best = i
    }
    s = chooseMutation(s, offer.prospectId, best)
  }

  /*
   * Bench anyone hurt who could still become a Firstborn.
   *
   * Not sophistication for its own sake — without it the bot fielded every
   * Prospect every battle and produced ZERO Firstborn across 400 runs, which
   * makes the whole promotion pipeline unmeasurable rather than balanced. A
   * player has this button and uses it; a bot that never does is measuring a
   * game nobody plays.
   *
   * Only the wounded, and only bodies deep enough to get there. Benching a
   * healthy one costs a fighter for nothing.
   */
  for (const pr of s.warband.prospects) {
    if (pr.fielded && pr.wound && canBecomeFirstborn(pr)) {
      s = setFielded(s, pr.id, false)
    } else if (!pr.fielded && !pr.wound) {
      s = setFielded(s, pr.id, true)
    }
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

function playRun(
  seedText: string,
  thrifty: boolean,
  onCurve: boolean,
  verb: 'scavenge' | 'delve' | null,
  origin: 'scion' | 'firstborn',
  pace: Pace,
) {
  // A bot cannot make a character-creation decision, so the mutant origin gets
  // the widest opening: three mutations at the shallow level. A player choosing
  // one at level 6 is a different run this harness does not measure.
  let state =
    origin === 'firstborn'
      ? newRun(seedText, {
          origin,
          mutationIds: ['horns', 'carapace', 'bulging-sacs'],
          name: 'Bot',
        })
      : newRun(seedText, { origin: 'scion' })
  let reached = 0
  let deserted = 0
  let shortMarches = 0
  let ticks = 0
  // Counted at every camp, not at the end: a lost run ends in annihilation,
  // so an end-of-run census of the named tier just measures how runs end.
  let peakFirstborn = 0
  let peakProspects = 0
  let maimed = 0
  let woundCamps = 0
  let benchCamps = 0
  let relicsBound = 0

  while (state.phase !== 'over') {
    if (state.phase === 'camp') {
      state = chooseCrossroads(state)
      state = answerEvent(state)
      peakFirstborn = Math.max(peakFirstborn, state.warband.prospects.filter(isFirstborn).length)
      peakProspects = Math.max(peakProspects, state.warband.prospects.length)
      const boundBefore = state.warband.squads.filter((sq) => sq.relicId).length
      state = shop(state, thrifty, onCurve)
      relicsBound += state.warband.squads.filter((sq) => sq.relicId).length - boundBefore
      if (verb) {
        // Bluntly greedy: always send the maximum crew. This is the upper
        // bound on how much expeditions can be exploited, not a good player.
        const crew = state.warband.prospects
          .filter((p) => p.fielded)
          .slice(0, MAX_CREW)
          .map((p) => p.id)
        if (crew.length > 0) state = sendExpedition(state, verb, crew)
      }
      /*
       * Column unless told otherwise, and that default is load-bearing: it is
       * exactly the old march cost, so every figure recorded before travel
       * existed stays comparable. --pace is for reading what the harder ones
       * do, not for changing what the baseline means.
       *
       * The bot still walks ONE pace for a whole run. A bot that chooses per
       * march needs the gap wired to an ending first, which is step 4.
       */
      let walked = setOut(state, pace)
      while (!travelDone(walked)) walked = advanceLeg(walked)
      const marched = march(walked)
      const setup = marched.setup
      state = marched.state
      const battle = new Battle(setup.config)
      ticks += battle.run()
      if (state.lastUpkeep && state.lastUpkeep.deserted > 0) {
        deserted += state.lastUpkeep.deserted
        shortMarches++
      }
      const events = battle.newEventsSince(0)
      maimed += events.filter((e) => e.type === BattleEventType.Maimed).length
      state = resolveBattle(state, battle.results(), battle.winner, battle.tick, setup.playerSources, events)
      /*
       * The wound ladder used to be dead code for mutants: a fresh wound
       * escalated to rung 1 and free recovery healed 2 rungs in the same
       * pass, so no Prospect ever carried one. Nothing in this harness would
       * have shown that, which is why it went unnoticed. Counted per camp so
       * "the ladder fires at all" is now visible.
       */
      woundCamps += state.warband.prospects.filter((pr) => pr.wound !== null).length
      benchCamps += state.warband.prospects.filter((pr) => !pr.fielded).length
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
    firstborn: peakFirstborn,
    prospects: peakProspects,
    deserted,
    shortMarches,
    ticks,
    maimed,
    woundCamps,
    benchCamps,
    relicsBound,
    // Instability, docs/V0-DESIGN.md §15. This bot claims EVERY growth offer,
    // so it pushes past capacity at every opportunity — an upper bound on how
    // unstable a warband can get, not what a player who stops would see.
    pushed: state.warband.prospects.filter((p) => p.instability > 0).length,
    peakInstability: state.warband.prospects.reduce((n, p) => Math.max(n, p.instability), 0),
    defects: state.warband.prospects.reduce(
      (n, p) => n + p.mutations.filter((m) => MUTATIONS_BY_ID.get(m.id)?.defect).length,
      0,
    ),
  }
}

const runs = arg('runs', 200)
const thrifty = process.argv.includes('--thrifty')
const onCurve = process.argv.includes('--oncurve')
const paceArg = process.argv[process.argv.indexOf('--pace') + 1]
const pace: Pace = PACES.includes(paceArg as Pace) ? (paceArg as Pace) : 'column'
const origin = process.argv.includes('--firstborn')
  ? ('firstborn' as const)
  : ('scion' as const)
const verb = process.argv.includes('--delve')
  ? ('delve' as const)
  : process.argv.includes('--scavenge')
    ? ('scavenge' as const)
    : null
console.log('Salt Crown — campaign harness')
console.log(
  `${runs} runs, ${thrifty ? 'thrifty' : 'greedy'}${onCurve ? '+oncurve' : ''} buyer, ${pace} pace, ` +
    `${ENCOUNTERS_PER_RUN} encounters each\n`,
)

let won = 0
let deserted = 0
let shortMarches = 0
let marches = 0
let firstborn = 0
let prospects = 0
let maimed = 0
let woundCamps = 0
let benchCamps = 0
let relicsBound = 0
let pushed = 0
let defects = 0
let peakInstability = 0
const runTicks: number[] = []
const reachedHist = new Array(ENCOUNTERS_PER_RUN + 1).fill(0)
const finalBodies: number[] = []

const started = Date.now()
for (let i = 1; i <= runs; i++) {
  const r = playRun(`seed-${i}`, thrifty, onCurve, verb, origin, pace)
  deserted += r.deserted
  shortMarches += r.shortMarches
  if (r.outcome === 'won') runTicks.push(r.ticks)
  firstborn += r.firstborn
  prospects += r.prospects
  maimed += r.maimed
  woundCamps += r.woundCamps
  benchCamps += r.benchCamps
  relicsBound += r.relicsBound
  pushed += r.pushed
  defects += r.defects
  peakInstability = Math.max(peakInstability, r.peakInstability)
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
console.log(
  `named tier  peak ${(prospects / runs).toFixed(1)} Prospects per run, ${(firstborn / runs).toFixed(2)} Firstborn
`,
)
console.log(`maimed      ${maimed} across ${runs} runs (both sides), ${(maimed / runs).toFixed(2)} per run\n`)
console.log(`relics      ${relicsBound} bound across ${runs} runs, ${(relicsBound / runs).toFixed(2)} per run`)
console.log(
  `wounds      ${woundCamps} wounded-Prospect-camps, ${benchCamps} benched-Prospect-camps ` +
    `(${(woundCamps / runs).toFixed(1)} / ${(benchCamps / runs).toFixed(1)} per run)`,
)
console.log(
  `instability ${pushed} bodies pushed past capacity, ${defects} defects grown, ` +
    `peak ${peakInstability}\n`,
)
console.log('  encounters won    runs')
console.log('  ----------------------')
for (let i = 0; i <= ENCOUNTERS_PER_RUN; i++) {
  const bar = '#'.repeat(Math.round((reachedHist[i] / runs) * 40))
  console.log(`  ${pad(i, 14)}  ${pad(reachedHist[i], 6)}  ${bar}`)
}

/*
 * Battle time only — camp time is the player's, and there is no way to guess
 * it from here. V0-DESIGN §12 targets a 25-35 minute run, so this is the half
 * of it the sim controls, at 20 Hz and whatever speed the player is running.
 */
if (runTicks.length > 0) {
  runTicks.sort((a, b) => a - b)
  const mid = runTicks[Math.floor(runTicks.length / 2)]
  const mins = (n: number) => (n / 20 / 60).toFixed(1)
  console.log(
    `\nbattle time per winning run  p50 ${mins(mid)} min at 1x, ` +
      `${mins(mid / 4)} min at 4x  (${mid} ticks)`,
  )
}

if (finalBodies.length > 0) {
  finalBodies.sort((a, b) => a - b)
  const mid = finalBodies[Math.floor(finalBodies.length / 2)]
  console.log(`\nwinning warband size  p50 ${mid}  max ${finalBodies[finalBodies.length - 1]}`)
}
console.log(`\n${runs} runs in ${elapsed}ms  (${(elapsed / runs).toFixed(0)}ms each)`)

if (won === runs) console.log('\nWARNING: greedy bot swept every run. Encounters are too soft.')
if (won === 0) console.log('\nWARNING: greedy bot never finished a run. Encounters are too hard.')
