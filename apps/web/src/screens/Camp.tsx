import { Fragment, type DragEvent, useState } from 'react'
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
import MutationTag from '../components/MutationTag'
import UnitName from '../components/UnitName'
import UnitShape from '../components/UnitShape'

interface Props {
  run: RunState
  onBuy: (offerId: string) => void
  onAssign: (squadId: string, leader: SquadLeader | null) => void
  onPlaceSquad: (squadId: string, toIndex: number) => void
  onMarch: () => void
}

function statLine(s: ReturnType<typeof resolveSquadStats>) {
  const bits = [
    `${s.hp.toFixed(0)} hp`,
    `${s.damage.toFixed(1)} dmg`,
    `${s.armor.toFixed(1)} arm`,
  ]
  if (s.range > 40) bits.push(`${s.range.toFixed(0)} range`)
  if (s.regen > 0) bits.push('regen')
  if (s.quills > 0) bits.push('quills')
  if (s.frenzy > 0) bits.push('frenzy')
  return bits.join(' · ')
}

function speedLane(moveSpeed: number): 'front' | 'middle' | 'back' {
  if (moveSpeed <= 2.2) return 'front'
  if (moveSpeed >= 3.2) return 'back'
  return 'middle'
}

function leaderKey(leader: SquadLeader | null): string {
  return leader ? `${leader.kind}:${leader.id}` : ''
}

function parseLeaderKey(key: string): SquadLeader | null {
  if (!key) return null
  const [kind, id] = key.split(':')
  return kind === 'officer' || kind === 'potential' ? { kind, id } : null
}

function leaderNote(squad: Squad, warband: Warband): string {
  const leader = squad.leader
  if (!leader) return 'No leader'
  if (leader.kind === 'officer') {
    const officer = warband.officers.find((o) => o.id === leader.id)
    return officer ? `Led by ${officerTitle(officer)}` : 'Led by an officer'
  }
  const potential = warband.potentials.find((p) => p.id === leader.id)
  return potential ? `Auto-led by ${potential.name}` : 'Auto-led by a Potential'
}

/**
 * A Potential: individually tracked, individually killable, worth caring
 * about — and, now, able to lead a squad of its own kind. Leading leaks its
 * mutations to the whole squad at half level, so a good roll is worth more
 * than one extra body.
 */
function PotentialCard({
  potential,
  warband,
  onAssign,
}: {
  potential: Potential
  warband: Warband
  onAssign: Props['onAssign']
}) {
  const type = unitType(potential.typeId)
  const stats = resolvePotentialStats(potential)
  const leading = warband.squads.find(
    (sq) => sq.leader?.kind === 'potential' && sq.leader.id === potential.id,
  )
  // A mutant does not command True Kin.
  const eligible = warband.squads.filter((sq) => unitType(sq.typeId).lineage === 'mutant')

  return (
    <li className="potential">
      <div className="squad-head">
        <span className="name potential-name">{potential.name}</span>
        <span className="count">
          <UnitShape typeId={potential.typeId} />
          <UnitName typeId={potential.typeId} />
        </span>
      </div>
      <div className="tags">
        {potential.mutations.map((m) => (
          <MutationTag key={m.id} roll={m} />
        ))}
      </div>
      <div className="statline">{statLine(stats)}</div>
      <div className="survived">
        {potential.battles === 0
          ? 'Untested'
          : `${potential.battles} battle${potential.battles === 1 ? '' : 's'} survived`}
        <span className="dim"> · {type.lineage === 'mutant' ? 'Potential' : 'True Kin'}</span>
      </div>
      {eligible.length > 0 && (
        <select
          value={leading ? leading.id : ''}
          onChange={(e) =>
            onAssign(
              e.target.value || leading?.id || '',
              e.target.value ? { kind: 'potential', id: potential.id } : null,
            )
          }
        >
          <option value="">— leading nobody —</option>
          {eligible.map((sq) => (
            <option key={sq.id} value={sq.id}>
              {unitType(sq.typeId).name} ×{sq.count}
            </option>
          ))}
        </select>
      )}
    </li>
  )
}

function OfferCard({
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
      <li className={`offer officer ${afford ? '' : 'poor'}`}>
        <div className="offer-head">
          <span className="name truekin">{officerTitle(offer.officer)}</span>
          <span className="cost">{offer.cost}</span>
        </div>
        <div className="statline">{rank?.effect}</div>
        <p className="blurb">{rank?.blurb}</p>
        <button disabled={!afford} onClick={() => onBuy(offer.id)}>
          Hire
        </button>
      </li>
    )
  }

  const stats = resolveSquadStats(
    { id: 'x', typeId: offer.typeId, count: offer.count, leader: null },
    null,
  )

  return (
    <li className={`offer ${afford ? '' : 'poor'}`}>
      <div className="offer-head">
        <span className="name">
            <UnitShape typeId={offer.typeId} />
          <UnitName typeId={offer.typeId} /> ×{offer.count}
        </span>
        <span className="cost">{offer.cost}</span>
      </div>
      <div className="statline">{statLine(stats)}</div>
      <div className="quick-breakdown">
        <span className="pill">SPD {stats.moveSpeed.toFixed(1)}</span>
        <span className="pill">RNG {stats.range.toFixed(0)}</span>
        <span className="pill">HP {stats.hp.toFixed(0)}</span>
      </div>

      {offer.potentials.length > 0 ? (
        <div className="offer-potentials">
          <div className="op-head">
            {offer.potentials.length === 1 ? 'One standout' : 'Two standouts'} in the batch
          </div>
          {offer.potentials.map((p) => (
            <div key={p.id} className="op-row">
              <span className="potential-name">{p.name}</span>
              <span className="tags">
                {p.mutations.map((m) => (
                  <MutationTag key={m.id} roll={m} hot />
                ))}
              </span>
            </div>
          ))}
          <div className="op-note">This batch will start with a Potential leading it.</div>
        </div>
      ) : (
        <p className="op-none">No standouts. Bodies only. No squad leader included.</p>
      )}

      <button disabled={!afford} onClick={() => onBuy(offer.id)}>
        Recruit
      </button>
    </li>
  )
}

function SquadLeaderSelect({
  squad,
  warband,
  onAssign,
}: {
  squad: Squad
  warband: Warband
  onAssign: Props['onAssign']
}) {
  const options: { key: string; label: string }[] = [
    { key: '', label: '— no leader —' },
    ...warband.officers.map((o) => ({ key: `officer:${o.id}`, label: officerTitle(o) })),
  ]
  if (unitType(squad.typeId).lineage === 'mutant') {
    for (const p of warband.potentials) {
      options.push({ key: `potential:${p.id}`, label: `${p.name} (leak mutations)` })
    }
  }

  return (
    <select
      value={leaderKey(squad.leader)}
      onChange={(e) => onAssign(squad.id, parseLeaderKey(e.target.value))}
    >
      {options.map((o) => (
        <option key={o.key} value={o.key}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export default function Camp({ run, onBuy, onAssign, onPlaceSquad, onMarch }: Props) {
  const { warband, encounter } = run
  const [openInfantry, setOpenInfantry] = useState(false)
  const [dragSquadId, setDragSquadId] = useState<string | null>(null)
  const [dropSlot, setDropSlot] = useState<number | null>(null)
  const bodies = totalBodies(warband)
  const fodder = totalFodder(warband)
  const breakdown = fodderByType(warband)
  const leadingSquads = warband.squads.filter((s) => s.leader)
  const idleLeaders =
    warband.officers.length +
    warband.potentials.length -
    leadingSquads.length

  const onDragStartSquad = (event: DragEvent<HTMLLIElement>, squadId: string) => {
    setDragSquadId(squadId)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', squadId)
  }

  const onDragOverSlot = (event: DragEvent<HTMLLIElement>, slot: number) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    if (dropSlot !== slot) setDropSlot(slot)
  }

  const onDropSlot = (event: DragEvent<HTMLLIElement>, slot: number) => {
    event.preventDefault()
    const payload = event.dataTransfer.getData('text/plain')
    if (!dragSquadId && !payload) return
    if (!dragSquadId && payload) setDragSquadId(payload)
    commitDrop(slot)
  }

  const commitDrop = (slot: number) => {
    if (!dragSquadId) return
    const from = warband.squads.findIndex((sq) => sq.id === dragSquadId)
    if (from < 0) return
    let to = slot
    if (from < to) to -= 1
    if (to !== from) onPlaceSquad(dragSquadId, to)
    setDragSquadId(null)
    setDropSlot(null)
  }

  return (
    <div className="camp">
      <div className="camp-bar">
        <div>
          <span className="label">Encounter</span>{' '}
          <b>
            {run.encounterIndex + 1} / {ENCOUNTERS_PER_RUN}
          </b>
        </div>
        <div>
          <span className="label">Salvage</span> <b className="salvage">{warband.salvage}</b>
        </div>
        <div>
          <span className="label">Bodies</span> <b>{bodies}</b>
        </div>
        <div>
          <span className="label">Potentials</span>{' '}
          <b className="potential-name">{warband.potentials.length}</b>
        </div>
      </div>

      <div className="camp-hero">
        <div className="hero-card hero-primary">
          <span className="hero-label">Ready to march</span>
          <strong>{encounter.name}</strong>
          <span>{encounter.flavour}</span>
        </div>
        <div className="hero-card">
          <span className="hero-label">Warband</span>
          <strong>{bodies}</strong>
          <span>{warband.squads.length} squads · {warband.potentials.length} potentials</span>
        </div>
        <div className="hero-card">
          <span className="hero-label">Salvage</span>
          <strong className="salvage">{warband.salvage}</strong>
          <span>{encounter.reward} if you win</span>
        </div>
        <button className="march hero-march" onClick={onMarch} disabled={bodies === 0}>
          March
        </button>
      </div>

      <div className="camp-cols">
        <section className="col">
          <h2>Squads</h2>
          <p className="hint ordering-hint">Ordering tip: slower squads up front, faster squads in back.</p>
          <ul className="squads squad-order-list">
            {warband.squads.map((sq, index) => {
              const officer = findOfficer(warband, sq)
              const leadingPotential = findLeadingPotential(warband, sq)
              const stats = resolveSquadStats(sq, officer, leadingPotential)
              const lane = speedLane(stats.moveSpeed)

              return (
              <Fragment key={sq.id}>
                <li
                  className={dropSlot === index ? 'drop-slot active' : 'drop-slot'}
                  onDragOver={(e) => onDragOverSlot(e, index)}
                  onDrop={(e) => onDropSlot(e, index)}
                />
              <li
                className={dragSquadId === sq.id ? 'squad dragging' : 'squad'}
                draggable
                onDragStart={(e) => onDragStartSquad(e, sq.id)}
                onDragOver={(e) => onDragOverSlot(e, index)}
                onDrop={(e) => onDropSlot(e, index)}
                onDragEnd={() => {
                  setDragSquadId(null)
                  setDropSlot(null)
                }}
              >
                <div className="squad-head">
                  <span className="name">
                    <UnitShape typeId={sq.typeId} />
                    <UnitName typeId={sq.typeId} />
                  </span>
                  <span className="count">×{sq.count}</span>
                </div>
                <div className="squad-order-controls">
                  <span className="order-label">Line {index + 1}</span>
                  <span className="drag-hint">{lane === 'front' ? 'Frontline pace' : lane === 'back' ? 'Backline pace' : 'Midline pace'} · drag to reorder</span>
                </div>
                <div className="quick-breakdown">
                  <span className="pill">SPD {stats.moveSpeed.toFixed(1)}</span>
                  <span className="pill">RNG {stats.range.toFixed(0)}</span>
                  <span className="pill">HP {stats.hp.toFixed(0)}</span>
                  <span className="pill">ARM {stats.armor.toFixed(1)}</span>
                </div>
                <div className={`lead-chip ${sq.leader ? 'active' : 'inactive'}`}>
                  {leaderNote(sq, warband)}
                </div>
                <SquadLeaderSelect squad={sq} warband={warband} onAssign={onAssign} />
              </li>
              </Fragment>
              )
            })}
            <li
              className={dropSlot === warband.squads.length ? 'drop-slot active' : 'drop-slot'}
              onDragOver={(e) => onDragOverSlot(e, warband.squads.length)}
              onDrop={(e) => onDropSlot(e, warband.squads.length)}
            />
            {warband.squads.length === 0 && <p className="hint">No squads.</p>}
          </ul>
          {idleLeaders > 0 && (
            <p className="hint">
              {idleLeaders} leader{idleLeaders === 1 ? '' : 's'} leading nobody. A leader with no
              squad does nothing.
            </p>
          )}

          <h2 className="spaced">Infantry</h2>
          <div className="infantry" onClick={() => setOpenInfantry((v) => !v)}>
            <div className="inf-head">
              <span className="inf-count">{fodder}</span>
              <span className="label">bodies, no mutations</span>
              <span className="chev">{openInfantry ? '−' : '+'}</span>
            </div>
            {openInfantry && (
              <ul className="inf-breakdown">
                {breakdown.map((b) => (
                  <li key={b.typeId}>
                    <UnitName typeId={b.typeId} />
                    <span className="count">{b.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="col operations-col">
          <h2>Potentials</h2>
          <ul className="squads compact-list">
            {warband.potentials.map((p) => (
              <PotentialCard key={p.id} potential={p} warband={warband} onAssign={onAssign} />
            ))}
            {warband.potentials.length === 0 && (
              <p className="hint">
                None. Mutant batches throw up one or two standouts — everything else is fodder.
              </p>
            )}
          </ul>

          <h2 className="spaced">Recruit</h2>
          <ul className="offers">
            {run.offers.map((o) => (
              <OfferCard key={o.id} offer={o} salvage={warband.salvage} onBuy={onBuy} />
            ))}
            {run.offers.length === 0 && <p className="hint">Nothing left on offer.</p>}
          </ul>

          <h2 className="spaced">Next</h2>
          <div className="encounter compact-encounter">
            <p className="blurb">{encounter.flavour}</p>
            <dl>
              <dt>Enemy bodies</dt>
              <dd>{encounter.bodies}</dd>
              <dt>Your bodies</dt>
              <dd>{bodies}</dd>
              <dt>Salvage if you win</dt>
              <dd className="salvage">{encounter.reward}</dd>
            </dl>
            <p className="hint">
              Battles are fought to the finish and losing ends the run. A bleeding squad hits
              softer — mutants collapse fast, True Kin hold together.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
