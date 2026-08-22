import { useCallback, useState } from 'react'
import {
  ENCOUNTERS_PER_RUN,
  advance,
  assignLeader,
  buildBattle,
  buy,
  march,
  newRun,
  resolveBattle,
  totalBodies,
} from '@salt/game'
import type { BattleSetup, RunState } from '@salt/game'
import type { GroupResult, Winner } from '@salt/sim'
import type { Officer } from '@salt/game'
import Camp from './screens/Camp'
import BattleScreen from './screens/BattleScreen'
import Report from './screens/Report'
import Skirmish from './screens/Skirmish'
import StartScreen from './screens/StartScreen'
import LeaderSelect from './screens/LeaderSelect'

type Mode = 'campaign' | 'skirmish'

export default function App() {
  const [mode, setMode] = useState<Mode>('campaign')
  const [seedText, setSeedText] = useState('salt-crown')
  const [phase, setPhase] = useState<'start' | 'leader' | 'campaign'>('start')
  const [run, setRun] = useState<RunState>(() => newRun('salt-crown'))
  const [setup, setSetup] = useState<BattleSetup | null>(null)

  const onMarch = useCallback(() => {
    const built = buildBattle(run)
    setSetup(built)
    setRun(march(run))
  }, [run])

  const onDone = useCallback(
    (results: GroupResult[], winner: Winner, ticks: number) => {
      if (!setup) return
      setRun((r) =>
        r.phase === 'battle'
          ? resolveBattle(r, results, winner, ticks, setup.playerSources)
          : r,
      )
    },
    [setup],
  )

  const startSeedSelection = () => {
    setPhase('leader')
  }

  const startCampaign = (leader: Officer) => {
    setRun(newRun(seedText, leader))
    setSetup(null)
    setPhase('campaign')
  }

  const restart = () => {
    setPhase('start')
  }

  if (mode === 'skirmish') {
    return (
      <Shell mode={mode} setMode={setMode}>
        <Skirmish />
      </Shell>
    )
  }

  if (mode === 'campaign' && phase === 'start') {
    return (
      <Shell mode={mode} setMode={setMode}>
        <StartScreen
          seedText={seedText}
          onSeedChange={setSeedText}
          onStart={startSeedSelection}
        />
      </Shell>
    )
  }

  if (mode === 'campaign' && phase === 'leader') {
    return (
      <Shell mode={mode} setMode={setMode}>
        <LeaderSelect
          seed={seedText}
          onSelect={startCampaign}
        />
      </Shell>
    )
  }

  return (
    <Shell mode={mode} setMode={setMode}>
      {run.phase === 'camp' && (
        <Camp
          run={run}
          onBuy={(id) => setRun(buy(run, id))}
          onAssign={(sq, leader) => setRun(assignLeader(run, sq, leader))}
          onMarch={onMarch}
        />
      )}

      {run.phase === 'battle' && setup && (
        <BattleScreen
          config={setup.config}
          title={`${run.encounter.name} — ${run.encounterIndex + 1}/${ENCOUNTERS_PER_RUN}`}
          onDone={onDone}
        />
      )}

      {run.phase === 'report' && run.report && (
        <Report
          report={run.report}
          isLast={run.encounterIndex + 1 >= ENCOUNTERS_PER_RUN || totalBodies(run.warband) === 0}
          onContinue={() => {
            setSetup(null)
            setRun(advance(run))
          }}
        />
      )}

      {run.phase === 'over' && (
        <div className="report">
          <div className="report-card">
            <h2 className={run.outcome === 'won' ? 'won' : 'lost'}>
              {run.outcome === 'won' ? 'The warband endures' : 'The warband is gone'}
            </h2>
            <p className="enc">
              {run.outcome === 'won'
                ? `Eight fields held. ${totalBodies(run.warband)} still standing.`
                : 'Nothing left to field. Attrition got there first.'}
            </p>
            <label className="seedbox">
              Seed
              <input value={seedText} onChange={(e) => setSeedText(e.target.value)} />
            </label>
            <button onClick={restart}>New run</button>
          </div>
        </div>
      )}
    </Shell>
  )
}

function Shell({
  mode,
  setMode,
  children,
}: {
  mode: Mode
  setMode: (m: Mode) => void
  children: React.ReactNode
}) {
  return (
    <div className="app">
      <header>
        <h1>Salt Crown</h1>
        <span className="milestone">M1</span>
        <nav>
          <button className={mode === 'campaign' ? 'on' : ''} onClick={() => setMode('campaign')}>
            Campaign
          </button>
          <button className={mode === 'skirmish' ? 'on' : ''} onClick={() => setMode('skirmish')}>
            Skirmish
          </button>
        </nav>
      </header>
      {children}
    </div>
  )
}
