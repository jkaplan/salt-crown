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
  travelDone,
  moveSquad,
  placeSquad,
  newRun,
  resolveBattle,
  totalBodies,
} from '@salt/game'
import type { BattleSetup, Officer, OriginId, RunState } from '@salt/game'
import type { BattleEvent, GroupResult, Winner } from '@salt/sim'
import Camp from './screens/Camp'
import BattleScreen from './screens/BattleScreen'
import Report from './screens/Report'
import StartScreen from './screens/StartScreen'
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

  const onMarch = useCallback(() => {
    if (!run) return
    /*
     * STOPGAP. The road is walked here with no player input and always at
     * Column pace, because the travel screen does not exist yet — it is step 5
     * of docs/plans/travel.md and this is step 2. Column costs exactly what a
     * march cost before travel existed, so the game plays as it did.
     *
     * The screen replaces this block outright: pace becomes a choice, and the
     * legs become something the player watches happen.
     */
    let walked = setOut(run, 'column')
    while (!travelDone(walked)) walked = advanceLeg(walked)

    // The setup comes back from march() so it always matches the warband that
    // actually leaves camp — a water shortfall removes bodies here.
    const { state, setup } = march(walked)
    setSetup(setup)
    setRun(state)
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
              {run.phase === 'camp' && (
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
                      {run.outcome === 'won' ? 'The warband endures' : 'The warband is gone'}
                    </h2>
                    <p className="enc">
                      {run.outcome === 'won'
                        ? `The column held all the way through. ${totalBodies(run.warband)} still ` +
                          "standing — the wasteland doesn't usually let that many walk away. " +
                          'The Crown is theirs now, whatever that turns out to mean.'
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
