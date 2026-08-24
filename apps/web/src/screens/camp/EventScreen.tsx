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
 */
export default function EventScreen({
  event,
  salvage,
  onChoose,
}: {
  event: GameEvent
  salvage: number
  onChoose: (index: number) => void
}) {
  return (
    <div className="takeover event-takeover">
      <div className="takeover-body">
        <p className="takeover-kind">The column is waiting on you</p>
        <h1>{event.title}</h1>
        <p className="takeover-text">{event.body}</p>

        <div className="event-choices">
          {event.choices.map((choice, i) => {
            const blocked = choice.requires !== undefined && salvage < choice.requires
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
                  {blocked && <span className="dim">cannot afford</span>}
                </span>
              </button>
            )
          })}
        </div>

        <p className="takeover-note">There is no walking past this one.</p>
      </div>
    </div>
  )
}
