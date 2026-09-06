import { PACE_NAMES } from '@salt/game'
import type { GameEvent } from '@salt/game'

/**
 * An event, taking the whole screen.
 *
 * It used to be a card stacked on the camp page between the status strip and
 * the shop, which is the wrong shape for it twice over. An event BLOCKS the
 * march — it is required input, and required input is the one case every UI
 * guide agrees warrants a full takeover rather than a panel. And a decision
 * that shares a page with a shop reads as optional no matter what the button
 * states say.
 *
 * This is what Slay the Spire does with its event nodes and FTL does with its
 * beacons: one screen, one decision, no navigation offered while it is up.
 *
 * The chrome is deliberately the same as everywhere else. Banner Saga's UX
 * post-mortem is blunt about the alternative — inconsistent frame styles
 * across menus "create confusion rather than distinction". What separates this
 * screen is the ground it sits on and the fact that nothing else is on it, not
 * a new visual language.
 *
 * The road reuses it outright (docs/plans/travel.md step 6). A trail event is
 * the same shape — a title, a situation, branches that differ — so it gets the
 * same screen with different framing text rather than a second one that looks
 * almost like it.
 */
export default function EventScreen({
  event,
  salvage,
  onChoose,
  kind = 'The column is waiting on you',
  note = 'There is no walking past this one.',
  unavailable,
}: {
  event: GameEvent
  salvage: number
  onChoose: (index: number) => void
  kind?: string
  note?: string
  /**
   * Why a branch cannot be taken right now, for reasons the event data
   * cannot know. The road uses it for the pace the column is already
   * walking at — a branch that changes nothing is not a branch.
   */
  unavailable?: (index: number) => string | null
}) {
  return (
    <div className="takeover event-takeover">
      <div className="takeover-body">
        <p className="takeover-kind">{kind}</p>
        <h1>{event.title}</h1>
        <p className="takeover-text">{event.body}</p>

        <div className="event-choices">
          {event.choices.map((choice, i) => {
            const moot = unavailable?.(i) ?? null
            const blocked = (choice.requires !== undefined && salvage < choice.requires) || !!moot
            return (
              <button
                key={choice.label}
                className="event-choice"
                disabled={blocked}
                onClick={() => onChoose(i)}
              >
                <span className="ec-label">{choice.label}</span>
                <span className="ec-detail">{choice.detail}</span>
                <span className="ec-cost">
                  {choice.salvage ? (
                    <span className={choice.salvage > 0 ? 'salvage' : 'dead'}>
                      {choice.salvage > 0 ? '+' : ''}
                      {choice.salvage} salvage
                    </span>
                  ) : null}
                  {choice.morale ? (
                    <span className={choice.morale > 0 ? 'held' : 'dead'}>
                      {choice.morale > 0 ? 'steadies' : 'shakes'} the column
                    </span>
                  ) : null}
                  {choice.restoreMachine ? <span className="held">restores a machine</span> : null}
                  {choice.opensMarket ? <span className="held">opens the market</span> : null}
                  {choice.grantSquads ? (
                    <span className="held">
                      {choice.grantSquads.count > 1
                        ? `${choice.grantSquads.count} squads join`
                        : 'a squad joins'}
                    </span>
                  ) : null}
                  {choice.grantOfficer ? <span className="held">an officer joins</span> : null}
                  {choice.water ? (
                    <span className={choice.water > 0 ? 'water' : 'dead'}>
                      {choice.water > 0 ? '+' : ''}
                      {choice.water} water
                    </span>
                  ) : null}
                  {choice.gap ? (
                    <span className={choice.gap < 0 ? 'gap-close' : 'gap-lose'}>
                      {choice.gap > 0 ? '+' : ''}
                      {choice.gap} day{Math.abs(choice.gap) === 1 ? '' : 's'} on the gap
                    </span>
                  ) : null}
                  {choice.pace ? (
                    <span className="salvage">{PACE_NAMES[choice.pace].toLowerCase()} from here</span>
                  ) : null}
                  {choice.rallyStragglers ? (
                    <span className="held">the stragglers come in</span>
                  ) : null}
                  {moot ? (
                    <span className="dim">{moot}</span>
                  ) : (
                    blocked && <span className="dim">cannot afford</span>
                  )}
                </span>
              </button>
            )
          })}
        </div>

        <p className="takeover-note">{note}</p>
      </div>
    </div>
  )
}
