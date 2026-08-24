import { useEffect, useRef, useState } from 'react'
import {
  ENCOUNTERS_PER_RUN,
  canBecomeFirstborn,
  capacityGrade,
  APPRAISAL_COST,
  isMaxed,
  MUTATIONS_BY_ID,
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
import type {
  GrowthOffer,
  Offer,
  Potential,
  RunState,
  Squad,
  SquadLeader,
  Warband,
} from '@salt/game'
import MutationTag from '../components/MutationTag'
import UnitName from '../components/UnitName'
import UnitShape from '../components/UnitShape'

/**
 * Returns a class name for one animation frame's worth of "this just moved".
 *
 * Salvage dropping when you buy is the clearest example: without it the number
 * simply is different next render, and the player has to remember the old one.
 */
function useJustChanged(value: number): string {
  const prev = useRef(value)
  const [flash, setFlash] = useState(false)
  useEffect(() => {
    if (prev.current === value) return
    prev.current = value
    setFlash(true)
    const t = setTimeout(() => setFlash(false), 900)
    return () => clearTimeout(t)
  }, [value])
  return flash ? ' just-changed' : ''
}

interface Props {
  run: RunState
  onBuy: (offerId: string) => void
  onAssign: (squadId: string, leader: SquadLeader | null) => void
  onChooseMutation: (potentialId: string, choiceIndex: number) => void
  onAppraise: (potentialId: string) => void
  onMoveSquad: (squadId: string, dir: -1 | 1) => void
  onPlaceSquad: (squadId: string, toIndex: number) => void
  onMarch: () => void
}

/**
 * Move speed decides who reaches the enemy first, so it is the stat the
 * battle-line order is actually about. Spelled out as a word next to the
 * number, because "3.4" only means something once you know the range.
 */
function pace(moveSpeed: number): { label: string; tone: string } {
  if (moveSpeed <= 3.2) return { label: 'slow', tone: 'pace-slow' }
  if (moveSpeed <= 5.5) return { label: 'steady', tone: 'pace-mid' }
  return { label: 'fast', tone: 'pace-fast' }
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
  dragging,
  insertBefore,
  onAssign,
  onMoveSquad,
  onGripDown,
}: {
  squad: Squad
  index: number
  total: number
  warband: Warband
  dragging: boolean
  insertBefore: boolean
  onAssign: Props['onAssign']
  onMoveSquad: Props['onMoveSquad']
  onGripDown: (e: React.PointerEvent, squadId: string) => void
}) {
  const officer = findOfficer(warband, squad)
  const potential = findLeadingPotential(warband, squad)
  const stats = resolveSquadStats(squad, officer, potential)

  const className = [
    'row',
    'squad-row',
    dragging ? 'dragging' : '',
    insertBefore ? 'insert-before' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <li className={className} data-squad-row>
      <div className="row-main">
        {/* Grip is both the drag handle and the keyboard control, so reordering
            works with a mouse, a finger, or arrow keys. */}
        <button
          className="grip"
          onPointerDown={(e) => onGripDown(e, squad.id)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp' && index > 0) {
              e.preventDefault()
              onMoveSquad(squad.id, -1)
            } else if (e.key === 'ArrowDown' && index < total - 1) {
              e.preventDefault()
              onMoveSquad(squad.id, 1)
            }
          }}
          aria-label={`Reorder ${unitType(squad.typeId).name}, position ${index + 1} of ${total}`}
        >
          ⠿
        </button>
        <UnitShape typeId={squad.typeId} />
        <span className="row-name">
          <UnitName typeId={squad.typeId} resolved={stats} />
          <span className="mult">×{squad.count}</span>
        </span>
        <span className={`pace ${pace(stats.moveSpeed).tone}`} title="Move speed">
          {stats.moveSpeed.toFixed(1)} {pace(stats.moveSpeed).label}
        </span>
        <span className="row-pos">{index + 1}</span>
      </div>
      <LeaderSelect squad={squad} warband={warband} onAssign={onAssign} />
    </li>
  )
}

/**
 * Capacity, shown as filled and empty slots.
 *
 * This is the stat that decides what a mutant is worth. Two bodies with the
 * same mutations today are worth completely different amounts if one has four
 * empty slots and the other is finished — so it gets a shape you can read at
 * a glance rather than a number in a list.
 */
function Capacity({ potential }: { potential: Potential }) {
  const filled = potential.mutations.length

  /*
   * An ungraded body must LOOK ungraded. If the slots were drawn from the
   * true capacity the shape would leak the answer, so unappraised stock shows
   * only what it already carries, plus an open question mark. That gap is the
   * entire market.
   */
  if (!potential.appraised) {
    return (
      <span
        className="capacity unknown"
        title="Ungraded. Nobody has read this body — it may be finished already, or it may hold six. An Assayer can tell you."
      >
        {Array.from({ length: filled }, (_, i) => (
          <i key={i} className="slot on" />
        ))}
        <i className="slot query">?</i>
        <span className="capacity-word">ungraded</span>
      </span>
    )
  }

  const maxed = isMaxed(potential)
  const legend = canBecomeFirstborn(potential)

  return (
    <span
      className={`capacity${maxed ? ' maxed' : ''}${legend ? ' legend' : ''}`}
      title={`Capacity ${potential.capacity} — ${capacityGrade(potential.capacity)}. ${
        maxed
          ? 'This body can hold no more.'
          : `${potential.capacity - filled} more mutation(s) possible.`
      }${legend ? ' Deep enough to become a Firstborn.' : ''}`}
    >
      {Array.from({ length: potential.capacity }, (_, i) => (
        <i key={i} className={i < filled ? 'slot on' : 'slot'} />
      ))}
      <span className="capacity-word">{maxed ? 'finished' : capacityGrade(potential.capacity)}</span>
    </span>
  )
}

function PotentialRow({
  potential,
  warband,
  salvage,
  onAppraise,
}: {
  potential: Potential
  warband: Warband
  salvage: number
  onAppraise: Props['onAppraise']
}) {
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
            <UnitName typeId={potential.typeId} resolved={stats} />
          </span>
        </span>
        <Capacity potential={potential} />
      </div>
      <div className="tags">
        {potential.mutations.map((m) => (
          <MutationTag key={m.id} roll={m} />
        ))}
      </div>
      <div className="row-note">
        {leading
          ? `Leading ${unitType(leading.typeId).name} ×${leading.count}`
          : 'Not leading — assign from a squad'}
      </div>
      {!potential.appraised && (
        <button
          className="btn-quiet assay"
          disabled={salvage < APPRAISAL_COST}
          onClick={() => onAppraise(potential.id)}
        >
          Have an Assayer read it <span className="price">{APPRAISAL_COST}</span>
        </button>
      )}
    </li>
  )
}

/**
 * Growth picks. The only place the player *directs* what the warband becomes,
 * rather than choosing among whatever the shop happened to roll — so it gets
 * its own prominent block rather than being buried in the roster.
 */
function GrowthCard({
  offer,
  potential,
  onChoose,
}: {
  offer: GrowthOffer
  potential: Potential
  onChoose: Props['onChooseMutation']
}) {
  const type = unitType(potential.typeId)
  const next = potential.mutations.length + 1

  return (
    <li className="row growth needs-you">
      <div className="row-main">
        <UnitShape typeId={potential.typeId} />
        <span className="row-name">
          <b className="potential-name">{potential.name}</b>
          <span className="dim">
            {type.name} · {potential.battles} battle{potential.battles === 1 ? '' : 's'} survived
          </span>
        </span>
        <span className="row-meta">
          mutation {next} of {potential.capacity}
        </span>
      </div>
      <div className="growth-choices">
        {offer.choices.map((choice, i) => {
          const def = MUTATIONS_BY_ID.get(choice.id)
          return (
            <button
              key={choice.id}
              className="growth-choice"
              onClick={() => onChoose(potential.id, i)}
            >
              <span className="gc-name">
                {def?.name} <b>{choice.level}</b>
              </span>
              <span className="gc-effect">{def?.describe(choice.level)}</span>
            </button>
          )
        })}
      </div>
      <div className="row-note">Permanent. Choose once.</div>
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
        {/* The whole row is the button. A small button inside a row is a
            needlessly small target and was easy to miss entirely. */}
        <button className="offer-hit" disabled={!afford} onClick={() => onBuy(offer.id)}>
          <span className="row-main">
            <span className="row-name">
              <b className="truekin">{officerTitle(offer.officer)}</b>
              <span className="dim">{rank?.effect}</span>
            </span>
            <span className="price-tag">{afford ? `Hire ${offer.cost}` : `${offer.cost}`}</span>
          </span>
        </button>
      </li>
    )
  }

  const stats = resolveSquadStats(
    { id: 'preview', typeId: offer.typeId, count: offer.count, leader: null },
    null,
  )

  return (
    <li className={`row offer${afford ? '' : ' poor'}`}>
      <button className="offer-hit" disabled={!afford} onClick={() => onBuy(offer.id)}>
        <span className="row-main">
          <UnitShape typeId={offer.typeId} />
          <span className="row-name">
            <UnitName typeId={offer.typeId} resolved={stats} />
            <span className="mult">×{offer.count}</span>
          </span>
          <span className="price-tag">{afford ? `Recruit ${offer.cost}` : `${offer.cost}`}</span>
        </span>
        {offer.potentials.length > 0 ? (
          <span className="standouts">
            {offer.potentials.map((p) => (
              <span key={p.id} className="standout">
                <b className="potential-name">{p.name}</b>
                <Capacity potential={p} />
                <span className="dim">
                  {p.mutations.map((m) => `${m.id} ${m.level}`).join(', ')}
                </span>
              </span>
            ))}
          </span>
        ) : (
          <span className="row-note">Bodies only — no standouts.</span>
        )}
      </button>
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

export default function Camp({
  run,
  onBuy,
  onAssign,
  onChooseMutation,
  onAppraise,
  onMoveSquad,
  onPlaceSquad,
  onMarch,
}: Props) {
  const { warband, encounter } = run
  const [tab, setTab] = useState<'warband' | 'recruit'>('warband')
  const [openInfantry, setOpenInfantry] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropAt, setDropAt] = useState<number | null>(null)
  const listRef = useRef<HTMLUListElement>(null)

  /**
   * Pointer events rather than HTML5 drag-and-drop. The previous version used
   * `draggable` + dataTransfer, which needed three reliability fixes and does
   * not fire at all on touch — it would have been dead on a phone.
   */
  const onGripDown = (e: React.PointerEvent, squadId: string) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragId(squadId)
    setDropAt(warband.squads.findIndex((s) => s.id === squadId))
  }

  const onGripMove = (e: React.PointerEvent) => {
    if (!dragId || !listRef.current) return
    const rows = Array.from(listRef.current.querySelectorAll('[data-squad-row]'))
    let target = rows.length
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i].getBoundingClientRect()
      if (e.clientY < r.top + r.height / 2) {
        target = i
        break
      }
    }
    if (target !== dropAt) setDropAt(target)
  }

  const onGripUp = () => {
    if (dragId && dropAt !== null) {
      const from = warband.squads.findIndex((s) => s.id === dragId)
      // Removing the dragged row first shifts every later slot down by one.
      const to = from < dropAt ? dropAt - 1 : dropAt
      if (from >= 0 && to !== from) onPlaceSquad(dragId, to)
    }
    setDragId(null)
    setDropAt(null)
  }
  const bodies = totalBodies(warband)
  const fodder = totalFodder(warband)
  const salvageFlash = useJustChanged(warband.salvage)
  const bodiesFlash = useJustChanged(bodies)
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
          <b className={'salvage' + salvageFlash}>{warband.salvage}</b> salvage
        </span>
        <span>
          <b className={bodiesFlash.trim()}>{bodies}</b> bodies
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
        <button className="btn-primary march" onClick={onMarch} disabled={bodies === 0}>
          March
        </button>
      </div>

      {run.growth.length > 0 && (
        <Section
          title="They have survived"
          meta={`${run.growth.length} ready to mutate`}
        >
          <ul className="rows">
            {run.growth.map((offer) => {
              const p = warband.potentials.find((x) => x.id === offer.potentialId)
              if (!p) return null
              return (
                <GrowthCard
                  key={offer.potentialId}
                  offer={offer}
                  potential={p}
                  onChoose={onChooseMutation}
                />
              )
            })}
          </ul>
        </Section>
      )}

      <nav className="tabs" role="tablist">
        {(['warband', 'recruit'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? 'tab on' : 'tab'}
            onClick={() => setTab(t)}
          >
            {t === 'warband' ? 'Warband' : 'Recruit'}
            <span className="tab-count">
              {t === 'warband' ? warband.squads.length : run.offers.length}
            </span>
          </button>
        ))}
      </nav>

      <div className="camp-body">
        <div className="camp-col" hidden={tab !== 'warband'}>
          <Section title="Battle line" meta="front → back">
            <ul
              className={dragId ? 'rows dragging-list' : 'rows'}
              ref={listRef}
              onPointerMove={onGripMove}
              onPointerUp={onGripUp}
              onPointerCancel={onGripUp}
            >
              {warband.squads.map((sq, i) => (
                <SquadRow
                  key={sq.id}
                  squad={sq}
                  index={i}
                  total={warband.squads.length}
                  warband={warband}
                  dragging={dragId === sq.id}
                  insertBefore={dragId !== null && dropAt === i}
                  onAssign={onAssign}
                  onMoveSquad={onMoveSquad}
                  onGripDown={onGripDown}
                />
              ))}
            </ul>
            {warband.squads.length === 0 && <p className="empty">No squads.</p>}
            <p className="note">Slower squads lead. Faster squads catch up from behind.</p>
            {idle > 0 && (
              <p className="note needs-you">
                {idle} leader{idle === 1 ? '' : 's'} leading nobody.
              </p>
            )}
          </Section>

          <Section title="Potentials" meta={warband.potentials.length || undefined}>
            <ul className="rows">
              {warband.potentials.map((p) => (
                <PotentialRow
                key={p.id}
                potential={p}
                warband={warband}
                salvage={warband.salvage}
                onAppraise={onAppraise}
              />
              ))}
            </ul>
            {warband.potentials.length === 0 && (
              <p className="empty">
                None. Mutant batches throw up one or two standouts — the rest is fodder.
              </p>
            )}
          </Section>
        </div>

        <div className="camp-col" hidden={tab !== 'recruit'}>
          <Section title="Recruit" meta={`${warband.salvage} salvage`}>
            <ul className="rows">
              {run.offers.map((o) => (
                <OfferRow key={o.id} offer={o} salvage={warband.salvage} onBuy={onBuy} />
              ))}
            </ul>
            {run.offers.length === 0 && <p className="empty">Nothing left on offer.</p>}
          </Section>

          <Section title="Infantry" meta={`${fodder} bodies`}>
            <button className="btn-quiet disclose" onClick={() => setOpenInfantry((v) => !v)}>
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
