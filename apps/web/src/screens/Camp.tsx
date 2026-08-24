import { useEffect, useRef, useState } from 'react'
import {
  ENCOUNTERS_PER_RUN,
  canBecomeFirstborn,
  capacityGrade,
  APPRAISAL_COST,
  isMaxed,
  isFirstborn,
  fieldedCount,
  sellValue,
  MAX_FIELDED_PROSPECTS,
  moraleWord,
  payWater,
  waterUpkeep,
  waterState,
  MUTATIONS_BY_ID,
  OFFICER_RANKS_BY_ID,
  findLeadingProspect,
  findOfficer,
  fodderByType,
  officerBonusMultiplier,
  officerTitle,
  resolveProspectStats,
  resolveSquadStats,
  totalBodies,
  totalFodder,
  unitType,
  TREAT_COST,
  WOUND_RUNG_NAMES,
  WOUND_ZONE_NAMES,
} from '@salt/game'
import type {
  GrowthOffer,
  Officer,
  Offer,
  Prospect,
  RunState,
  Squad,
  SquadLeader,
  Verb,
  Warband,
  Wound,
} from '@salt/game'
import ExpeditionCard from '../components/ExpeditionCard'
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
  onChooseMutation: (prospectId: string, choiceIndex: number) => void
  onResolveEvent: (choiceIndex: number) => void
  onAppraise: (prospectId: string) => void
  onTreatWound: (prospectId: string) => void
  onTreatOfficer: (officerId: string) => void
  onSetFielded: (prospectId: string, fielded: boolean) => void
  onSell: (prospectId: string) => void
  onSendExpedition: (verb: Verb, crew: string[]) => void
  onRecallExpedition: () => void
  onMoveSquad: (squadId: string, dir: -1 | 1) => void
  onPlaceSquad: (squadId: string, toIndex: number) => void
  onMarch: () => void
}

/** Morale reads as a word, never a decimal — 0.04 means nothing to anyone. */
function moraleTone(m: number): string {
  if (m <= -0.03) return 'dead'
  if (m >= 0.03) return 'held'
  return ''
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
  return kind === 'officer' || kind === 'prospect' ? { kind, id } : null
}

/**
 * The single place leadership is assigned. It used to be settable from both
 * the squad and the Prospect, two controls mutating one relationship from
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
        warband.prospects
          .filter((p) => !taken.has(`prospect:${p.id}`))
          .map((p) => (
            <option key={p.id} value={`prospect:${p.id}`}>
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
  const prospect = findLeadingProspect(warband, squad)
  const stats = resolveSquadStats(squad, officer, prospect)

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
function Capacity({ prospect }: { prospect: Prospect }) {
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
function WoundTag({ wound, note }: { wound: Wound; note: string }) {
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
function OfficerRow({
  officer,
  warband,
  salvage,
  onTreatOfficer,
}: {
  officer: Officer
  warband: Warband
  salvage: number
  onTreatOfficer: Props['onTreatOfficer']
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

function ProspectRow({
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
  onAppraise: Props['onAppraise']
  onTreatWound: Props['onTreatWound']
  onSetFielded: Props['onSetFielded']
  onSell: Props['onSell']
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
function GrowthCard({
  offer,
  prospect,
  onChoose,
}: {
  offer: GrowthOffer
  prospect: Prospect
  onChoose: Props['onChooseMutation']
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

const TABS = [
  { id: 'line', label: 'Line' },
  { id: 'roster', label: 'Roster' },
  { id: 'recruit', label: 'Recruit' },
  { id: 'ruins', label: 'Ruins' },
] as const

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
  onResolveEvent,
  onAppraise,
  onTreatWound,
  onTreatOfficer,
  onSetFielded,
  onSell,
  onSendExpedition,
  onRecallExpedition,
  onMoveSquad,
  onPlaceSquad,
  onMarch,
}: Props) {
  const { warband, encounter } = run
  /*
   * Three tabs, each answering one question.
   *
   *   Line     what order do they walk in — the only pre-battle decision
   *   Roster   who do I actually have, and who is hurt
   *   Recruit  who could I have
   *
   * "Warband" and "Roster" would have meant the same thing, so the ordering
   * tab is named for what it is. Prospects moved out of it and in with the
   * Officers, because those two are one question — the named tier — and they
   * were split across a tab and a dropdown.
   */
  const [tab, setTab] = useState<'line' | 'roster' | 'recruit' | 'ruins'>('line')
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
  const upkeep = waterUpkeep(warband)
  const cistern = waterState(warband.water, upkeep)
  /*
   * Desertion is decided by payWater at the moment of the march. Camp runs
   * the same function against the same warband so the number shown here is
   * the number who actually leave — a warning that guesses is worse than no
   * warning, because the player would plan against it.
   */
  const willDesert = payWater(warband).deserted
  const salvageFlash = useJustChanged(warband.salvage)
  const waterFlash = useJustChanged(warband.water)
  const bodiesFlash = useJustChanged(bodies)
  const idle =
    warband.officers.length +
    warband.prospects.length -
    warband.squads.filter((s) => s.leader).length

  /*
   * A wound is invisible from anywhere but the Roster, and an untreated one
   * quietly costs you the whole battle it shows up in — so the tab carries a
   * mark rather than waiting to be discovered.
   */
  const leadingIds = new Set(
    warband.squads
      .filter((sq) => sq.leader?.kind === 'prospect')
      .map((sq) => sq.leader!.id),
  )

  const hurt =
    warband.officers.filter((o) => o.wound).length +
    warband.prospects.filter((p) => p.wound).length

  const counts: Record<(typeof TABS)[number]['id'], number> = {
    line: warband.squads.length,
    roster: warband.officers.length + warband.prospects.length,
    recruit: run.offers.length,
    ruins: run.expedition ? run.expedition.crew.length : 0,
  }

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
        {/*
          Water never appears without the bill next to it. A cistern number on
          its own is unreadable — 240 is comfortable at thirty bodies and a
          crisis at ninety, and the player cannot know which without the
          upkeep beside it.
        */}
        <span
          className={`water-cell ${cistern}`}
          title={`Every march costs water, scaled superlinearly by roster size. ${upkeep} for the ${bodies} you are carrying. Short, and the thirsty walk.`}
        >
          <b className={'water' + waterFlash}>{warband.water}</b> water
          <i>/{upkeep} a march</i>
        </span>
        <span>
          <b className="prospect-name">{fieldedCount(warband.prospects)}</b>
          <i>/{MAX_FIELDED_PROSPECTS}</i> fielded
        </span>
        <span title="Shifted by what you decide between battles. Every squad fights a little better or worse for it.">
          <b className={moraleTone(warband.morale)}>{moraleWord(warband.morale)}</b> column
        </span>
      </div>

      <div className="march-card">
        <div className="march-text">
          <h1>{encounter.name}</h1>
          <p>{encounter.flavour}</p>
          <p className="march-facts">
            <b>{encounter.bodies}</b> enemy bodies · <b className="salvage">{encounter.reward}</b>{' '}
            salvage and <b className="water">{encounter.waterReward}</b> water if you win · losing
            ends the run
          </p>
          {/*
            Named, not implied. "You are short on water" is a status; "nine
            will walk before the fight" is a decision, and the player can still
            sell a squad or a Prospect to stop it.
          */}
          {willDesert > 0 && (
            <p className="march-warning">
              The cistern will not cover it. <b>{willDesert}</b>{' '}
              {willDesert === 1 ? 'body walks' : 'bodies walk'} before the fight.
            </p>
          )}
        </div>
        <button
          className="btn-primary march"
          onClick={onMarch}
          disabled={bodies === 0 || run.event !== null}
          title={run.event ? 'Answer the column first.' : undefined}
        >
          March
        </button>
      </div>

      {/*
        The event blocks the march. A choice you can walk past is not a choice,
        and morale only means something if the thing that moves it has weight.
      */}
      {run.event && (
        <div className="event">
          <h2 className="event-title">{run.event.title}</h2>
          <p className="event-body">{run.event.body}</p>
          <div className="event-choices">
            {run.event.choices.map((choice, i) => {
              const blocked = choice.requires !== undefined && warband.salvage < choice.requires
              return (
                <button
                  key={choice.label}
                  className="event-choice"
                  disabled={blocked}
                  onClick={() => onResolveEvent(i)}
                >
                  <span className="ec-label">{choice.label}</span>
                  <span className="ec-detail">{choice.detail}</span>
                  <span className="ec-cost">
                    {choice.salvage ? (
                      <span className={choice.salvage > 0 ? 'salvage' : 'dead'}>
                        {choice.salvage > 0 ? '+' : ''}
                        {choice.salvage} salvage
                      </span>
                    ) : null}
                    {choice.morale ? (
                      <span className={choice.morale > 0 ? 'held' : 'dead'}>
                        {choice.morale > 0 ? 'steadies' : 'shakes'} the column
                      </span>
                    ) : null}
                    {blocked && <span className="dim">cannot afford</span>}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/*
        The rarest thing in a run. About 2% of Prospects have the capacity to
        get here at all, and getting there takes ten battles alive — so it is
        announced rather than left to be noticed as a changed title in a list.
      */}
      {run.promoted.length > 0 && (
        <div className="promotion">
          {run.promoted.map((id) => {
            const p = warband.prospects.find((x) => x.id === id)
            if (!p) return null
            return (
              <div key={id} className="promotion-line">
                <span className="promotion-word">Firstborn</span>
                <b className="prospect-name">{p.name}</b>
                <span className="dim">
                  came back from {p.battles} battles and stopped being stock. Their mutations
                  now reach the whole squad at full strength.
                </span>
              </div>
            )
          })}
        </div>
      )}

      {run.growth.length > 0 && (
        <Section
          title="They have survived"
          meta={`${run.growth.length} ready to mutate`}
        >
          <ul className="rows">
            {run.growth.map((offer) => {
              const p = warband.prospects.find((x) => x.id === offer.prospectId)
              if (!p) return null
              return (
                <GrowthCard
                  key={offer.prospectId}
                  offer={offer}
                  prospect={p}
                  onChoose={onChooseMutation}
                />
              )
            })}
          </ul>
        </Section>
      )}

      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? 'tab on' : 'tab'}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            <span className="tab-count">{counts[t.id]}</span>
            {/* Wounds are the one thing worth pulling you into a tab you were
                not going to open. */}
            {t.id === 'roster' && hurt > 0 && (
              <span className="tab-alert" title={`${hurt} wounded`}>
                ✚
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="camp-body">
        <div className="camp-col" hidden={tab !== 'line'}>
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
        </div>

        <div className="camp-col" hidden={tab !== 'roster'}>
          <Section title="Officers" meta={warband.officers.length || undefined}>
            <ul className="rows">
              {warband.officers.map((o) => (
                <OfficerRow
                  key={o.id}
                  officer={o}
                  warband={warband}
                  salvage={warband.salvage}
                  onTreatOfficer={onTreatOfficer}
                />
              ))}
            </ul>
            {warband.officers.length === 0 && (
              <p className="empty">None. True Kin are hired, never bred — and never cheap.</p>
            )}
          </Section>

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
              count and nothing else — and it belongs with the rest of what you
              own rather than next to what is for sale. */}
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

        <div className="camp-col" hidden={tab !== 'ruins'}>
          <Section title="Ruins" meta="the crew misses the next battle">
            <ExpeditionCard
              prospects={warband.prospects}
              salvage={warband.salvage}
              encounterIndex={run.encounterIndex}
              expedition={run.expedition}
              result={run.expeditionResult}
              leadingIds={leadingIds}
              onSend={onSendExpedition}
              onRecall={onRecallExpedition}
            />
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
        </div>
      </div>
    </div>
  )
}
