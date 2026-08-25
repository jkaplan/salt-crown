import {
  ENCOUNTERS_PER_RUN,
  MACHINE_RUN_COST,
  MAX_FIELDED_PROSPECTS,
  fieldedCount,
  moraleWord,
  payWater,
  scoutEnemy,
  waterState,
  waterUpkeep,
} from '@salt/game'
import { moraleTone, useJustChanged } from './parts'
import type { CampProps } from './parts'
import type { CampPage } from './pages'
import { CAMP_PAGES } from './pages'

/**
 * Camp, as a hub rather than a page.
 *
 * The old screen stacked seven systems and asked the player to find the one
 * that mattered. This one holds exactly two kinds of thing:
 *
 *   what needs deciding   events, growth picks, a promotion, a shortfall —
 *                         resolved here, because they block or expire
 *   where you can go      the warband, the market, the ruins
 *
 * Everything you merely BROWSE lives behind a door. The march is the primary
 * action and it is the last thing on the page, so the order of the screen is
 * the order of the turn: deal with what is waiting, go where you need to go,
 * then leave.
 */
interface Props extends CampProps {
  onOpen: (page: CampPage) => void
}

export default function Hub({
  run,
  onMarch,
  onOpen,
}: Props) {
  const { warband, encounter } = run

  const bodies = warband.squads.reduce((n, s) => n + s.count, 0) + warband.prospects.length
  const upkeep = waterUpkeep(warband)
  const cistern = waterState(warband.water, upkeep)
  const willDesert = payWater(warband).deserted
  const machineBill = warband.machines.length * MACHINE_RUN_COST
  const scouting = scoutEnemy(encounter.enemy)
  const coldCount = Math.max(
    0,
    warband.machines.length - Math.floor(warband.salvage / MACHINE_RUN_COST),
  )

  const salvageFlash = useJustChanged(warband.salvage)
  const waterFlash = useJustChanged(warband.water)
  const bodiesFlash = useJustChanged(bodies)

  const idleLeaders =
    warband.officers.length +
    warband.prospects.length -
    warband.squads.filter((s) => s.leader).length
  const wounded =
    warband.officers.filter((o) => o.wound).length +
    warband.prospects.filter((p) => p.wound).length

  /*
   * The attention list. Only real, actionable state — a hub that always has
   * something on it teaches the player to stop reading it.
   */
  const notes: { text: string; page?: CampPage; urgent?: boolean }[] = []
  if (willDesert > 0) {
    notes.push({
      text: `${willDesert} will walk before the fight — the cistern will not cover the march`,
      page: 'warband',
      urgent: true,
    })
  }
  if (coldCount > 0) {
    notes.push({
      text: `${coldCount} machine${coldCount === 1 ? '' : 's'} cannot be run and will stay cold`,
      page: 'warband',
      urgent: true,
    })
  }
  if (wounded > 0) {
    notes.push({ text: `${wounded} wounded, untreated`, page: 'warband' })
  }
  if (idleLeaders > 0) {
    notes.push({
      text: `${idleLeaders} leader${idleLeaders === 1 ? '' : 's'} leading nobody`,
      page: 'warband',
    })
  }
  if (warband.bionics.length > 0 && warband.officers.length > 0) {
    notes.push({ text: `${warband.bionics.length} implant(s) not fitted`, page: 'warband' })
  }
  if (!run.expedition) {
    notes.push({ text: 'No crew out', page: 'ruins' })
  }

  const counts: Record<CampPage, number> = {
    warband: warband.squads.length,
    market: run.offers.length,
    ruins: run.expedition ? run.expedition.crew.length : 0,
  }

  return (
    <div className="camp hub">
      {/* Every number appears exactly once, here. */}
      <div className="status">
        <span>
          <b>{run.encounterIndex + 1}</b>
          <i>/{ENCOUNTERS_PER_RUN}</i> encounter
        </span>
        <span>
          <b className={'salvage' + salvageFlash}>{warband.salvage}</b> salvage
        </span>
        <span
          className={`water-cell ${cistern}`}
          title={`Every march costs water, scaled superlinearly by roster size. ${upkeep} for the ${bodies} you are carrying.`}
        >
          <b className={'water' + waterFlash}>{warband.water}</b> water
          <i>/{upkeep} a march</i>
        </span>
        <span>
          <b className={bodiesFlash.trim()}>{bodies}</b> bodies
        </span>
        <span>
          <b className="prospect-name">{fieldedCount(warband.prospects)}</b>
          <i>/{MAX_FIELDED_PROSPECTS}</i> fielded
        </span>
        <span title="Shifted by what you decide between battles.">
          <b className={moraleTone(warband.morale)}>{moraleWord(warband.morale)}</b> column
        </span>
      </div>

      {/* The rarest thing in a run. Announced, not left to be noticed. */}
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

      {/* Where you can go. Three doors, each one system. */}
      <nav className="doors">
        {CAMP_PAGES.map((d) => (
          <button key={d.id} className="door" onClick={() => onOpen(d.id)}>
            <span className="door-name">{d.label}</span>
            <span className="door-count">{counts[d.id]}</span>
            <span className="door-blurb">{d.blurb}</span>
          </button>
        ))}
      </nav>

      {notes.length > 0 && (
        <ul className="notes">
          {notes.map((n) => (
            <li key={n.text} className={n.urgent ? 'note-urgent' : undefined}>
              {n.page ? (
                <button className="btn-quiet" onClick={() => onOpen(n.page!)}>
                  {n.text}
                </button>
              ) : (
                <span>{n.text}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className={`march-card kind-${encounter.kind}`}>
        <div className="march-text">
          <p className="march-kind">
            Act {encounter.act + 1}
            {encounter.kind === 'boss' && <b className="boss-word">— it is waiting</b>}
            {encounter.kind === 'wasteland' && <span className="dim"> — not a warband</span>}
            {/*
              Distinct from both. A boss is dreaded because it's coming; a
              legendary is dreaded because it wasn't supposed to be here —
              most runs never see one at all, so the word itself has to
              carry that this is rare before the player reads anything else.
            */}
            {encounter.kind === 'legendary' && (
              <b className="legendary-word">— this one has a name</b>
            )}
          </p>
          <h1>{encounter.name}</h1>
          <p>{encounter.flavour}</p>
          {/*
            Requested directly: "it does feel like I'm a bit lost going into
            a battle." Only body count was shown before this — armour is the
            single most impactful, least visible stat in the whole game (see
            postmortem.ts), and a warband can be nearly worthless against the
            wrong opponent no matter its size. Skipped for boss/legendary:
            both are always pure mutant by construction, so mixWord would be
            the same uninformative line every time, and their own name and
            flavour already say what they are.
          */}
          {(encounter.kind === 'warband' || encounter.kind === 'wasteland') && (
            <p className="march-facts scouting">
              {scouting.mixWord}, {scouting.armorWord}
              {scouting.led && ', led by an officer'}
            </p>
          )}
          <p className="march-facts">
            <b>{encounter.bodies}</b> enemy bodies · <b className="salvage">{encounter.reward}</b>{' '}
            salvage and <b className="water">{encounter.waterReward}</b> water if you win · losing
            ends the run
          </p>
          {machineBill > 0 && (
            <p className="march-facts">
              <b className="salvage">{machineBill}</b> salvage to run{' '}
              {warband.machines.length === 1 ? 'the machine' : `${warband.machines.length} machines`}
            </p>
          )}
        </div>
        <button
          className="btn-primary march"
          onClick={onMarch}
          disabled={bodies === 0}
        >
          March
        </button>
      </div>
    </div>
  )
}

