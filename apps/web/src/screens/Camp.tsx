import { useState } from 'react'
import {
  ENCOUNTERS_PER_RUN,
  OFFICER_RANKS_BY_ID,
  findLeadingPotential,
  findOfficer,
  fodderByType,
  officerTitle,
  resolvePotentialStats,
  resolveSquadStats,
  totalBodies,
  totalFodder,
  unitType,
} from '@salt/game'
import type { Offer, Potential, RunState, Squad, SquadLeader, Warband } from '@salt/game'
import type { ResolvedStats } from '@salt/sim'
import MutationTag from '../components/MutationTag'
import UnitName from '../components/UnitName'
import UnitShape from '../components/UnitShape'

interface Props {
  run: RunState
  onBuy: (offerId: string) => void
  onAssign: (squadId: string, leader: SquadLeader | null) => void
  onMoveSquad: (squadId: string, dir: -1 | 1) => void
  onMarch: () => void
}

/**
 * Stat pills. Four numbers, always the same four, always in the same order —
 * so they can be compared down a column instead of read as prose.
 */
function Stats({ s }: { s: ResolvedStats }) {
  return (
    <div className="stats">
      <span title="Hit points">
        <b>{s.hp.toFixed(0)}</b> hp
      </span>
      <span title="Damage per hit">
        <b>{s.damage.toFixed(0)}</b> dmg
      </span>
      <span title="Flat damage reduction per hit">
        <b>{s.armor.toFixed(0)}</b> arm
      </span>
      <span title={s.range > 40 ? 'Attack range' : 'Melee'}>
        {s.range > 40 ? (
          <>
            <b>{s.range.toFixed(0)}</b> rng
          </>
        ) : (
          'melee'
        )}
      </span>
      {s.regen > 0 && <span className="trait">regen</span>}
      {s.quills > 0 && <span className="trait">quills</span>}
      {s.frenzy > 0 && <span className="trait">frenzy</span>}
    </div>
  )
}

function leaderKey(leader: SquadLeader | null): string {
  return leader ? `${leader.kind}:${leader.id}` : ''
}

function parseLeaderKey(key: string): SquadLeader | null {
  if (!key) return null
  const [kind, id] = key.split(':')
  return kind === 'officer' || kind === 'potential' ? { kind, id } : null
}

/**
 * The single place leadership is assigned. It used to be settable from both
 * the squad and the Potential, two controls mutating one relationship from
 * opposite ends — which is confusing and lets them disagree.
 */
function LeaderSelect({
  squad,
  warband,
  onAssign,
}: {
  squad: Squad
  warband: Warband
  onAssign: Props['onAssign']
}) {
  const isMutant = unitType(squad.typeId).lineage === 'mutant'
  const taken = new Set(
    warband.squads.filter((s) => s.id !== squad.id && s.leader).map((s) => leaderKey(s.leader)),
  )

  return (
    <select
      className="leader-select"
      value={leaderKey(squad.leader)}
      onChange={(e) => onAssign(squad.id, parseLeaderKey(e.target.value))}
      aria-label="Squad leader"
    >
      <option value="">No leader</option>
      {warband.officers
        .filter((o) => !taken.has(`officer:${o.id}`))
        .map((o) => (
          <option key={o.id} value={`officer:${o.id}`}>
            {officerTitle(o)}
          </option>
        ))}
      {/* A mutant does not command True Kin. */}
      {isMutant &&
        warband.potentials
          .filter((p) => !taken.has(`potential:${p.id}`))
          .map((p) => (
            <option key={p.id} value={`potential:${p.id}`}>
              {p.name} — leaks mutations
            </option>
          ))}
    </select>
  )
}

function SquadRow({
  squad,
  index,
  total,
  warband,
  onAssign,
  onMoveSquad,
}: {
  squad: Squad
  index: number
  total: number
  warband: Warband
  onAssign: Props['onAssign']
  onMoveSquad: Props['onMoveSquad']
}) {
  const officer = findOfficer(warband, squad)
  const potential = findLeadingPotential(warband, squad)
  const stats = resolveSquadStats(squad, officer, potential)

  return (
    <li className="row squad-row">
      <div className="row-main">
        <UnitShape typeId={squad.typeId} />
        <span className="row-name">
          <UnitName typeId={squad.typeId} />
          <span className="mult">×{squad.count}</span>
        </span>
        <span className="row-pos">{index + 1}</span>
        <span className="reorder">
          <button
            onClick={() => onMoveSquad(squad.id, -1)}
            disabled={index === 0}
            aria-label="Move forward"
          >
            ↑
          </button>
          <button
            onClick={() => onMoveSquad(squad.id, 1)}
            disabled={index === total - 1}
            aria-label="Move back"
          >
            ↓
          </button>
        </span>
      </div>
      <Stats s={stats} />
      <LeaderSelect squad={squad} warband={warband} onAssign={onAssign} />
    </li>
  )
}

function PotentialRow({ potential, warband }: { potential: Potential; warband: Warband }) {
  const stats = resolvePotentialStats(potential)
  const leading = warband.squads.find(
    (sq) => sq.leader?.kind === 'potential' && sq.leader.id === potential.id,
  )

  return (
    <li className="row">
      <div className="row-main">
        <UnitShape typeId={potential.typeId} />
        <span className="row-name">
          <b className="potential-name">{potential.name}</b>
          <span className="dim">
            <UnitName typeId={potential.typeId} />
          </span>
        </span>
        <span className="row-meta">
          {potential.battles === 0 ? 'untested' : `${potential.battles} survived`}
        </span>
      </div>
      <div className="tags">
        {potential.mutations.map((m) => (
          <MutationTag key={m.id} roll={m} />
        ))}
      </div>
      <Stats s={stats} />
      <div className="row-note">
        {leading
          ? `Leading ${unitType(leading.typeId).name} ×${leading.count}`
          : 'Not leading — assign from a squad'}
      </div>
    </li>
  )
}

function OfferRow({
  offer,
  salvage,
  onBuy,
}: {
  offer: Offer
  salvage: number
  onBuy: Props['onBuy']
}) {
  const afford = offer.cost <= salvage

  if (offer.kind === 'officer') {
    const rank = OFFICER_RANKS_BY_ID.get(offer.officer.rankId)
    return (
      <li className={`row offer${afford ? '' : ' poor'}`}>
        <div className="row-main">
          <span className="row-name">
            <b className="truekin">{officerTitle(offer.officer)}</b>
            <span className="dim">{rank?.effect}</span>
          </span>
          <button className="buy" disabled={!afford} onClick={() => onBuy(offer.id)}>
            {offer.cost}
          </button>
        </div>
      </li>
    )
  }

  const stats = resolveSquadStats(
    { id: 'preview', typeId: offer.typeId, count: offer.count, leader: null },
    null,
  )

  return (
    <li className={`row offer${afford ? '' : ' poor'}`}>
      <div className="row-main">
        <UnitShape typeId={offer.typeId} />
        <span className="row-name">
          <UnitName typeId={offer.typeId} />
          <span className="mult">×{offer.count}</span>
        </span>
        <button className="buy" disabled={!afford} onClick={() => onBuy(offer.id)}>
          {offer.cost}
        </button>
      </div>
      <Stats s={stats} />
      {offer.potentials.length > 0 ? (
        <div className="standouts">
          {offer.potentials.map((p) => (
            <div key={p.id} className="standout">
              <b className="potential-name">{p.name}</b>
              <span className="tags">
                {p.mutations.map((m) => (
                  <MutationTag key={m.id} roll={m} hot />
                ))}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="row-note">Bodies only — no standouts.</div>
      )}
    </li>
  )
}

function Section({
  title,
  meta,
  children,
}: {
  title: string
  meta?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="section">
      <h2>
        {title}
        {meta && <span className="section-meta">{meta}</span>}
      </h2>
      {children}
    </section>
  )
}

export default function Camp({ run, onBuy, onAssign, onMoveSquad, onMarch }: Props) {
  const { warband, encounter } = run
  const [openInfantry, setOpenInfantry] = useState(false)
  const bodies = totalBodies(warband)
  const fodder = totalFodder(warband)
  const idle =
    warband.officers.length +
    warband.potentials.length -
    warband.squads.filter((s) => s.leader).length

  return (
    <div className="camp">
      {/* Every number appears exactly once, here. */}
      <div className="status">
        <span>
          <b>{run.encounterIndex + 1}</b>
          <i>/{ENCOUNTERS_PER_RUN}</i> encounter
        </span>
        <span>
          <b className="salvage">{warband.salvage}</b> salvage
        </span>
        <span>
          <b>{bodies}</b> bodies
        </span>
        <span>
          <b className="potential-name">{warband.potentials.length}</b> potentials
        </span>
      </div>

      <div className="march-card">
        <div className="march-text">
          <h1>{encounter.name}</h1>
          <p>{encounter.flavour}</p>
          <p className="march-facts">
            <b>{encounter.bodies}</b> enemy bodies · <b className="salvage">{encounter.reward}</b>{' '}
            salvage if you win · losing ends the run
          </p>
        </div>
        <button className="march" onClick={onMarch} disabled={bodies === 0}>
          March
        </button>
      </div>

      <div className="camp-body">
        <div className="camp-col">
          <Section title="Battle line" meta="front → back">
            <ul className="rows">
              {warband.squads.map((sq, i) => (
                <SquadRow
                  key={sq.id}
                  squad={sq}
                  index={i}
                  total={warband.squads.length}
                  warband={warband}
                  onAssign={onAssign}
                  onMoveSquad={onMoveSquad}
                />
              ))}
            </ul>
            {warband.squads.length === 0 && <p className="empty">No squads.</p>}
            <p className="note">Slower squads lead. Faster squads catch up from behind.</p>
            {idle > 0 && (
              <p className="note warn">
                {idle} leader{idle === 1 ? '' : 's'} leading nobody.
              </p>
            )}
          </Section>

          <Section title="Potentials" meta={warband.potentials.length || undefined}>
            <ul className="rows">
              {warband.potentials.map((p) => (
                <PotentialRow key={p.id} potential={p} warband={warband} />
              ))}
            </ul>
            {warband.potentials.length === 0 && (
              <p className="empty">
                None. Mutant batches throw up one or two standouts — the rest is fodder.
              </p>
            )}
          </Section>
        </div>

        <div className="camp-col">
          <Section title="Recruit" meta={`${warband.salvage} salvage`}>
            <ul className="rows">
              {run.offers.map((o) => (
                <OfferRow key={o.id} offer={o} salvage={warband.salvage} onBuy={onBuy} />
              ))}
            </ul>
            {run.offers.length === 0 && <p className="empty">Nothing left on offer.</p>}
          </Section>

          <Section title="Infantry" meta={`${fodder} bodies`}>
            <button className="disclose" onClick={() => setOpenInfantry((v) => !v)}>
              {openInfantry ? 'Hide' : 'Show'} breakdown
            </button>
            {openInfantry && (
              <ul className="rows tight">
                {fodderByType(warband).map((b) => (
                  <li key={b.typeId} className="row inline">
                    <UnitShape typeId={b.typeId} />
                    <UnitName typeId={b.typeId} />
                    <span className="row-pos">{b.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  )
}
