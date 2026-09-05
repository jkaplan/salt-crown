import { MUTATIONS_BY_ID, isPastCapacity, tollSpent, unitType } from '@salt/game'
import type { GrowthOffer, Prospect } from '@salt/game'
import UnitShape from '../../components/UnitShape'
import MutationIcon from '../../components/MutationIcon'

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
  const spent = tollSpent(prospect)
  /*
   * Past its own capacity, every remaining pick is a push — the body forced
   * somewhere it was not built to hold. The screen has to say so before the
   * click, not after: this is the only permanent decision in the game that
   * can make a body worse, and it should never be taken by accident.
   */
  const pushing = isPastCapacity(prospect)

  return (
    <div className={`takeover growth-takeover${pushing ? ' pushing' : ''}`}>
      <div className="takeover-body">
        <p className="takeover-kind">
          {pushing ? 'They came back, and there is no room left' : 'They came back'}
          {remaining > 1 && <span className="dim"> · {remaining - 1} more waiting</span>}
        </p>

        <div className="growth-who">
          <UnitShape typeId={prospect.typeId} />
          <div>
            <h1>{prospect.name}</h1>
            <p className="takeover-text">
              {type.name} · {prospect.battles} battle{prospect.battles === 1 ? '' : 's'} survived ·{' '}
              {spent} of {prospect.capacity} capacity spent
              {prospect.instability > 0 && (
                <span className="growth-unstable"> · unstable {prospect.instability}</span>
              )}
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
                className={`growth-choice${pushing ? ' pushing' : ''}`}
                onClick={() => onChoose(prospect.id, i)}
              >
                {def && <MutationIcon icon={def.icon} size={28} />}
                <span className="gc-name">
                  {def?.name} <b>{choice.level}</b>
                </span>
                <span className="gc-effect">{def?.describe(choice.level)}</span>
                <span className="gc-blurb">{def?.blurb}</span>
                {/* Toll only matters once it is scarce, so it only appears
                    once the body is close to or past its own ceiling. */}
                {def && spent + def.toll > prospect.capacity && (
                  <span className="gc-toll">
                    costs {def.toll} · {spent + def.toll - prospect.capacity} past the limit
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <p className={`takeover-note${pushing ? ' warn' : ''}`}>
          {pushing ? (
            <>
              This body is past what it was built to hold. Take another and it grows
              <b> unstable</b> — an unstable body changes on its own between battles, and
              what grows is usually a defect. Nothing here makes it stable again.
            </>
          ) : (
            <>Permanent, and theirs alone — it does not pass to a squad they lead. Choose once.</>
          )}
        </p>
      </div>
    </div>
  )
}
