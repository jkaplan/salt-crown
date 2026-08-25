import { rerollCost } from '@salt/game'
import { OfferRow, Section } from './parts'
import type { CampProps } from './parts'

/**
 * The market, and nothing else.
 *
 * It used to share a tab with the infantry breakdown, which put what you own
 * next to what is for sale and made both harder to read. What you own is the
 * warband's page; this one is only ever about spending.
 */
export default function MarketPage({ run, onBuy, onReroll }: CampProps) {
  const { warband } = run
  const cost = rerollCost(run.encounterIndex, run.rerollCount)

  return (
    <div className="camp-page">
      <Section title="Recruit" meta={`${warband.salvage} salvage`}>
        <ul className="rows">
          {run.offers.map((o) => (
            <OfferRow key={o.id} offer={o} salvage={warband.salvage} onBuy={onBuy} />
          ))}
        </ul>
        {run.offers.length === 0 && <p className="empty">Nothing left on offer.</p>}
        {/*
          Requested directly, after the composition-matters measurement:
          scouting tells you what's coming, but a fixed four offers with no
          way to react to a bad draw means knowing doesn't always help.
          Costs more each time THIS camp, reset at the next one — a genuine
          bad draw is worth fixing, rerolling to a hand-picked lineup every
          camp is not, or the market stops being a lottery at all.
        */}
        <button
          className="btn-quiet reroll"
          disabled={warband.salvage < cost}
          onClick={onReroll}
        >
          Reroll the stock <span className="price">{cost}</span>
        </button>
        <p className="note">
          Stock is also rerolled automatically at every camp. Nothing here waits for you.
        </p>
      </Section>
    </div>
  )
}
