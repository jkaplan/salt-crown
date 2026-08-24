import { useCallback, useState, type CSSProperties } from 'react'
import {
  ENCOUNTERS_PER_RUN,
  advance,
  assignLeader,
  buy,
  appraise,
  setFielded,
  resolveEvent,
  sellProspect,
  sendExpedition,
  recallExpedition,
  treatWound,
  treatOfficer,
  chooseMutation,
  march,
  moveSquad,
  placeSquad,
  newRun,
  resolveBattle,
  totalBodies,
} from '@salt/game'
import type { BattleSetup, Officer, RunState } from '@salt/game'
import type { GroupResult, Winner } from '@salt/sim'
import Camp from './screens/Camp'
import BattleScreen from './screens/BattleScreen'
import Report from './screens/Report'
import Skirmish from './screens/Skirmish'
import StartScreen from './screens/StartScreen'
import LeaderSelect from './screens/LeaderSelect'
import MutationLedger from './screens/MutationLedger'
import ParametersPanel from './components/ParametersPanel'
import type { ViewStats } from './BattleView'

type Mode = 'campaign' | 'skirmish' | 'mutations'
type Setup = 'start' | 'leader'

export default function App() {
  const [mode, setMode] = useState<Mode>('campaign')
  // Closed by default. It is a debug readout, not part of playing.
  const [panelOpen, setPanelOpen] = useState(false)
  const [seedText, setSeedText] = useState('salt-crown')
  const [setupPhase, setSetupPhase] = useState<Setup>('start')
  const [playerColor, setPlayerColor] = useState('#7fc7bb')
  // Null until a commander is chosen. There is no warband before then, and
  // inventing one just to satisfy useState put a phantom roster on screen.
  const [run, setRun] = useState<RunState | null>(null)
  const [setup, setSetup] = useState<BattleSetup | null>(null)
  const [liveStats, setLiveStats] = useState<ViewStats | null>(null)

  const onMarch = useCallback(() => {
    if (!run) return
    // The setup comes back from march() so it always matches the warband that
    // actually leaves camp — a water shortfall removes bodies here.
    const { state, setup } = march(run)
    setSetup(setup)
    setRun(state)
  }, [run])

  const onDone = useCallback(
    (results: GroupResult[], winner: Winner, ticks: number) => {
      if (!setup) return
      setRun((r) =>
        r && r.phase === 'battle'
          ? resolveBattle(r, results, winner, ticks, setup.playerSources)
          : r,
      )
    },
    [setup],
  )

  const startCampaign = (leader: Officer) => {
    setRun(newRun(seedText, leader))
    setSetup(null)
    setLiveStats(null)
  }

  const restart = () => {
    setRun(null)
    setSetup(null)
    setLiveStats(null)
    setSetupPhase('start')
  }

  const shellStyle: CSSProperties = { ['--a' as string]: playerColor }

  /* Setup runs bare — no nav, no docked panel, nothing to inspect yet. */
  if (mode === 'campaign' && !run) {
    return (
      <div className="app setup" style={shellStyle}>
        {setupPhase === 'start' ? (
          <StartScreen
            seedText={seedText}
            playerColor={playerColor}
            onSeedChange={setSeedText}
            onPlayerColorChange={setPlayerColor}
            onStart={() => setSetupPhase('leader')}
          />
        ) : (
          <LeaderSelect
            seed={seedText}
            onBack={() => setSetupPhase('start')}
            onSelect={startCampaign}
          />
        )}
      </div>
    )
  }

  const showPanel = panelOpen && mode === 'campaign' && run !== null

  return (
    <div className="app" style={shellStyle}>
      <header>
        <h1>Salt Crown</h1>
        <nav>
          <button className={mode === 'campaign' ? 'on' : ''} onClick={() => setMode('campaign')}>
            Campaign
          </button>
          <button className={mode === 'skirmish' ? 'on' : ''} onClick={() => setMode('skirmish')}>
            Skirmish
          </button>
          <button className={mode === 'mutations' ? 'on' : ''} onClick={() => setMode('mutations')}>
            Mutation Ledger
          </button>
          {mode === 'campaign' && run && (
            <button className={panelOpen ? 'on' : ''} onClick={() => setPanelOpen(!panelOpen)}>
              Details
            </button>
          )}
        </nav>
      </header>

      <div className={showPanel ? 'shell shell-docked' : 'shell'}>
        <div className="shell-main">
          {mode === 'skirmish' && <Skirmish />}

          {mode === 'mutations' && <MutationLedger />}

          {mode === 'campaign' && run && (
            <>
              {run.phase === 'camp' && (
                <Camp
                  run={run}
                  onBuy={(id) => setRun(buy(run, id))}
                  onAssign={(sq, leader) => setRun(assignLeader(run, sq, leader))}
                  onChooseMutation={(pid, i) => setRun(chooseMutation(run, pid, i))}
                  onResolveEvent={(i) => setRun(resolveEvent(run, i))}
                  onAppraise={(pid) => setRun(appraise(run, pid))}
                  onTreatWound={(pid) => setRun(treatWound(run, pid))}
                  onTreatOfficer={(oid) => setRun(treatOfficer(run, oid))}
                  onSetFielded={(pid, f) => setRun(setFielded(run, pid, f))}
                  onSell={(pid) => setRun(sellProspect(run, pid))}
                  onSendExpedition={(verb, crew) => setRun(sendExpedition(run, verb, crew))}
                  onRecallExpedition={() => setRun(recallExpedition(run))}
                  onMoveSquad={(sq, dir) => setRun(moveSquad(run, sq, dir))}
                  onPlaceSquad={(sq, to) => setRun(placeSquad(run, sq, to))}
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
                  isLast={
                    run.encounterIndex + 1 >= ENCOUNTERS_PER_RUN ||
                    totalBodies(run.warband) === 0
                  }
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
                    <button className="btn-primary" onClick={restart}>
                      New run
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {showPanel && <ParametersPanel run={run} setup={setup} liveStats={liveStats} />}
      </div>
    </div>
  )
}
