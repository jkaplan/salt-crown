import ExpeditionCard from '../../components/ExpeditionCard'
import { Section } from './parts'
import type { CampProps } from './parts'

/**
 * Ruins.
 *
 * One decision, given a whole page, because it is the only one in camp that
 * costs you something in the fight you are about to have — and buried at the
 * bottom of a shared tab it read as an afterthought rather than as a trade.
 */
export default function RuinsPage({
  run,
  onSendExpedition,
  onRecallExpedition,
}: CampProps) {
  const { warband } = run
  const leadingIds = new Set(
    warband.squads
      .filter((sq) => sq.leader?.kind === 'prospect')
      .map((sq) => sq.leader!.id),
  )

  return (
    <div className="camp-page">
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
  )
}
