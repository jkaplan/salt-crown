import { MUTATIONS_BY_ID, unitType } from '@salt/game'
import type { GrowthOffer, Prospect } from '@salt/game'
import UnitShape from '../../components/UnitShape'

/**
 * Growth picks, taking the whole screen.
 *
 * Same reasoning as the event takeover, and a stronger case for it: this is
 * the only place in the game where the player DIRECTS what the warband becomes
 * rather than choosing from what the shop happened to roll, and it is
 * permanent. It spent its life as a block above the tab bar.
 *
 * One prospect at a time. Three of them side by side turns a decision into a
 * spreadsheet, and each one deserves its own read.
 */
export default function GrowthScreen({
  offer,
  prospect,
  remaining,
  onChoose,
}: {
  offer: GrowthOffer
  prospect: Prospect
  remaining: number
  onChoose: (prospectId: string, choiceIndex: number) => void
}) {
  const type = unitType(prospect.typeId)
  const next = prospect.mutations.length + 1

  return (
    <div className="takeover growth-takeover">
      <div className="takeover-body">
        <p className="takeover-kind">
          They came back
          {remaining > 1 && <span className="dim"> · {remaining - 1} more waiting</span>}
        </p>

        <div className="growth-who">
          <UnitShape typeId={prospect.typeId} />
          <div>
            <h1>{prospect.name}</h1>
            <p className="takeover-text">
              {type.name} · {prospect.battles} battle{prospect.battles === 1 ? '' : 's'} survived ·
              mutation {next} of {prospect.capacity}
            </p>
          </div>
        </div>

        {prospect.mutations.length > 0 && (
          <p className="growth-carried">
            <span className="dim">Already carrying </span>
            {prospect.mutations
              .map((m) => `${MUTATIONS_BY_ID.get(m.id)?.name} ${m.level}`)
              .join(' · ')}
          </p>
        )}

        <div className="growth-choices">
          {offer.choices.map((choice, i) => {
            const def = MUTATIONS_BY_ID.get(choice.id)
            return (
              <button
                key={choice.id}
                className="growth-choice"
                onClick={() => onChoose(prospect.id, i)}
              >
                <span className="gc-name">
                  {def?.name} <b>{choice.level}</b>
                </span>
                <span className="gc-effect">{def?.describe(choice.level)}</span>
                <span className="gc-blurb">{def?.blurb}</span>
              </button>
            )
          })}
        </div>

        <p className="takeover-note">
          Permanent, and it leaks to every squad they lead. Choose once.
        </p>
      </div>
    </div>
  )
}
