import { useCallback, useState, type CSSProperties } from 'react'
import {
  ENCOUNTERS_PER_RUN,
  advance,
  assignLeader,
  buy,
  appraise,
  setFielded,
  chooseCampOption,
  resolveEvent,
  sellProspect,
  sendExpedition,
  recallExpedition,
  treatWound,
  treatOfficer,
  installBionic,
  assignRelic,
  rerollOffers,
  chooseMutation,
  march,
  setOut,
  advanceLeg,
  moveSquad,
  placeSquad,
  newRun,
  resolveBattle,
  totalBodies,
} from '@salt/game'
import type { BattleSetup, Officer, OriginId, Pace, RunState } from '@salt/game'
import type { BattleEvent, GroupResult, Winner } from '@salt/sim'
import Camp from './screens/Camp'
import BattleScreen from './screens/BattleScreen'
import Report from './screens/Report'
import StartScreen from './screens/StartScreen'
import TravelScreen from './screens/TravelScreen'
import LeaderSelect from './screens/LeaderSelect'
import OriginSelect from './screens/OriginSelect'
import FoundingMutations from './screens/FoundingMutations'
import Compendium from './screens/Compendium'
import ParametersPanel from './components/ParametersPanel'
import type { ViewStats } from './BattleView'

type Mode = 'campaign' | 'compendium'
/*
 * Setup is a three-step path whose middle step depends on the origin: a Scion
 * picks a commander, a Freed Firstborn picks what they are. §13 — "the True
 * Kin start is about who leads you, the mutant start is about what you are."
 */
type Setup = 'start' | 'origin' | 'leader' | 'founding'

export default function App() {
  const [mode, setMode] = useState<Mode>('campaign')
  // Closed by default. It is a debug readout, not part of playing.
  const [panelOpen, setPanelOpen] = useState(false)
  const [seedText, setSeedText] = useState('salt-crown')
  const [setupPhase, setSetupPhase] = useState<Setup>('start')
  const [origin, setOrigin] = useState<OriginId>('scion')
  const [playerColor, setPlayerColor] = useState('#7fc7bb')
  // Null until a commander is chosen. There is no warband before then, and
  // inventing one just to satisfy useState put a phantom roster on screen.
  const [run, setRun] = useState<RunState | null>(null)
  const [setup, setSetup] = useState<BattleSetup | null>(null)
  const [liveStats, setLiveStats] = useState<ViewStats | null>(null)
  // True from the moment March is pressed until the warband arrives. Only the
  // camp half of the road needs it; after setOut the phase says where we are.
  const [departing, setDeparting] = useState(false)

  /*
   * Marching opens the road rather than crossing it. The pace is chosen while
   * the run is still in camp — setOut() is what moves it to the travel phase —
   * so a flag carries the screen across that one boundary and TravelScreen
   * reads the phase for everything after it.
   */
  const onMarch = useCallback(() => setDeparting(true), [])

  const onSetOut = useCallback((pace: Pace) => setRun((r) => (r ? setOut(r, pace) : r)), [])

  const onWalk = useCallback(() => setRun((r) => (r ? advanceLeg(r) : r)), [])

  const onArrive = useCallback(() => {
    if (!run) return
    // The setup comes back from march() so it always matches the warband that
    // actually arrives — the road removes bodies, not just the gate.
    const { state, setup } = march(run)
    setSetup(setup)
    setRun(state)
    setDeparting(false)
  }, [run])

  const onDone = useCallback(
    (results: GroupResult[], winner: Winner, ticks: number, events: BattleEvent[]) => {
      if (!setup) return
      setRun((r) =>
        r && r.phase === 'battle'
          ? resolveBattle(r, results, winner, ticks, setup.playerSources, events)
          : r,
      )
    },
    [setup],
  )

  const startCampaign = (leader: Officer) => {
    setRun(newRun(seedText, { origin: 'scion', officer: leader }))
    setSetup(null)
    setLiveStats(null)
  }

  const startAsFirstborn = (mutationIds: string[], name: string) => {
    setRun(newRun(seedText, { origin: 'firstborn', mutationIds, name }))
    setSetup(null)
    setLiveStats(null)
  }

  const restart = () => {
    setRun(null)
    setSetup(null)
    setLiveStats(null)
    setDeparting(false)
    setSetupPhase('start')
    setOrigin('scion')
  }

  const shellStyle: CSSProperties = {
    ['--a' as string]: playerColor,
    // Mutant starts run warmer, True Kin colder — a small tell that this is
    // a different run before anything else on screen says so.
    ['--origin-tint' as string]: origin === 'firstborn' ? '#c9a56b' : '#8ca0c8',
  }

  /* Setup runs bare — no nav, no docked panel, nothing to inspect yet. */
  if (mode === 'campaign' && !run) {
    return (
      <div className="app setup" style={shellStyle}>
        {setupPhase === 'start' && (
          <StartScreen
            seedText={seedText}
            playerColor={playerColor}
            onSeedChange={setSeedText}
            onPlayerColorChange={setPlayerColor}
            onStart={() => setSetupPhase('origin')}
          />
        )}

        {setupPhase === 'origin' && (
          <OriginSelect
            onBack={() => setSetupPhase('start')}
            onSelect={(id) => {
              setOrigin(id)
              setSetupPhase(id === 'firstborn' ? 'founding' : 'leader')
            }}
          />
        )}

        {setupPhase === 'leader' && (
          <LeaderSelect
            seed={seedText}
            onBack={() => setSetupPhase('origin')}
            onSelect={startCampaign}
          />
        )}

        {setupPhase === 'founding' && (
          <FoundingMutations
            onBack={() => setSetupPhase('origin')}
            onConfirm={startAsFirstborn}
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
          <button className={mode === 'compendium' ? 'on' : ''} onClick={() => setMode('compendium')}>
            Compendium
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
          {mode === 'compendium' && <Compendium run={run} />}

          {mode === 'campaign' && run && (
            <>
              {(departing || run.phase === 'travel') && (
                <TravelScreen
                  run={run}
                  onSetOut={onSetOut}
                  onWalk={onWalk}
                  onArrive={onArrive}
                />
              )}

              {run.phase === 'camp' && !departing && (
                <Camp
                  run={run}
                  onBuy={(id) => setRun(buy(run, id))}
                  onAssign={(sq, leader) => setRun(assignLeader(run, sq, leader))}
                  onChooseMutation={(pid, i) => setRun(chooseMutation(run, pid, i))}
                  onChooseCampOption={(category) => setRun(chooseCampOption(run, category))}
                  onResolveEvent={(i) => setRun(resolveEvent(run, i))}
                  onAppraise={(pid) => setRun(appraise(run, pid))}
                  onTreatWound={(pid) => setRun(treatWound(run, pid))}
                  onTreatOfficer={(oid) => setRun(treatOfficer(run, oid))}
                  onInstall={(oid, bid) => setRun(installBionic(run, oid, bid))}
                  onAssignRelic={(sid, rid) => setRun(assignRelic(run, sid, rid))}
                  onReroll={() => setRun(rerollOffers(run))}
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
                      {run.ending === 'caught'
                        ? 'Run down at last'
                        : run.outcome === 'won'
                          ? 'The warband endures'
                          : 'The warband is gone'}
                    </h2>
                    <p className="enc">
                      {run.ending === 'caught'
                        ? `You caught it. ${totalBodies(run.warband)} still standing at the end of ` +
                          'the trail, and whatever you burned getting here is spent. Nobody ' +
                          'else in the Muster got this far, and nobody else will hear what was there.'
                        : run.outcome === 'won'
                          ? `The column held all the way through. ${totalBodies(run.warband)} still ` +
                            "standing — the wasteland doesn't usually let that many walk away. " +
                            'The trail went cold somewhere behind you. The Crown is theirs now, ' +
                            'whatever that turns out to mean.'
                          : 'Nothing left to field. Attrition got there first, same as it gets ' +
                            'everyone eventually. The Muster does not stop to notice, and neither ' +
                            'does whatever is under the salt.'}
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
