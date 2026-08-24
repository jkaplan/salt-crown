import { ORIGINS } from '@salt/game'
import type { OriginId } from '@salt/game'

/**
 * Who you are — docs/V0-DESIGN.md §13.
 *
 * The first real decision of a run, and it has to be readable before the
 * player knows what any of the words mean. So each card leads with the plain
 * consequence ("no Officers", "True Kin cost double") rather than with the
 * fiction, and the fiction sits underneath for the second read.
 */
export default function OriginSelect({
  onBack,
  onSelect,
}: {
  onBack: () => void
  onSelect: (origin: OriginId) => void
}) {
  return (
    <div className="origin-select">
      <header className="setup-head">
        <h1>Who are you?</h1>
        <p className="dim">
          This decides who follows you and what everyone else charges. It cannot be changed.
        </p>
      </header>

      <div className="origin-cards">
        {ORIGINS.map((o) => (
          <button key={o.id} className="origin-card" onClick={() => onSelect(o.id)}>
            <span className="origin-lineage">{o.lineage}</span>
            <h2>{o.name}</h2>
            <p className="origin-blurb">{o.blurb}</p>
            <p className="origin-detail">{o.detail}</p>
            <span className="origin-facts">
              {o.truekinPremium > 1 ? (
                <b className="dead">True Kin cost {o.truekinPremium.toFixed(1)}× as much</b>
              ) : (
                <b className="truekin">True Kin at the going rate</b>
              )}
            </span>
          </button>
        ))}
      </div>

      <button className="btn-quiet" onClick={onBack}>
        Back
      </button>
    </div>
  )
}
