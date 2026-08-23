import type { BattleSetup, RunState, SquadLeader } from '@salt/game'
import {
  findOfficer,
  officerTitle,
  potentialTitle,
  resolvePotentialStats,
  resolveSquadStats,
  squadLabel,
  unitType,
} from '@salt/game'
import { TEAM_A } from '@salt/sim'
import type { ViewStats } from '../BattleView'

interface Props {
  run: RunState
  setup: BattleSetup | null
  liveStats: ViewStats | null
}

interface HealthSnapshot {
  current: number
  max: number
}

interface HealthBarProps {
  current: number
  max: number
  tone?: 'player' | 'enemy' | 'neutral'
}

function leaderText(leader: SquadLeader | null, run: RunState): string {
  if (!leader) return 'none'
  if (leader.kind === 'officer') {
    const officer = run.warband.officers.find((entry) => entry.id === leader.id)
    return officer ? officerTitle(officer) : 'officer'
  }

  const potential = run.warband.potentials.find((entry) => entry.id === leader.id)
  return potential ? potentialTitle(potential, unitType(potential.typeId).name) : 'potential'
}

function squadStatsLine(squad: RunState['warband']['squads'][number], run: RunState): string {
  const stats = resolveSquadStats(squad, findOfficer(run.warband, squad))
  return [
    `${stats.hp.toFixed(0)} hp`,
    `${stats.damage.toFixed(1)} dmg`,
    `${stats.armor.toFixed(1)} arm`,
    stats.range > 40 ? `${stats.range.toFixed(0)} range` : 'melee',
    `${stats.moveSpeed.toFixed(1)} speed`,
    `${(stats.accuracy * 100).toFixed(0)}% acc`,
  ].join(' · ')
}

function combatantStatsLine(combatant: NonNullable<ViewStats['combatants']>[number]): string {
  return [
    `${combatant.dps.toFixed(1)} dps`,
    `${combatant.damagePerHit.toFixed(1)} hit`,
    `${combatant.currentHp.toFixed(0)} / ${combatant.maxHp.toFixed(0)} hp`,
    `${combatant.moveSpeed.toFixed(1)} speed`,
    `${(combatant.accuracy * 100).toFixed(0)}% acc`,
    `${(combatant.evade * 100).toFixed(0)}% evade`,
  ].join(' · ')
}

function squadHealth(
  squad: RunState['warband']['squads'][number],
  liveStats: ViewStats | null,
  run: RunState,
): HealthSnapshot {
  const combatant = liveStats?.combatants.find((entry) => entry.label === squadLabel(squad))
  if (combatant) {
    return { current: combatant.currentHp, max: combatant.maxHp }
  }

  const stats = resolveSquadStats(
    squad,
    findOfficer(run.warband, squad),
    run.warband.potentials.find((potential) => potential.id === squad.leader?.id) ?? null,
  )
  return { current: stats.hp * squad.count, max: stats.hp * squad.count }
}

function healthText(snapshot: HealthSnapshot): string {
  return `${snapshot.current.toFixed(0)} / ${snapshot.max.toFixed(0)} hp`
}

function HealthBar({ current, max, tone = 'neutral' }: HealthBarProps) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0
  return (
    <div className={`health-bar ${tone}`}>
      <div className="health-bar-track">
        <div className="health-bar-fill" style={{ width: `${ratio * 100}%` }} />
      </div>
      <span>{healthText({ current, max })}</span>
    </div>
  )
}

export default function ParametersPanel({ run, setup, liveStats }: Props) {
  const warband = run.warband
  const warbandHealth = warband.squads.reduce(
    (sum, squad) => sum + squadHealth(squad, liveStats, run).current,
    0,
  )
  const warbandMaxHealth = warband.squads.reduce(
    (sum, squad) => sum + squadHealth(squad, liveStats, run).max,
    0,
  )

  return (
    <aside className="parameters-panel">
      <section className="spotlight-section">
        <h2>Warband</h2>
        <article className="parameter-card spotlight-card">
          <span className="eyebrow">Total health</span>
          <HealthBar current={warbandHealth} max={warbandMaxHealth} tone="player" />
          <span>{warband.squads.length} squads · {warband.potentials.length} potentials</span>
          <span className="dim-copy">The squad cards below show each unit group in detail.</span>
        </article>
        <div className="quick-stats">
          <div>
            <span className="summary-label">Warband health</span>
            <strong>{healthText({ current: warbandHealth, max: warbandMaxHealth })}</strong>
          </div>
          <div>
            <span className="summary-label">Potentials</span>
            <strong>{warband.potentials.length}</strong>
          </div>
          <div>
            <span className="summary-label">Bodies</span>
            <strong>{warband.squads.reduce((sum, squad) => sum + squad.count, 0)}</strong>
          </div>
        </div>
      </section>

      <section>
        <h2>Run</h2>
        <dl>
          <dt>Seed</dt>
          <dd>{run.seedText}</dd>
          <dt>Phase</dt>
          <dd>{run.phase}</dd>
          <dt>Encounter</dt>
          <dd>{run.encounterIndex + 1} / 15</dd>
          <dt>Salvage</dt>
          <dd>{warband.salvage}</dd>
          <dt>Bodies</dt>
          <dd>{warband.squads.reduce((sum, squad) => sum + squad.count, 0)}</dd>
          <dt>Officers</dt>
          <dd>{warband.officers.length}</dd>
          <dt>Potentials</dt>
          <dd>{warband.potentials.length}</dd>
        </dl>
      </section>

      <section>
        <h2>Squads</h2>
        <div className="parameter-list">
          {warband.squads.map((squad) => (
            <article key={squad.id} className={`parameter-card squad-card ${squad.leader ? 'is-led' : ''}`}>
              <strong>{squadLabel(squad)}</strong>
              <HealthBar
                current={squadHealth(squad, liveStats, run).current}
                max={squadHealth(squad, liveStats, run).max}
                tone="player"
              />
              <span>{unitType(squad.typeId).lineage}</span>
              <span className="leader-line">Leader: {leaderText(squad.leader, run)}</span>
              <span>{squadStatsLine(squad, run)}</span>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2>Officers</h2>
        <div className="parameter-list">
          {warband.officers.map((officer) => (
            <article key={officer.id} className="parameter-card">
              <strong>{officerTitle(officer)}</strong>
              <span>{officer.house}</span>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2>Potentials</h2>
        <div className="parameter-list">
          {warband.potentials.map((potential) => {
            const stats = resolvePotentialStats(potential)
            return (
              <article key={potential.id} className="parameter-card potential-card">
                <strong>{potentialTitle(potential, unitType(potential.typeId).name)}</strong>
                <span>{stats.hp.toFixed(0)} hp · {stats.damage.toFixed(1)} dmg · {stats.armor.toFixed(1)} arm · {stats.moveSpeed.toFixed(1)} speed · {(stats.accuracy * 100).toFixed(0)}% acc</span>
                <span>{potential.mutations.length} mutation{potential.mutations.length === 1 ? '' : 's'}</span>
              </article>
            )
          })}
        </div>
      </section>

      {setup && (
        <section>
          <h2>Battle config</h2>
          <div className="parameter-list">
            {setup.config.groups.map((group, index) => (
              <article key={`${group.label}-${index}`} className="parameter-card">
                <strong>{group.label}</strong>
                <span>{group.count} bodies · discipline {(group.discipline * 100).toFixed(0)}%</span>
                <span>Leader: {group.leaderLabel ?? 'none'}</span>
                <span>{group.stats.hp.toFixed(0)} hp · {group.stats.damage.toFixed(1)} dmg · {group.stats.armor.toFixed(1)} arm</span>
                <span>{group.stats.range > 40 ? `${group.stats.range.toFixed(0)} range` : 'melee'} · {group.stats.moveSpeed.toFixed(1)} speed · {(group.stats.accuracy * 100).toFixed(0)}% acc · {group.stats.attackInterval} tick interval</span>
              </article>
            ))}
          </div>
        </section>
      )}

      {liveStats && (
        <section>
          <h2>Live battle</h2>
          <dl>
            <dt>Tick</dt>
            <dd>{liveStats.tick}</dd>
            <dt>Team A</dt>
            <dd className="a">{liveStats.aliveA}</dd>
            <dt>Team B</dt>
            <dd className="b">{liveStats.aliveB}</dd>
            <dt>Total</dt>
            <dd>{liveStats.total}</dd>
            <dt>FPS</dt>
            <dd>{liveStats.fps.toFixed(0)}</dd>
            <dt>Sim</dt>
            <dd>{liveStats.simMs.toFixed(2)} ms/tick</dd>
          </dl>
          <div className="parameter-list live-combatants">
            {liveStats.combatants.map((combatant) => (
              <article
                key={`${combatant.groupIndex}-${combatant.label}`}
                className={`parameter-card combatant-card ${combatant.team === TEAM_A ? 'player-side' : 'enemy-side'}`}
              >
                <strong>{combatant.label}</strong>
                <span className="leader-line">{combatant.team === TEAM_A ? 'your side' : 'enemy side'} · {combatant.leaderLabel ?? 'no leader'}</span>
                <HealthBar
                  current={combatant.currentHp}
                  max={combatant.maxHp}
                  tone={combatant.team === TEAM_A ? 'player' : 'enemy'}
                />
                <span>{combatant.alive} / {combatant.started} bodies · discipline {(combatant.discipline * 100).toFixed(0)}%</span>
                <span>{combatantStatsLine(combatant)}</span>
                <span>{combatant.range > 40 ? `${combatant.range.toFixed(0)} range` : 'melee'} · {combatant.armor.toFixed(1)} arm · {combatant.attackInterval} tick interval</span>
              </article>
            ))}
          </div>
        </section>
      )}
    </aside>
  )
}
