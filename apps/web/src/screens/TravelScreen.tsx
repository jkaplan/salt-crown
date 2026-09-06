import { useEffect, useRef, useState } from 'react'
import {
  LEGS_PER_MARCH,
  PACES,
  PACE_NAMES,
  TRAIL_LOST_AT,
  forecastPace,
  totalBodies,
  travelDone,
  waterUpkeep,
} from '@salt/game'
import type { Pace, RunState } from '@salt/game'
import EventScreen from './camp/EventScreen'

/**
 * The road — docs/plans/travel.md step 5.
 *
 * A takeover, on the same grounds as events and growth picks: the pace is
 * required input with no way past it, and a decision that shares a page with
 * a shop reads as optional however the buttons are labelled.
 *
 * Two states, one screen. Before the column moves it is a choice between
 * three quotes; once it moves it is a report of what each leg took. They are
 * one component because they are one moment — you pick a pace and then you
 * live with it, and a screen transition between those halves would make the
 * second read as a consequence of something else.
 *
 * The plan's finding-3 rule governs the second half: a leg may not be flavour
 * text plus a drain. Every leg prints what it actually took.
 */

/** What each pace costs, in plain words rather than a number to decode. */
const PACE_BLURB: Record<Pace, string> = {
  column: 'Route step. Nobody is hurt by it, and the quarry gains ground the whole way.',
  forced: 'Longer days than are good for them. Some fall behind; the hurt get worse.',
  killing: 'Driven until they drop. You will not arrive with everyone you left with.',
}

interface Snapshot {
  bodies: number
  water: number
  stragglers: number
  hurt: number
}

function snapshot(run: RunState): Snapshot {
  return {
    bodies: totalBodies(run.warband),
    water: run.warband.water,
    stragglers: (run.travel?.stragglers ?? []).reduce((n, g) => n + g.count, 0),
    hurt:
      run.warband.prospects.filter((p) => p.wound).length +
      run.warband.officers.filter((o) => o.wound).length,
  }
}

/**
 * What one leg took, in the player's terms.
 *
 * Straggling is reported net, because net is all the state knows: a leg where
 * four fall behind and four rejoin leaves the column the size it was, and
 * claiming both happened would be inventing detail the sim does not carry.
 */
function legReport(before: Snapshot, after: Snapshot): string[] {
  const lines: string[] = []

  const drank = before.water - after.water
  if (drank > 0) lines.push(`${drank} water drawn`)

  const behind = after.stragglers - before.stragglers
  if (behind > 0) lines.push(`${behind} fell behind`)
  else if (behind < 0) lines.push(`${-behind} caught up`)

  const worsened = after.hurt - before.hurt
  if (worsened > 0) lines.push(`${worsened} wound${worsened === 1 ? '' : 's'} worsened`)

  if (lines.length === 0) lines.push('Nothing but ground')
  return lines
}

function gapWord(gap: number): string {
  if (gap <= 0) return 'you are on top of it'
  if (gap >= TRAIL_LOST_AT) return 'the trail is cold'
  if (gap >= TRAIL_LOST_AT - 4) return 'the trail is going cold'
  return `${gap} day${gap === 1 ? '' : 's'} ahead of you`
}

export default function TravelScreen({
  run,
  onSetOut,
  onWalk,
  onArrive,
  onAnswer,
}: {
  run: RunState
  onSetOut: (pace: Pace) => void
  onWalk: () => void
  onArrive: () => void
  onAnswer: (index: number) => void
}) {
  const travel = run.travel
  const onTheRoad = run.phase === 'travel' && travel !== null
  const legsDone = travel?.legsDone ?? 0

  const before = useRef<Snapshot | null>(null)
  const [log, setLog] = useState<string[][]>([])

  /*
   * The diff is taken here rather than in the sim, which has no reason to
   * remember what the warband looked like a leg ago. The snapshot is captured
   * in the click handler, so this only ever compares the two sides of one walk.
   */
  useEffect(() => {
    const prev = before.current
    if (!onTheRoad || !prev) return
    setLog((l) => (l.length >= legsDone ? l : [...l, legReport(prev, snapshot(run))]))
  }, [legsDone, onTheRoad, run])

  if (!onTheRoad) {
    const upkeep = waterUpkeep(run.warband)

    return (
      <div className="takeover travel-takeover">
        <div className="takeover-body">
          <p className="takeover-kind">Breaking camp</p>
          <h1>How hard do you drive them?</h1>
          <p className="takeover-text">
            {LEGS_PER_MARCH} legs to the next fight, and the quarry is {gapWord(run.gap)}
            {run.trailLost && '. Nothing you do on this road will change that'}.
          </p>

          <div className="growth-choices">
            {PACES.map((pace) => {
              const f = forecastPace(run.warband, run.gap, run.trailLost, pace)
              return (
                <button
                  key={pace}
                  className="growth-choice pace-choice"
                  onClick={() => onSetOut(pace)}
                >
                  <span className="gc-name">{PACE_NAMES[pace]}</span>
                  <span className="pace-facts">
                    <b className="water">{f.bill}</b> water
                    {f.deserters > 0 && (
                      <>
                        {' · '}
                        <b className="dead">{f.deserters}</b> will not march thirsty
                      </>
                    )}
                    {!run.trailLost && (
                      <>
                        {' · gap '}
                        <b className={f.gapAfter < run.gap ? 'gap-close' : 'gap-lose'}>
                          {f.gapAfter > run.gap && '+'}
                          {f.gapAfter - run.gap}
                        </b>
                      </>
                    )}
                  </span>
                  <span className="gc-blurb">{PACE_BLURB[pace]}</span>
                  {f.losesTrail && (
                    <span className="pace-warn">This is the march that loses the trail.</span>
                  )}
                  {f.catches && <span className="pace-catch">This runs it down.</span>}
                </button>
              )
            })}
          </div>

          <p className="takeover-note">
            Ordinary upkeep is {upkeep} water, and Column is that exactly. A pace only costs more
            than standing still when you pick one.
          </p>
        </div>
      </div>
    )
  }

  /*
   * The road stopped to ask something. Same screen the camp events use — a
   * trail event is the same shape, and a second screen that looked almost
   * like the first would be the inconsistency the takeover comment warns
   * about rather than a distinction.
   */
  if (run.trailEvent) {
    return (
      <EventScreen
        event={run.trailEvent}
        salvage={run.warband.salvage}
        onChoose={onAnswer}
        kind={`${PACE_NAMES[travel.pace]} · leg ${legsDone} of ${LEGS_PER_MARCH}`}
        note="The column has stopped. It does not start again until you say so."
        unavailable={(i) => {
          const c = run.trailEvent!.choices[i]
          return c.pace === travel.pace ? 'already the pace' : null
        }}
      />
    )
  }

  const done = travelDone(run)
  const carried = travel.stragglers.reduce((n, g) => n + g.count, 0)

  return (
    <div className="takeover travel-takeover">
      <div className="takeover-body">
        <p className="takeover-kind">{PACE_NAMES[travel.pace]}</p>
        <h1>{done ? 'The column halts' : `Leg ${legsDone + 1} of ${LEGS_PER_MARCH}`}</h1>

        <div className="legs">
          {Array.from({ length: LEGS_PER_MARCH }, (_, i) => (
            <div key={i} className={i < legsDone ? 'leg walked' : 'leg'} />
          ))}
        </div>

        {log.length > 0 && (
          <div className="leg-log">
            {log.map((lines, i) => (
              <div key={i} className="leg-line">
                <span className="leg-n">Leg {i + 1}</span>
                <span>{lines.join(' · ')}</span>
              </div>
            ))}
          </div>
        )}

        <p className="takeover-text">
          <b className="held">{totalBodies(run.warband)}</b> still walking ·{' '}
          <b className="water">{run.warband.water}</b> water left
          {carried > 0 && (
            <>
              {' · '}
              <b className="dead">{carried}</b> somewhere behind
            </>
          )}
        </p>

        {done ? (
          <>
            <p className="takeover-note">
              {run.trailLost
                ? 'The trail is cold. You march on because there is nothing else to do.'
                : `The quarry is ${gapWord(run.gap)}.`}
            </p>
            <button className="btn-primary" onClick={onArrive}>
              {run.encounter.name} is ahead
            </button>
          </>
        ) : (
          <button
            className="btn-primary"
            onClick={() => {
              before.current = snapshot(run)
              onWalk()
            }}
          >
            Walk on
          </button>
        )}
      </div>
    </div>
  )
}
