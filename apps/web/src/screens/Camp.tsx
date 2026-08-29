import { useState } from 'react'
import CrossroadsScreen from './camp/CrossroadsScreen'
import EventScreen from './camp/EventScreen'
import GrowthScreen from './camp/GrowthScreen'
import Hub from './camp/Hub'
import MarketPage from './camp/MarketPage'
import RuinsPage from './camp/RuinsPage'
import WarbandPage from './camp/WarbandPage'
import { CAMP_PAGES } from './camp/pages'
import type { CampPage } from './camp/pages'
import type { CampProps } from './camp/parts'

/**
 * Camp: a hub, three doors, and two takeovers.
 *
 * This was one 1200-line screen carrying the battle line, the roster, the
 * market, expeditions, events, growth picks and the march at once. Every one
 * of those arrived as its own milestone and got stacked onto the same page,
 * which is how a screen ends up asking the player to find the part that
 * matters rather than showing it to them.
 *
 * Three shapes, and which one a system gets is decided by what it demands:
 *
 *   takeover   required input, nothing else on screen and no way past it.
 *              Events and growth picks. This is the Slay the Spire / FTL
 *              pattern — one screen, one decision, no navigation offered.
 *   door       a system you enter and leave at your own pace. Warband,
 *              market, ruins.
 *   hub        the state of the run, what needs deciding, and the march.
 *
 * Tabs would not have fixed it. Tabs make things peers, and "answer this
 * before you can march" is not a peer of "look at the shop".
 *
 * What the takeovers deliberately do NOT do is invent a new visual language.
 * Banner Saga's UX post-mortem is blunt about that failure mode: inconsistent
 * frame styles across menus "create confusion rather than distinction". The
 * rows, buttons and type are identical everywhere; what changes is the ground
 * and what is allowed on it.
 */
export default function Camp(props: CampProps) {
  const [page, setPage] = useState<CampPage | null>(null)
  const { run } = props

  /*
   * Takeovers pre-empt everything, in the order the run produced them. There
   * is no navigation while one is up — that is the whole point of the shape.
   * The crossroads comes first: it has to resolve into a real event before
   * EventScreen has anything to show.
   */
  if (run.campOptions.length > 0) {
    return <CrossroadsScreen options={run.campOptions} onChoose={props.onChooseCampOption} />
  }

  if (run.event) {
    return (
      <EventScreen
        event={run.event}
        salvage={run.warband.salvage}
        onChoose={props.onResolveEvent}
      />
    )
  }

  if (run.growth.length > 0) {
    const offer = run.growth[0]
    const prospect = run.warband.prospects.find((p) => p.id === offer.prospectId)
    if (prospect) {
      return (
        <GrowthScreen
          offer={offer}
          prospect={prospect}
          remaining={run.growth.length}
          onChoose={props.onChooseMutation}
        />
      )
    }
  }

  if (page === null) return <Hub {...props} onOpen={setPage} />

  const meta = CAMP_PAGES.find((p) => p.id === page)!

  return (
    <div className={`camp camp-${page}`}>
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
