/**
 * The pieces every camp page is built from.
 *
 * Camp used to be one 1200-line screen carrying seven systems at once: the
 * battle line, the roster, the market, expeditions, events, growth picks and
 * the march. Splitting it into a hub and three places to go left these rows
 * shared between them, so they live here rather than being imported across
 * sibling screens.
 */
import { useEffect, useRef, useState } from 'react'
import {
  canBecomeFirstborn,
  capacityGrade,
  APPRAISAL_COST,
  isMaxed,
  isFirstborn,
  sellValue,
  MAX_FIELDED_PROSPECTS,
  BIONICS_BY_ID,
  BIONIC_SLOTS,
  RELICS_BY_ID,
  MACHINE_CONDITION_MAX,
  MACHINE_RUN_COST,
  conditionWord,
  resolveMachineStats,
  MUTATIONS_BY_ID,
  OFFICER_RANKS_BY_ID,
  findLeadingProspect,
  findOfficer,
  officerBonusMultiplier,
  officerTitle,
  resolveProspectStats,
  resolveSquadStats,
  unitType,
  TREAT_COST,
  WOUND_RUNG_NAMES,
  WOUND_ZONE_NAMES,
  describeInjury,
} from '@salt/game'
import InjuryIcon from '../../components/InjuryIcon'
import type {
  GrowthOffer,
  Officer,
  Offer,
  Prospect,
  RunState,
  Squad,
  SquadLeader,
  Machine,
  Verb,
  Warband,
  Wound,
} from '@salt/game'
import MutationTag from '../../components/MutationTag'
import UnitName from '../../components/UnitName'
import UnitShape from '../../components/UnitShape'

/**
 * Returns a class name for one animation frame's worth of "this just moved".
 *
 * Salvage dropping when you buy is the clearest example: without it the number
 * simply is different next render, and the player has to remember the old one.
 */
export function useJustChanged(value: number): string {
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

export interface CampProps {
  run: RunState
  onBuy: (offerId: string) => void
  onAssign: (squadId: string, leader: SquadLeader | null) => void
  onChooseMutation: (prospectId: string, choiceIndex: number) => void
  onResolveEvent: (choiceIndex: number) => void
  onAppraise: (prospectId: string) => void
  onTreatWound: (prospectId: string) => void
  onTreatOfficer: (officerId: string) => void
  onInstall: (officerId: string, bionicId: string) => void
  onAssignRelic: (squadId: string, relicId: string) => void
  onSetFielded: (prospectId: string, fielded: boolean) => void
  onSell: (prospectId: string) => void
  onSendExpedition: (verb: Verb, crew: string[]) => void
  onRecallExpedition: () => void
  onMoveSquad: (squadId: string, dir: -1 | 1) => void
  onPlaceSquad: (squadId: string, toIndex: number) => void
  onMarch: () => void
}

/** Morale reads as a word, never a decimal — 0.04 means nothing to anyone. */
export function moraleTone(m: number): string {
  if (m <= -0.03) return 'dead'
  if (m >= 0.03) return 'held'
  return ''
}

/**
 * Move speed decides who reaches the enemy first, so it is the stat the
 * battle-line order is actually about. Spelled out as a word next to the
 * number, because "3.4" only means something once you know the range.
 */
export function pace(moveSpeed: number): { label: string; tone: string } {
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
  return kind === 'officer' || kind === 'prospect' ? { kind, id } : null
}

/**
 * The single place leadership is assigned. It used to be settable from both
 * the squad and the Prospect, two controls mutating one relationship from
 * opposite ends — which is confusing and lets them disagree.
 */
export function LeaderSelect({
  squad,
  warband,
  onAssign,
}: {
  squad: Squad
  warband: Warband
  onAssign: CampProps['onAssign']
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
        warband.prospects
          .filter((p) => !taken.has(`prospect:${p.id}`))
          .map((p) => (
            <option key={p.id} value={`prospect:${p.id}`}>
              {p.name} — steadies the squad
            </option>
          ))}
    </select>
  )
}

export function SquadRow({
  squad,
  index,
  total,
  warband,
  salvage,
  dragging,
  insertBefore,
  onAssign,
  onMoveSquad,
  onGripDown,
  onAssignRelic,
}: {
  squad: Squad
  index: number
  total: number
  warband: Warband
  salvage: number
  dragging: boolean
  insertBefore: boolean
  onAssign: CampProps['onAssign']
  onMoveSquad: CampProps['onMoveSquad']
  onGripDown: (e: React.PointerEvent, squadId: string) => void
  onAssignRelic: CampProps['onAssignRelic']
}) {
  const officer = findOfficer(warband, squad)
  const prospect = findLeadingProspect(warband, squad)
  const stats = resolveSquadStats(squad, officer, prospect)
  const relic = squad.relicId ? RELICS_BY_ID.get(squad.relicId) : null
  // Only what is actually in stock, same reasoning as an Officer's bionic
  // picker — the row is a decision, never a wishlist.
  const relicStock = [...new Set(warband.relics)]

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
      {/*
        A relic is the squad's own, independent of who leads it — carried,
        not biological (docs/ROADMAP.md's post-M4 note). One per squad, so a
        second find is a decision about which OTHER squad gets it, not an
        upgrade to this one.
      */}
      {relic ? (
        <div className="relics">
          <span className="relic" title={relic.blurb}>
            {relic.name} <i>{relic.effect}</i>
          </span>
        </div>
      ) : (
        relicStock.length > 0 && (
          <div className="row-actions">
            {relicStock.map((id) => {
              const r = RELICS_BY_ID.get(id)!
              return (
                <button
                  key={id}
                  className="btn-quiet install relic-bind"
                  disabled={salvage < r.cost}
                  title={`${r.effect}. ${r.blurb}`}
                  onClick={() => onAssignRelic(squad.id, id)}
                >
                  Bind {r.name} <span className="price">{r.cost}</span>
                </button>
              )
            })}
          </div>
        )
      )}
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
export function Capacity({ prospect }: { prospect: Prospect }) {
  const filled = prospect.mutations.length

  /*
   * An ungraded body must LOOK ungraded. If the slots were drawn from the
   * true capacity the shape would leak the answer, so unappraised stock shows
   * only what it already carries, plus an open question mark. That gap is the
   * entire market.
   */
  if (!prospect.appraised) {
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

  const maxed = isMaxed(prospect)
  const legend = canBecomeFirstborn(prospect)

  return (
    <span
      className={`capacity${maxed ? ' maxed' : ''}${legend ? ' legend' : ''}`}
      title={`Capacity ${prospect.capacity} — ${capacityGrade(prospect.capacity)}. ${
        maxed
          ? 'This body can hold no more.'
          : `${prospect.capacity - filled} more mutation(s) possible.`
      }${legend ? ' Deep enough to become a Firstborn.' : ''}`}
    >
      {Array.from({ length: prospect.capacity }, (_, i) => (
        <i key={i} className={i < filled ? 'slot on' : 'slot'} />
      ))}
      <span className="capacity-word">{maxed ? 'finished' : capacityGrade(prospect.capacity)}</span>
    </span>
  )
}

/**
 * A wound, shown the same way wherever it appears.
 *
 * Both named tiers can carry one, and a wound is the single most urgent thing
 * a roster can tell you — so it reads identically on an Officer and on a
 * Prospect rather than being restyled per row type.
 */
export function WoundTag({ wound, note }: { wound: Wound; note: string }) {
  return (
    <span className="wound" title={note}>
      {WOUND_RUNG_NAMES[wound.rung]} · {WOUND_ZONE_NAMES[wound.zone]}
    </span>
  )
}

/**
 * An Officer, finally visible.
 *
 * Until now the only place an Officer appeared was inside a squad's leader
 * dropdown — so the player could not see what they had hired, what it was
 * doing, or that it had been hurt. Officers take wounds in resolveBattle and
 * that quietly scaled down every bonus they granted, invisibly.
 */
export function OfficerRow({
  officer,
  warband,
  salvage,
  onTreatOfficer,
  onInstall,
}: {
  officer: Officer
  warband: Warband
  salvage: number
  onTreatOfficer: CampProps['onTreatOfficer']
  onInstall: CampProps['onInstall']
}) {
  const rank = OFFICER_RANKS_BY_ID.get(officer.rankId)
  const leading = warband.squads.find(
    (sq) => sq.leader?.kind === 'officer' && sq.leader.id === officer.id,
  )
  const wound = officer.wound
  // An Officer has no body, so a wound scales the whole bonus instead of
  // hitting a zone. Say so as a percentage — "Injured · Arms" alone does not
  // explain why the squad got worse.
  const kept = Math.round(officerBonusMultiplier(wound) * 100)
  // One entry per distinct implant in stock that this officer does not carry.
  const stock = [...new Set(warband.bionics)].filter((id) => !officer.bionics.includes(id))

  return (
    <li className="row">
      <div className="row-main">
        <span className="row-name">
          <b className="truekin">{officerTitle(officer)}</b>
          <span className="dim">{rank?.effect}</span>
        </span>
        {wound && (
          <WoundTag
            wound={wound}
            note={`Wounded — this Officer grants only ${kept}% of its normal bonus until it heals.`}
          />
        )}
      </div>
      <div className="row-note">
        {leading ? (
          <>
            Leading {unitType(leading.typeId).name} ×{leading.count}
            {wound && <span className="dead"> · bonus at {kept}%</span>}
          </>
        ) : (
          'Leading nobody — assign from the battle line'
        )}
      </div>
      {/*
        The build, as slots. Bionics are the True Kin answer to a Prospect's
        mutation list, so they read the same way — what this leader is
        carrying, at a glance, in the row that leader lives in.
      */}
      <div className="slots">
        {Array.from({ length: BIONIC_SLOTS }, (_, i) => {
          const b = officer.bionics[i] ? BIONICS_BY_ID.get(officer.bionics[i]) : null
          return b ? (
            <span key={i} className="bionic" title={b.blurb}>
              {b.name} <i>{b.effect}</i>
            </span>
          ) : (
            <span key={i} className="bionic empty">
              empty socket
            </span>
          )
        })}
      </div>

      {/* Only what is actually in stock, so the list is never a wishlist. */}
      {officer.bionics.length < BIONIC_SLOTS && stock.length > 0 && (
        <div className="row-actions">
          {stock.map((id) => {
            const b = BIONICS_BY_ID.get(id)!
            return (
              <button
                key={id}
                className="btn-quiet install"
                disabled={salvage < b.cost}
                title={`${b.effect}. ${b.blurb}`}
                onClick={() => onInstall(officer.id, id)}
              >
                Fit {b.name} <span className="price">{b.cost}</span>
              </button>
            )
          })}
        </div>
      )}

      {wound && (
        <button
          className="btn-quiet treat"
          disabled={salvage < TREAT_COST}
          onClick={() => onTreatOfficer(officer.id)}
        >
          Treat — {WOUND_RUNG_NAMES[wound.rung]} heals one rung{' '}
          <span className="price">{TREAT_COST}</span>
        </button>
      )}
    </li>
  )
}

/**
 * A machine, and the only number that matters about one.
 *
 * No mutations, no bionics, no wound ladder — condition is the whole story,
 * and it only ever goes down. Shown as a track rather than a word alone so the
 * player can see how many battles are left in it, which is the decision:
 * spend it now, or hold it for something worse.
 */
export function MachineRow({ machine, salvage }: { machine: Machine; salvage: number }) {
  const type = unitType(machine.typeId)
  const stats = resolveMachineStats(machine)
  const cold = salvage < MACHINE_RUN_COST

  return (
    <li className={cold ? 'row machine cold' : 'row machine'}>
      <div className="row-main">
        <UnitShape typeId={machine.typeId} />
        <span className="row-name">
          <b className="machine-name">{machine.name}</b>
          <span className="dim">{type.name}</span>
        </span>
        <span
          className={`condition c-${conditionWord(machine.condition).replace(/ /g, '-')}`}
          title="Machines only degrade. One step of condition per battle fought — a machine left cold keeps what it has. Only a Tinkerer can put any back."
        >
          {Array.from({ length: MACHINE_CONDITION_MAX }, (_, i) => (
            <i key={i} className={i < machine.condition ? 'notch on' : 'notch'} />
          ))}
          <span className="condition-word">{conditionWord(machine.condition)}</span>
        </span>
      </div>
      <div className="row-note">
        {machine.condition} battle{machine.condition === 1 ? '' : 's'} left in it ·{' '}
        {stats.damage.toFixed(0)} damage · {stats.armor.toFixed(1)} armour ·{' '}
        {stats.hp.toFixed(0)} HP
      </div>
      <div className={cold ? 'row-note dead' : 'row-note'}>
        {cold
          ? `Cold — ${MACHINE_RUN_COST} salvage to run it, and there is not enough.`
          : `${MACHINE_RUN_COST} salvage to run, every battle.`}
      </div>
    </li>
  )
}

export function ProspectRow({
  prospect,
  warband,
  salvage,
  onAppraise,
  onTreatWound,
  onSetFielded,
  onSell,
  fieldFull,
}: {
  prospect: Prospect
  warband: Warband
  salvage: number
  onAppraise: CampProps['onAppraise']
  onTreatWound: CampProps['onTreatWound']
  onSetFielded: CampProps['onSetFielded']
  onSell: CampProps['onSell']
  fieldFull: boolean
}) {
  const stats = resolveProspectStats(prospect)
  const leading = warband.squads.find(
    (sq) => sq.leader?.kind === 'prospect' && sq.leader.id === prospect.id,
  )
  const wound = prospect.wound

  return (
    <li className={prospect.fielded ? 'row' : 'row held'}>
      <div className="row-main">
        <UnitShape typeId={prospect.typeId} />
        <span className="row-name">
          <b className={isFirstborn(prospect) ? 'prospect-name firstborn' : 'prospect-name'}>
            {prospect.name}
          </b>
          {/* A Firstborn is no longer described by the stock it came from. */}
          {isFirstborn(prospect) ? (
            <span className="firstborn-tag">Firstborn</span>
          ) : (
            <span className="dim">
              <UnitName typeId={prospect.typeId} resolved={stats} />
            </span>
          )}
        </span>
        {wound && (
          <WoundTag
            wound={wound}
            note={`${WOUND_ZONE_NAMES[wound.zone]} — costs ${TREAT_COST} salvage per rung to treat`}
          />
        )}
        {prospect.permanentInjuries.length > 0 && (
          <span className="injuries" title={prospect.permanentInjuries.map(describeInjury).join(' · ')}>
            {prospect.permanentInjuries.map((inj, i) => (
              <InjuryIcon key={i} kind={inj.harmKind} />
            ))}
          </span>
        )}
        {prospect.dismemberments.length > 0 && (
          <span
            className="dismemberments"
            title={`Personally maimed: ${prospect.dismemberments.map((d) => d.victim).join(', ')}`}
          >
            {prospect.dismemberments.length} dismembered
          </span>
        )}
        <Capacity prospect={prospect} />
      </div>
      <div className="tags">
        {prospect.mutations.map((m) => (
          <MutationTag key={m.id} roll={m} />
        ))}
      </div>
      <div className="row-note">
        {leading
          ? `Leading ${unitType(leading.typeId).name} ×${leading.count}`
          : 'Not leading — assign from a squad'}
      </div>
      {!prospect.appraised && (
        <button
          className="btn-quiet assay"
          disabled={salvage < APPRAISAL_COST}
          onClick={() => onAppraise(prospect.id)}
        >
          Have an Assayer read it <span className="price">{APPRAISAL_COST}</span>
        </button>
      )}
      {wound && (
        <button
          className="btn-quiet treat"
          disabled={salvage < TREAT_COST}
          onClick={() => onTreatWound(prospect.id)}
        >
          Treat — {WOUND_RUNG_NAMES[wound.rung]} heals one rung <span className="price">{TREAT_COST}</span>
        </button>
      )}
      <div className="row-actions">
        {/* Bench a wounded body to let it recover; hold a graded one to sell. */}
        <button
          className="btn-quiet"
          disabled={!prospect.fielded && fieldFull}
          title={
            prospect.fielded
              ? 'Hold in reserve. It will not fight, take wounds, or gain battles.'
              : fieldFull
                ? `Already fielding ${MAX_FIELDED_PROSPECTS}. Bench someone first.`
                : 'Bring it to the next battle.'
          }
          onClick={() => onSetFielded(prospect.id, !prospect.fielded)}
        >
          {prospect.fielded ? 'Hold back' : 'Field'}
        </button>
        <button
          className="btn-quiet sell"
          title={
            prospect.appraised
              ? 'Sell at its graded value.'
              : 'Ungraded stock sells at the going rate for an average body, whatever it is really worth.'
          }
          onClick={() => onSell(prospect.id)}
        >
          Sell <span className="price">{sellValue(prospect, unitType(prospect.typeId).cost)}</span>
        </button>
      </div>
    </li>
  )
}

/**
 * Growth picks. The only place the player *directs* what the warband becomes,
 * rather than choosing among whatever the shop happened to roll — so it gets
 * its own prominent block rather than being buried in the roster.
 */
export function GrowthCard({
  offer,
  prospect,
  onChoose,
}: {
  offer: GrowthOffer
  prospect: Prospect
  onChoose: CampProps['onChooseMutation']
}) {
  const type = unitType(prospect.typeId)
  const next = prospect.mutations.length + 1

  return (
    <li className="row growth needs-you">
      <div className="row-main">
        <UnitShape typeId={prospect.typeId} />
        <span className="row-name">
          <b className="prospect-name">{prospect.name}</b>
          <span className="dim">
            {type.name} · {prospect.battles} battle{prospect.battles === 1 ? '' : 's'} survived
          </span>
        </span>
        <span className="row-meta">
          mutation {next} of {prospect.capacity}
        </span>
      </div>
      <div className="growth-choices">
        {offer.choices.map((choice, i) => {
          const def = MUTATIONS_BY_ID.get(choice.id)
          return (
            <button
              key={choice.id}
              className="growth-choice"
              onClick={() => onChoose(prospect.id, i)}
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

export function OfferRow({
  offer,
  salvage,
  onBuy,
}: {
  offer: Offer
  salvage: number
  onBuy: CampProps['onBuy']
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
        {offer.prospects.length > 0 ? (
          <span className="standouts">
            {offer.prospects.map((p) => (
              <span key={p.id} className="standout">
                <b className="prospect-name">{p.name}</b>
                <Capacity prospect={p} />
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

export function Section({
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

