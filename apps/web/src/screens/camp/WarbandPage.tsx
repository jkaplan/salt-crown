import { useRef, useState } from 'react'
import {
  BIONICS_BY_ID,
  RELICS_BY_ID,
  MACHINE_RUN_COST,
  MAX_FIELDED_PROSPECTS,
  fieldedCount,
  fodderByType,
} from '@salt/game'
import UnitName from '../../components/UnitName'
import UnitShape from '../../components/UnitShape'
import {
  MachineRow,
  OfficerRow,
  ProspectRow,
  Section,
  SquadRow,
} from './parts'
import type { CampProps } from './parts'

/**
 * Everything you own, and the one decision about it that carries into battle.
 *
 * Ordering is at the top because it is the only thing here that changes what
 * happens next; the rest is a roster. Officers, Prospects and Machines share
 * this page rather than getting one each — they are three answers to the same
 * question ("who leads, and who is hurt"), and splitting them would make the
 * player visit three doors to find out who can fight.
 */
export default function WarbandPage({
  run,
  onAssign,
  onAppraise,
  onTreatWound,
  onTreatOfficer,
  onInstall,
  onAssignRelic,
  onSetFielded,
  onSell,
  onMoveSquad,
  onPlaceSquad,
}: CampProps) {
  const { warband } = run
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropAt, setDropAt] = useState<number | null>(null)
  const listRef = useRef<HTMLUListElement>(null)

  /**
   * Pointer events rather than HTML5 drag-and-drop, which does not fire at
   * all on touch — it would have been dead on a phone.
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

  const fodder = warband.squads.reduce((n, s) => n + s.count, 0)

  return (
    <div className="camp-page">
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
              salvage={warband.salvage}
              dragging={dragId === sq.id}
              insertBefore={dragId !== null && dropAt === i}
              onAssign={onAssign}
              onMoveSquad={onMoveSquad}
              onGripDown={onGripDown}
              onAssignRelic={onAssignRelic}
            />
          ))}
        </ul>
        {warband.squads.length === 0 && <p className="empty">No squads.</p>}
        <p className="note">Slower squads lead. Faster squads catch up from behind.</p>
      </Section>

      <Section title="Officers" meta={warband.officers.length || undefined}>
        <ul className="rows">
          {warband.officers.map((o) => (
            <OfficerRow
              key={o.id}
              officer={o}
              warband={warband}
              salvage={warband.salvage}
              onTreatOfficer={onTreatOfficer}
              onInstall={onInstall}
            />
          ))}
        </ul>
        {warband.officers.length === 0 && (
          <p className="empty">None. True Kin are hired, never bred — and never cheap.</p>
        )}
      </Section>

      {warband.machines.length > 0 && (
        <Section title="Machines" meta={`${MACHINE_RUN_COST} salvage each, every battle`}>
          <ul className="rows">
            {warband.machines.map((m) => (
              <MachineRow key={m.id} machine={m} salvage={warband.salvage} />
            ))}
          </ul>
          <p className="note">
            Nobody builds these. They arrive as good as they will ever be and wear out.
          </p>
        </Section>
      )}

      <Section title="Prospects" meta={warband.prospects.length || undefined}>
        <ul className="rows">
          {warband.prospects.map((p) => (
            <ProspectRow
              key={p.id}
              prospect={p}
              warband={warband}
              salvage={warband.salvage}
              onAppraise={onAppraise}
              onTreatWound={onTreatWound}
              onSetFielded={onSetFielded}
              onSell={onSell}
              fieldFull={fieldedCount(warband.prospects) >= MAX_FIELDED_PROSPECTS}
            />
          ))}
        </ul>
        {warband.prospects.length === 0 && (
          <p className="empty">
            None. Mutant batches throw up one or two standouts — the rest is fodder.
          </p>
        )}
      </Section>

      {/* Fodder is the only tier with no individual identity, so it gets a
          count and nothing else. */}
      <Section title="Infantry" meta={`${fodder} bodies`}>
        <ul className="rows tight">
          {fodderByType(warband).map((b) => (
            <li key={b.typeId} className="row inline">
              <UnitShape typeId={b.typeId} />
              <UnitName typeId={b.typeId} />
              <span className="row-pos">{b.count}</span>
            </li>
          ))}
        </ul>
      </Section>

      {warband.bionics.length > 0 && (
        <Section title="Salvaged implants" meta={warband.bionics.length}>
          <ul className="rows tight">
            {warband.bionics.map((id, i) => {
              const b = BIONICS_BY_ID.get(id)!
              return (
                <li key={`${id}-${i}`} className="row inline">
                  <span className="row-name">
                    <b className="truekin">{b.name}</b>
                    <span className="dim">{b.effect}</span>
                  </span>
                  <span className="row-pos">{b.cost}</span>
                </li>
              )
            })}
          </ul>
          <p className="note">
            {warband.officers.length === 0
              ? 'Nothing to fit them to. A mutant body cannot carry an implant.'
              : 'Fit them from an Officer above.'}
          </p>
        </Section>
      )}

      {warband.relics.length > 0 && (
        <Section title="Found relics" meta={warband.relics.length}>
          <ul className="rows tight">
            {warband.relics.map((id, i) => {
              const r = RELICS_BY_ID.get(id)!
              return (
                <li key={`${id}-${i}`} className="row inline">
                  <span className="row-name">
                    <b>{r.name}</b>
                    <span className="dim">{r.effect}</span>
                  </span>
                  <span className="row-pos">{r.cost}</span>
                </li>
              )
            })}
          </ul>
          <p className="note">Bind them from a squad in the battle line above.</p>
        </Section>
      )}
    </div>
  )
}
