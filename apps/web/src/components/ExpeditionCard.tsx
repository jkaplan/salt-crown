import { useState } from 'react'
import {
  MAX_CREW,
  expectedHaul,
  expeditionCost,
  expeditionRisk,
  isFirstborn,
  unitType,
} from '@salt/game'
import type { Expedition, ExpeditionResult, Prospect, Verb } from '@salt/game'

/**
 * Expeditions — docs/V0-DESIGN.md §9.
 *
 * The screen has to make one thing obvious, because it is the whole decision:
 * the crew misses the next battle. Everything else — the haul, the injury
 * odds — is secondary to "these people will not be there".
 *
 * So the crew picker says what each body is currently doing, and picking
 * someone who is leading a squad says so in red. Sending a leading Prospect
 * pulls its mutations off twenty fighters, and that is a far bigger cost than
 * the 18% injury roll the player is looking at.
 */
interface Props {
  prospects: Prospect[]
  salvage: number
  encounterIndex: number
  expedition: Expedition | null
  result: ExpeditionResult | null
  leadingIds: Set<string>
  onSend: (verb: Verb, crew: string[]) => void
  onRecall: () => void
}

/*
 * Both verbs are outfitted with salvage. What separates them is what comes
 * back, and that is the sentence the player needs: a warband capped by Water
 * ends up with salvage it cannot spend, and scavenging is how that gets
 * turned into bodies it can actually carry.
 */
const VERBS: { id: Verb; label: string; blurb: string }[] = [
  {
    id: 'scavenge',
    label: 'Scavenge',
    blurb: 'Surface cisterns and caches. Buys water with salvage. Almost always safe.',
  },
  {
    id: 'delve',
    label: 'Delve',
    blurb: 'Down into a ruin, for salvage and whatever is left down there. People die.',
  },
]

function pct(n: number): string {
  return `${Math.round(n * 100)}%`
}

export default function ExpeditionCard({
  prospects,
  salvage,
  encounterIndex,
  expedition,
  result,
  leadingIds,
  onSend,
  onRecall,
}: Props) {
  const [verb, setVerb] = useState<Verb>('scavenge')
  const [crew, setCrew] = useState<string[]>([])

  /* Out already: show who, and offer to call it off before the march. */
  if (expedition) {
    const away = prospects.filter((p) => expedition.crew.includes(p.id))
    return (
      <div className="expedition out">
        <div className="exp-head">
          <h3>{expedition.verb === 'delve' ? 'Delving' : 'Scavenging'}</h3>
          <span className="dim">back at the next camp</span>
        </div>
        <p className="row-note">
          {away.map((p) => p.name).join(', ')} — not on the field for this one.
        </p>
        <button className="btn-quiet" onClick={onRecall}>
          Call them back
        </button>
      </div>
    )
  }

  // Every Prospect can go, leaders included. Excluding them would remove the
  // decision this screen exists for.
  const available = prospects
  const toggle = (id: string) =>
    setCrew((c) =>
      c.includes(id) ? c.filter((x) => x !== id) : c.length < MAX_CREW ? [...c, id] : c,
    )

  const haul = expectedHaul(verb, crew.length, encounterIndex)
  const cost = expeditionCost(verb, crew.length, encounterIndex)
  const risk = expeditionRisk(verb)
  const leadersGoing = crew.filter((id) => leadingIds.has(id)).length
  const tooPoor = cost > salvage

  return (
    <div className="expedition">
      {/* What the last crew brought back, above the next decision. */}
      {result && (
        <div className="exp-result">
          <p className="exp-flavour">{result.flavour}</p>
          <p className="exp-haul">
            {/* Read as a return, which is the only way the number means
                anything — 180 salvage is a triumph or a disaster depending
                entirely on what it cost to go. */}
            <span className="dim">{result.staked} out · </span>
            {result.salvage > 0 && (
              <>
                <b className="salvage">+{result.salvage}</b> salvage{' '}
              </>
            )}
            <b className="water">+{result.water}</b> water
            {result.found.length > 0 && (
              <>
                {' · '}
                <b className="prospect-name">
                  {result.found.map((p) => p.name).join(', ')}
                </b>{' '}
                came back with them
              </>
            )}
          </p>
          {(result.injured.length > 0 || result.lost.length > 0) && (
            <p className="exp-cost">
              {result.lost.length > 0 && (
                <span className="dead">
                  {result.lost.join(', ')} did not come back.{' '}
                </span>
              )}
              {result.injured.length > 0 && <span>{result.injured.join(', ')} came back hurt.</span>}
            </p>
          )}
        </div>
      )}

      <div className="exp-head">
        <h3>Send a crew</h3>
        <span className="dim">they miss the next battle</span>
      </div>

      <div className="exp-verbs">
        {VERBS.map((v) => (
          <button
            key={v.id}
            className={verb === v.id ? 'exp-verb on' : 'exp-verb'}
            onClick={() => setVerb(v.id)}
          >
            <span className="ec-label">{v.label}</span>
            <span className="ec-detail">{v.blurb}</span>
          </button>
        ))}
      </div>

      {available.length === 0 ? (
        <p className="empty">No Prospects to send. Fodder cannot be trusted to come back.</p>
      ) : (
        <ul className="exp-crew">
          {available.map((p) => {
            const picked = crew.includes(p.id)
            const leading = leadingIds.has(p.id)
            return (
              <li key={p.id}>
                <button
                  className={picked ? 'exp-pick on' : 'exp-pick'}
                  onClick={() => toggle(p.id)}
                  disabled={!picked && crew.length >= MAX_CREW}
                >
                  <span className="row-name">
                    <b className={isFirstborn(p) ? 'prospect-name firstborn' : 'prospect-name'}>
                      {p.name}
                    </b>
                    <span className="dim">{unitType(p.typeId).name}</span>
                  </span>
                  {/* The real cost, stated where it is being incurred. */}
                  {leading && <span className="exp-leading">leading a squad</span>}
                  {p.wound && <span className="wound">already hurt</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {crew.length > 0 && (
        <>
          <p className="exp-odds">
            <b className="salvage">{cost}</b> salvage to outfit them, back with about{' '}
            {haul.salvage > 0 && (
              <>
                <b className="salvage">{haul.salvage}</b> salvage and{' '}
              </>
            )}
            <b className="water">{haul.water}</b> water · {pct(risk.injury)} hurt
            {risk.death > 0 && (
              <>
                {' · '}
                <span className="dead">{pct(risk.death)} lost</span>
              </>
            )}{' '}
            <span className="dim">each</span>
          </p>
          {leadersGoing > 0 && (
            <p className="exp-warn">
              {leadersGoing === 1 ? 'One of them leads a squad' : `${leadersGoing} of them lead squads`}
              . That squad fights without their mutations.
            </p>
          )}
        </>
      )}

      {tooPoor && crew.length > 0 && (
        <p className="exp-warn">Not enough salvage to outfit them.</p>
      )}

      <button
        className="btn-quiet exp-send"
        disabled={crew.length === 0 || tooPoor}
        onClick={() => {
          onSend(verb, crew)
          setCrew([])
        }}
      >
        Send {crew.length > 0 ? `${crew.length}` : ''}
      </button>
    </div>
  )
}
