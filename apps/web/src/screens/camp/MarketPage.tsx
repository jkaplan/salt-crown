import { rerollCost } from '@salt/game'
import { OfferRow, Section } from './parts'
import type { CampProps } from './parts'

/**
 * The market, and nothing else.
 *
 * It used to share a tab with the infantry breakdown, which put what you own
 * next to what is for sale and made both harder to read. What you own is the
 * warband's page; this one is only ever about spending.
 *
 * It also used to be here every camp. Now it's only stocked on the camps
 * where a caravan actually came through — see events.ts's MARKET_CHANCE —
 * so an empty page here isn't "wait for the reroll", it's "nobody sold
 * anything this stop."
 */
export default function MarketPage({ run, onBuy, onReroll }: CampProps) {
  const { warband } = run
  const cost = rerollCost(run.encounterIndex, run.rerollCount)
  const hasMarket = run.offers.length > 0

  return (
    <div className="camp-page">
      <Section title="Recruit" meta={`${warband.salvage} salvage`}>
        <ul className="rows">
          {run.offers.map((o) => (
            <OfferRow key={o.id} offer={o} salvage={warband.salvage} onBuy={onBuy} />
          ))}
        </ul>
        {!hasMarket && (
          <p className="empty">
            No traders have come through since the last march. Watch for a caravan.
          </p>
        )}
        {/*
          Requested directly, after the composition-matters measurement:
          scouting tells you what's coming, but a fixed four offers with no
          way to react to a bad draw means knowing doesn't always help.
          Costs more each time THIS camp, reset at the next one — a genuine
          bad draw is worth fixing, rerolling to a hand-picked lineup every
          camp is not, or the market stops being a lottery at all.
        */}
        {hasMarket && (
          <>
            <button
              className="btn-quiet reroll"
              disabled={warband.salvage < cost}
              onClick={onReroll}
            >
              Reroll the stock <span className="price">{cost}</span>
            </button>
            <p className="note">Gone the moment you leave. This stock is only good for this camp.</p>
          </>
        )}
      </Section>
    </div>
  )
}
