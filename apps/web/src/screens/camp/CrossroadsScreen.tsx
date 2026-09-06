import type { CampOption, CrossroadsCategory } from '@salt/game'

/**
 * The crossroads: pick which rumor to follow before the camp reveals what it
 * actually is. Same takeover shape as EventScreen (full screen, no
 * navigation, the chrome doesn't change) — this is the step BEFORE that one.
 * A category chosen here becomes a real event; see run.ts's
 * chooseCampOption and events.ts's rollCampEvent.
 *
 * Deliberately doesn't reveal which specific event is behind a choice, only
 * a fixed line per category (`option.hint`, from events.ts) plus a fixed
 * one-word read here — a player can learn to recognise "dust on the
 * horizon" as "probably the market" over a run without ever being told
 * outright, the same way scouting's armour words become legible with
 * repetition.
 */
const CATEGORY_READ: Record<CrossroadsCategory, string> = {
  market: 'sounds like trade',
  recruitment: 'sounds like people',
  flavor: 'could be trouble, could be luck',
}

export default function CrossroadsScreen({
  options,
  onChoose,
}: {
  options: CampOption[]
  onChoose: (category: CrossroadsCategory) => void
}) {
  return (
    <div className="takeover event-takeover">
      <div className="takeover-body">
        <p className="takeover-kind">The scouts come back with word</p>
        <h1>Which way does the column turn?</h1>
        <p className="takeover-text">
          Nobody knows exactly what's out there until you're standing in it.
        </p>

        <div className="event-choices">
          {options.map((option) => (
            <button
              key={option.category}
              className="event-choice"
              onClick={() => onChoose(option.category)}
            >
              <span className="ec-label">{option.hint}</span>
              <span className="ec-detail">{CATEGORY_READ[option.category]}</span>
            </button>
          ))}
        </div>

        <p className="takeover-note">There is no walking past this one.</p>
      </div>
    </div>
  )
}
