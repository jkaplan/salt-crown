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
import type { ViewStats } from '../BattleView'

interface Props {
  run: RunState
  setup: BattleSetup | null
  liveStats: ViewStats | null
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
  return `${stats.hp.toFixed(0)} hp · ${stats.damage.toFixed(1)} dmg · ${stats.armor.toFixed(1)} arm${stats.range > 40 ? ` · ${stats.range.toFixed(0)} range` : ''}`
}

function combatantStatsLine(combatant: NonNullable<ViewStats['combatants']>[number]): string {
  return [
    `${combatant.currentHp.toFixed(0)} hp / ${combatant.maxHp.toFixed(0)} max`,
    `${combatant.damagePerHit.toFixed(1)} hit`,
    `${combatant.dps.toFixed(1)} dps`,
    `${combatant.moveSpeed.toFixed(1)} speed`,
    `${(combatant.accuracy * 100).toFixed(0)}% acc`,
    `${(combatant.evade * 100).toFixed(0)}% evade`,
  ].join(' · ')
}

export default function ParametersPanel({ run, setup, liveStats }: Props) {
  const warband = run.warband

  return (
    <aside className="parameters-panel">
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
            <article key={squad.id} className="parameter-card">
              <strong>{squadLabel(squad)}</strong>
              <span>{unitType(squad.typeId).lineage}</span>
              <span>Leader: {leaderText(squad.leader, run)}</span>
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
              <article key={potential.id} className="parameter-card">
                  <strong>{potentialTitle(potential, unitType(potential.typeId).name)}</strong>
                <span>{stats.hp.toFixed(0)} hp · {stats.damage.toFixed(1)} dmg · {stats.armor.toFixed(1)} arm</span>
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
                <span>{group.stats.range > 40 ? `${group.stats.range.toFixed(0)} range` : 'melee'} · {group.stats.attackInterval} tick interval</span>
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
              <article key={`${combatant.groupIndex}-${combatant.label}`} className="parameter-card">
                <strong>{combatant.label}</strong>
                <span>{combatant.leaderLabel ?? 'no leader'}</span>
                <span>{combatant.currentHp.toFixed(0)} hp / {combatant.maxHp.toFixed(0)} max</span>
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
