import { Rng } from '@salt/sim'

/**
 * Events, as data.
 *
 * The point of a template system is that adding an event is adding a row to a
 * table, not writing code. So a choice declares *what it does* rather than
 * *how* — the resolver in run.ts is the only thing that knows how to apply an
 * effect, and it is the only thing that has to change when the vocabulary
 * grows.
 *
 * Events are where morale becomes a run-level resource rather than something
 * derived purely from lineage. See docs/V0-DESIGN.md §7: "morale should become
 * a run-level resource shifted by between-battle events."
 */
export interface EventChoice {
  label: string
  /** What it costs and what it buys, shown before committing. */
  detail: string
  /** Shift to warband morale. Positive steadies, negative shakes. */
  morale?: number
  /** Salvage gained. Negative spends. */
  salvage?: number
  /** Minimum salvage required to pick this at all. */
  requires?: number
  /**
   * Restore condition to the most worn machine. The one exception to
   * "machines only degrade" (V0-DESIGN §3), and it is an EVENT rather than a
   * service on purpose — a shop that sells repairs turns a decaying asset back
   * into an ordinary one.
   */
  restoreMachine?: number
  /**
   * Reveal the standing market for this camp only — the same four squads and
   * one officer the market always used to roll, now gated behind actually
   * running into someone selling. Reset to nothing the next camp regardless
   * of whether it was opened.
   */
  opensMarket?: boolean
  /**
   * Hand over N batches from a pool directly — no offer, no separate
   * purchase, the event's own `salvage` above (if any) is the whole price.
   * Rolled from the same lottery the market uses, so a "coffle" or a
   * "splinter band" carries the same odds of turning up a Prospect that
   * buying the equivalent batch at the market would.
   */
  grantSquads?: { pool: 'mutant' | 'truekin'; count: number }
  /** Hand over one rolled Officer directly, same terms as grantSquads. */
  grantOfficer?: boolean
}

/** An event that only makes sense when the warband has something to act on. */
export type EventGate = 'machine'

export interface GameEvent {
  id: string
  title: string
  body: string
  choices: EventChoice[]
  /**
   * Only offered when the warband has one of these. Without it the Tinkerer
   * would turn up for a warband with no machine and read as a bug.
   */
  needs?: EventGate
}

/**
 * Morale is clamped hard.
 *
 * It is a thumb on the scale, not a second health bar — at the extremes it
 * moves discipline by 0.12, which is meaningful against a mutant floor of
 * 0.35 without ever deciding a battle on its own.
 */
export const MORALE_MIN = -0.12
export const MORALE_MAX = 0.12

export function clampMorale(v: number): number {
  return Math.max(MORALE_MIN, Math.min(MORALE_MAX, v))
}

/** How the current morale reads to the player. */
export function moraleWord(morale: number): string {
  if (morale <= -0.08) return 'mutinous'
  if (morale <= -0.03) return 'sullen'
  if (morale < 0.03) return 'steady'
  if (morale < 0.08) return 'willing'
  return 'devoted'
}

/**
 * Chance, per camp, that the pending event is the caravan rather than a draw
 * from the ordinary table below. Recruitment used to be a standing shop
 * rerolled at every camp; now it is one more thing that has to actually
 * happen to you, FTL-beacon style.
 *
 * Measured with `npm run sim:campaign` (300 runs, greedy/thrifty, Scion) —
 * completion tracks this almost linearly, because every recruitment
 * opportunity feeds the same square-law snowball combat already runs on
 * (§6b):
 *
 *   MARKET_CHANCE   greedy   thrifty
 *   1.0 (every camp) 20.7%    21.7%
 *   0.8               16.3%    13.7%
 *   0.65              12.3%    14.7%
 *   0.5                6.7%     7.3%
 *   0.3                3.0%     1.3%
 *
 * 0.5 landed as the compromise: real scarcity (half of camps, not all of
 * them, plus whichever one-time slaver/wanderer/recruiter events happen to
 * turn up), without cutting completion to a third of where it stood before
 * this feature.
 */
export const MARKET_CHANCE = 0.5

/**
 * The recurring one. Everything below this is seen at most once a run;
 * the caravan is the exception, and is not added to `seenEvents` in a way
 * that would ever exclude it from being rolled again.
 */
export const CARAVAN: GameEvent = {
  id: 'caravan',
  title: 'A column comes up out of the haze',
  body:
    'Wagons, water barrels lashed down, outriders keeping their distance until you signal. Not a raiding line. Traders, or something close enough to it out here.',
  choices: [
    {
      label: 'Open the pens and trade',
      detail: 'Full stock, same as it ever was. Gone the moment they move on.',
      opensMarket: true,
    },
    {
      label: 'Wave them past',
      detail: 'You do not need what they are selling badly enough to stop the column.',
      morale: 0.02,
    },
  ],
}

/**
 * The V0 table.
 *
 * Every one is a real trade — salvage against morale, or a short-term gain
 * against the warband's opinion of you. None of them are "you found 40
 * salvage, click OK", because a choice with one option is a notification.
 *
 * The four recruitment events below (slavers-coffle through deserting-
 * garrison) are the "slaver events or random recruitment events" asked for
 * directly — bodies that arrive as a decision with a story attached, rather
 * than four more rows in a shop that was already open. `deserting-garrison`
 * is the one built to answer "could also be just one but I could see a group
 * joining too" in the same event: one squad or two, the player's call.
 */
export const EVENTS: readonly GameEvent[] = [
  {
    id: 'house-buyer',
    title: 'A House factor makes an offer',
    body:
      'He has a ledger, a clean coat, and a standing order for graded stock. He does not ask which of them you have been feeding.',
    choices: [
      {
        label: 'Sell him the pick of the pens',
        detail: 'A good price. The others watch it happen.',
        salvage: 120,
        morale: -0.05,
      },
      {
        label: 'Tell him to walk',
        detail: 'Nothing gained. They notice that too.',
        morale: 0.04,
      },
    ],
  },
  {
    id: 'water-short',
    title: 'The cistern is lower than it should be',
    body:
      'Either somebody has been drinking their fill or the seals have gone. Both answers cost you.',
    choices: [
      {
        label: 'Ration it',
        detail: 'Everyone gets less. Everyone knows why.',
        morale: -0.05,
      },
      {
        label: 'Buy water from the next holdfast',
        detail: 'Expensive, and they will remember you paid.',
        salvage: -70,
        morale: 0.03,
        requires: 70,
      },
    ],
  },
  {
    id: 'the-hanging',
    title: 'One of them killed another over food',
    body: 'Nobody disputes what happened. They are waiting to see what you do about it.',
    choices: [
      {
        label: 'Hang him in front of the column',
        detail: 'Order, bought with fear.',
        morale: -0.03,
      },
      {
        label: 'Put him back in the line',
        detail: 'Mercy, or weakness. They have not decided which.',
        morale: 0.02,
      },
      {
        label: 'Let them settle it themselves',
        detail: 'You do not watch. It is over by morning.',
        morale: -0.01,
        salvage: 25,
      },
    ],
  },
  {
    id: 'assayer-favour',
    title: 'An Assayer wants passage',
    body:
      'She has a case of callipers and no escort, and the next stretch is not walkable alone. She can pay in the only currency she has.',
    choices: [
      {
        label: 'Take her along for a grading',
        detail: 'Free work, one body. She travels behind the line.',
        salvage: 45,
      },
      {
        label: 'Take her along for nothing',
        detail: 'The column likes that more than she does.',
        morale: 0.05,
      },
      {
        label: 'Leave her',
        detail: 'The road is not your responsibility.',
        morale: -0.03,
      },
    ],
  },
  {
    id: 'deserters',
    title: 'Three of them are gone by morning',
    body: 'They took water and left the pens open behind them. Their tracks go south, away from the fighting.',
    choices: [
      {
        label: 'Hunt them down',
        detail: 'You get the water back. Nobody sleeps well after.',
        salvage: 30,
        morale: -0.06,
      },
      {
        label: 'Let them go',
        detail: 'Say nothing. Some of them were thinking about it too.',
        morale: 0.01,
      },
    ],
  },
  {
    id: 'salt-cache',
    title: 'A cache under a fallen span',
    body:
      'Sealed, dry, and forgotten. Getting into it means putting bodies under something that has already come down once.',
    choices: [
      {
        label: 'Send them in',
        detail: 'Good salvage. They understand exactly what they were sent under.',
        salvage: 95,
        morale: -0.04,
      },
      {
        label: 'Leave it',
        detail: 'Walk past. They see you walk past.',
        morale: 0.02,
      },
    ],
  },
  {
    id: 'the-noise',
    title: 'Something moved under the flats last night',
    body:
      'Not an animal. The sound came up through the salt for most of an hour and then stopped. Two of them will not go back to sleep.',
    choices: [
      {
        label: 'March before dawn',
        detail: 'Put distance between the column and whatever that was.',
        morale: -0.02,
      },
      {
        label: 'Hold and watch',
        detail: 'Nothing comes. Standing your ground counts for something.',
        morale: 0.04,
      },
    ],
  },
  {
    id: 'firstborn-question',
    title: 'They want to know what happens to the ones who last',
    body:
      'It is not really a question about policy. Somebody in the pens has started counting their own battles.',
    choices: [
      {
        label: 'Tell them the truth',
        detail: 'Some of them will live long enough to matter. Most will not.',
        morale: 0.05,
      },
      {
        label: 'Tell them nothing',
        detail: 'They are stock. Stock does not need answers.',
        morale: -0.04,
      },
    ],
  },
  {
    id: 'the-tinkerer',
    title: 'Someone at the edge of the firelight wants to look at it',
    body:
      'No House marks, no lineage anybody recognises, and a roll of tools that should not still exist. They have been watching the machine walk since midday and they have opinions about the noise it is making.',
    needs: 'machine',
    choices: [
      {
        label: 'Pay whatever they ask',
        detail: 'The most worn machine comes back most of the way.',
        salvage: -160,
        requires: 160,
        restoreMachine: 4,
      },
      {
        label: 'Let them look, nothing more',
        detail: 'A few hours of work and a part they had spare.',
        restoreMachine: 1,
      },
      {
        label: 'Send them off',
        detail: 'Nobody gets to open it up. The column approves of the caution.',
        morale: 0.03,
      },
    ],
  },
  {
    id: 'slavers-coffle',
    title: 'A coffle, chained wrist to wrist',
    body:
      'The trader running them is not proud of the work and not ashamed of it either. He wants this off his hands more than he wants the fair price for it.',
    choices: [
      {
        label: 'Buy the whole coffle',
        detail: 'They join the pens. Ragged, and yours.',
        salvage: -90,
        requires: 90,
        morale: -0.05,
        grantSquads: { pool: 'mutant', count: 1 },
      },
      {
        label: "Buy their freedom, and let them walk",
        detail: 'Costs the same. Nobody joins you for it.',
        salvage: -90,
        requires: 90,
        morale: 0.06,
      },
      {
        label: 'Leave it alone',
        detail: 'Not your ledger to settle.',
        morale: -0.01,
      },
    ],
  },
  {
    id: 'wanderers',
    title: 'A splinter band asks to fall in behind you',
    body:
      "What's left of somebody else's warband — no banner, no officer, just people who decided marching with you beats marching alone.",
    choices: [
      {
        label: 'Take them in',
        detail: 'No cost but the water they drink. They join as they are.',
        morale: 0.03,
        grantSquads: { pool: 'mutant', count: 1 },
      },
      {
        label: 'Turn them away',
        detail: 'One more mouth is one more mouth.',
        morale: -0.02,
      },
    ],
  },
  {
    id: 'house-recruiter',
    title: 'A House agent is recruiting, and willing to talk to you',
    body:
      'He has papers, a standing commission, and no particular loyalty beyond whoever is paying this season.',
    choices: [
      {
        label: 'Take his contract',
        detail: "An officer joins, on the House's usual terms.",
        salvage: -140,
        requires: 140,
        grantOfficer: true,
      },
      {
        label: 'Pass',
        detail: 'You do not need his kind of trouble.',
        morale: 0.01,
      },
    ],
  },
  {
    id: 'deserting-garrison',
    title: 'A garrison walks off its own post',
    body:
      "Whatever House they served stopped paying them somewhere back down the line. Two squads' worth, still armed, asking who is in charge here.",
    choices: [
      {
        label: 'Take the lot',
        detail: 'Two squads join at once. They still remember whose colours they used to wear.',
        morale: -0.02,
        grantSquads: { pool: 'truekin', count: 2 },
      },
      {
        label: 'Take half, send the rest on',
        detail: 'One squad. Less to feed, less to answer for.',
        morale: 0.02,
        grantSquads: { pool: 'truekin', count: 1 },
      },
      {
        label: 'Send them all on',
        detail: 'Not your problem to solve.',
      },
    ],
  },
]

/**
 * One event for the camp, weighted toward the caravan first — see
 * `MARKET_CHANCE` — and otherwise never the same table entry twice in a run,
 * and never an impossible one.
 */
export function rollEvent(rng: Rng, seen: string[], has: Set<EventGate>): GameEvent | null {
  if (rng.float() < MARKET_CHANCE) return CARAVAN
  const pool = EVENTS.filter((e) => !seen.includes(e.id) && (!e.needs || has.has(e.needs)))
  if (pool.length === 0) return null
  return pool[rng.int(pool.length)]
}
