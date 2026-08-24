import { useState } from 'react'
import Hub from './camp/Hub'
import MarketPage from './camp/MarketPage'
import RuinsPage from './camp/RuinsPage'
import WarbandPage from './camp/WarbandPage'
import { CAMP_PAGES } from './camp/pages'
import type { CampPage } from './camp/pages'
import type { CampProps } from './camp/parts'

/**
 * Camp: a hub and three places to go.
 *
 * This was one 1200-line screen carrying the battle line, the roster, the
 * market, expeditions, events, growth picks and the march at once. Every one
 * of those arrived as its own milestone and got stacked onto the same page,
 * which is how a screen ends up asking the player to find the part that
 * matters rather than showing it to them.
 *
 * The split is by DECISION, not by data. The hub holds what blocks or expires
 * — events, growth, a shortfall — and the doors hold what you browse at your
 * own pace. A tab bar would not have fixed it: tabs make things peers, and
 * "answer this before you can march" is not a peer of "look at the shop".
 */
export default function Camp(props: CampProps) {
  const [page, setPage] = useState<CampPage | null>(null)

  if (page === null) return <Hub {...props} onOpen={setPage} />

  const meta = CAMP_PAGES.find((p) => p.id === page)!

  return (
    <div className="camp">
      {/*
        One way back, always in the same place. A player who opens the market
        and cannot find camp again will not open the market twice.
      */}
      <div className="page-head">
        <button className="btn-quiet back" onClick={() => setPage(null)}>
          ← Camp
        </button>
        <h1>{meta.label}</h1>
        <span className="dim">{meta.blurb}</span>
      </div>

      {page === 'warband' && <WarbandPage {...props} />}
      {page === 'market' && <MarketPage {...props} />}
      {page === 'ruins' && <RuinsPage {...props} />}
    </div>
  )
}
