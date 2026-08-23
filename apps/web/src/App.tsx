import { useCallback, useState, type CSSProperties } from 'react'
import {
  ENCOUNTERS_PER_RUN,
  advance,
  assignLeader,
  buildBattle,
  buy,
  march,
  newRun,
  moveSquad,
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
import ParametersPanel from './components/ParametersPanel'
import type { ViewStats } from './BattleView'

type Mode = 'campaign' | 'skirmish'

export default function App() {
  const [mode, setMode] = useState<Mode>('campaign')
  const [panelOpen, setPanelOpen] = useState(true)
  const [seedText, setSeedText] = useState('salt-crown')
  const [phase, setPhase] = useState<'start' | 'leader' | 'campaign'>('start')
  const [playerColor, setPlayerColor] = useState('#7fc7bb')
  const [run, setRun] = useState<RunState>(() => newRun('salt-crown'))
  const [setup, setSetup] = useState<BattleSetup | null>(null)
  const [liveStats, setLiveStats] = useState<ViewStats | null>(null)

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
    setLiveStats(null)
  }

  const restart = () => {
    setPhase('start')
    setLiveStats(null)
  }

  if (mode === 'skirmish') {
    return (
      <Shell mode={mode} setMode={setMode} panelOpen={panelOpen} setPanelOpen={setPanelOpen} run={run} setup={setup} liveStats={liveStats} playerColor={playerColor}>
        <Skirmish />
      </Shell>
    )
  }

  if (mode === 'campaign' && phase === 'start') {
    return (
      <Shell mode={mode} setMode={setMode} panelOpen={panelOpen} setPanelOpen={setPanelOpen} run={run} setup={setup} liveStats={liveStats} playerColor={playerColor}>
        <StartScreen
          seedText={seedText}
          playerColor={playerColor}
          onSeedChange={setSeedText}
          onPlayerColorChange={setPlayerColor}
          onStart={startSeedSelection}
        />
      </Shell>
    )
  }

  if (mode === 'campaign' && phase === 'leader') {
    return (
      <Shell mode={mode} setMode={setMode} panelOpen={panelOpen} setPanelOpen={setPanelOpen} run={run} setup={setup} liveStats={liveStats} playerColor={playerColor}>
        <LeaderSelect
          seed={seedText}
          onSelect={startCampaign}
        />
      </Shell>
    )
  }

  return (
    <Shell mode={mode} setMode={setMode} panelOpen={panelOpen} setPanelOpen={setPanelOpen} run={run} setup={setup} liveStats={liveStats} playerColor={playerColor}>
      {run.phase === 'camp' && (
        <Camp
          run={run}
          onBuy={(id) => setRun(buy(run, id))}
          onAssign={(sq, leader) => setRun(assignLeader(run, sq, leader))}
          onMoveSquad={(sq, dir) => setRun(moveSquad(run, sq, dir))}
          onMarch={onMarch}
        />
      )}

      {run.phase === 'battle' && setup && (
        <BattleScreen
          config={setup.config}
          playerColor={playerColor}
          title={`${run.encounter.name} — ${run.encounterIndex + 1}/${ENCOUNTERS_PER_RUN}`}
          onStats={setLiveStats}
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
  panelOpen,
  setPanelOpen,
  run,
  setup,
  liveStats,
  playerColor,
  children,
}: {
  mode: Mode
  setMode: (m: Mode) => void
  panelOpen: boolean
  setPanelOpen: (open: boolean) => void
  run: RunState
  setup: BattleSetup | null
  liveStats: ViewStats | null
  playerColor: string
  children: React.ReactNode
}) {
  const shellStyle: CSSProperties = { ['--a' as string]: playerColor }

  return (
    <div className="app" style={shellStyle}>
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
          <button className={panelOpen ? 'on' : ''} onClick={() => setPanelOpen(!panelOpen)}>
            Parameters
          </button>
        </nav>
      </header>
      <div className={panelOpen ? 'shell shell-docked' : 'shell'}>
        <div className="shell-main">{children}</div>
        {panelOpen && <ParametersPanel run={run} setup={setup} liveStats={liveStats} />}
      </div>
    </div>
  )
}
