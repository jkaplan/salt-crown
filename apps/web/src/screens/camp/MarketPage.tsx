import { OfferRow, Section } from './parts'
import type { CampProps } from './parts'

/**
 * The market, and nothing else.
 *
 * It used to share a tab with the infantry breakdown, which put what you own
 * next to what is for sale and made both harder to read. What you own is the
 * warband's page; this one is only ever about spending.
 */
export default function MarketPage({ run, onBuy }: CampProps) {
  const { warband } = run

  return (
    <div className="camp-page">
      <Section title="Recruit" meta={`${warband.salvage} salvage`}>
        <ul className="rows">
          {run.offers.map((o) => (
            <OfferRow key={o.id} offer={o} salvage={warband.salvage} onBuy={onBuy} />
          ))}
        </ul>
        {run.offers.length === 0 && <p className="empty">Nothing left on offer.</p>}
        <p className="note">
          Stock is rerolled at every camp. Nothing here waits for you.
        </p>
      </Section>
    </div>
  )
}
