import '../styles/squadCards.css'

/**
 * Squad card mockup for V0.1 visualization. Shows how squads could be rendered
 * as cards coexisting with the battle view, displaying composition at a glance.
 */

interface SquadCardData {
  name: string
  lineage: 'mutant' | 'truekin' | 'machine'
  aliveCurrent: number
  aliveStarted: number
  hp: number
  maxHp: number
  leader?: {
    name: string
    mutations: string[]
  }
  damageDealt: number
  turnsEngaged: number
  color: number
}

const SAMPLE_SQUAD_A: SquadCardData[] = [
  {
    name: 'Chaff',
    lineage: 'mutant',
    aliveCurrent: 18,
    aliveStarted: 40,
    hp: 480,
    maxHp: 1200,
    leader: {
      name: 'Skitter (Firstborn)',
      mutations: ['Horns 3', 'Regeneration 2'],
    },
    damageDealt: 342,
    turnsEngaged: 24,
    color: 0x7a8a5c,
  },
  {
    name: 'Thornback',
    lineage: 'mutant',
    aliveCurrent: 4,
    aliveStarted: 6,
    hp: 285,
    maxHp: 540,
    leader: {
      name: 'Buckle (Firstborn)',
      mutations: ['Carapace 4'],
    },
    damageDealt: 156,
    turnsEngaged: 22,
    color: 0x6b6f3a,
  },
  {
    name: 'Exemplar',
    lineage: 'truekin',
    aliveCurrent: 1,
    aliveStarted: 2,
    hp: 142,
    maxHp: 280,
    leader: {
      name: 'Keth-Vorn (Officer)',
      mutations: [],
    },
    damageDealt: 387,
    turnsEngaged: 18,
    color: 0x5a7fa3,
  },
]

const SAMPLE_SQUAD_B: SquadCardData[] = [
  {
    name: 'Chaff',
    lineage: 'mutant',
    aliveCurrent: 12,
    aliveStarted: 40,
    hp: 360,
    maxHp: 1200,
    damageDealt: 298,
    turnsEngaged: 24,
    color: 0x7a8a5c,
  },
  {
    name: 'Spitter',
    lineage: 'mutant',
    aliveCurrent: 2,
    aliveStarted: 4,
    hp: 68,
    maxHp: 168,
    damageDealt: 412,
    turnsEngaged: 20,
    color: 0x8fbf3f,
  },
  {
    name: 'Exemplar',
    lineage: 'mutant',
    aliveCurrent: 3,
    aliveStarted: 3,
    hp: 180,
    maxHp: 180,
    leader: {
      name: 'Thrace (Officer)',
      mutations: [],
    },
    damageDealt: 521,
    turnsEngaged: 24,
    color: 0x9a6f6b,
  },
]

function lineageIcon(lineage: string): string {
  switch (lineage) {
    case 'mutant':
      return '✦'
    case 'truekin':
      return '⬡'
    case 'machine':
      return '⚙'
    default:
      return '●'
  }
}


function SquadCard({ squad }: { squad: SquadCardData }) {
  const healthPercent = (squad.hp / squad.maxHp) * 100
  const damagePerTurn = (squad.damageDealt / Math.max(1, squad.turnsEngaged)).toFixed(1)

  return (
    <div className="squad-card">
      <div className="squad-header">
        <div className="squad-name-lineage">
          <span className="lineage-icon" title={squad.lineage}>
            {lineageIcon(squad.lineage)}
          </span>
          <span className="squad-name">{squad.name}</span>
        </div>
        <div className="squad-count">
          {squad.aliveCurrent}/{squad.aliveStarted}
        </div>
      </div>

      <div className="health-bar-container">
        <div className="health-bar-bg">
          <div className="health-bar-fill" style={{ width: `${healthPercent}%` }}></div>
        </div>
        <div className="health-text">{squad.hp}/{squad.maxHp}</div>
      </div>

      {squad.leader && (
        <div className="leader-section">
          <div className="leader-name">{squad.leader.name}</div>
          {squad.leader.mutations.length > 0 && (
            <div className="mutations">
              {squad.leader.mutations.map((mut, i) => (
                <span key={i} className="mutation-tag">
                  {mut}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="squad-stats">
        <div className="stat">
          <span className="stat-label">Dmg/Turn</span>
          <span className="stat-value">{damagePerTurn}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Engaged</span>
          <span className="stat-value">{squad.turnsEngaged}</span>
        </div>
      </div>
    </div>
  )
}

export default function SquadCardMockup() {
  return (
    <div className="squad-mockup">
      <div className="mockup-title">Squad Card Mockup</div>

      <div className="teams-container">
        <div className="team team-a">
          <div className="team-label">Team A (Player)</div>
          <div className="squad-grid">
            {SAMPLE_SQUAD_A.map((squad, i) => (
              <SquadCard key={i} squad={squad} />
            ))}
          </div>
        </div>

        <div className="team team-b">
          <div className="team-label">Team B (Enemy)</div>
          <div className="squad-grid">
            {SAMPLE_SQUAD_B.map((squad, i) => (
              <SquadCard key={i} squad={squad} />
            ))}
          </div>
        </div>
      </div>

      <div className="mockup-notes">
        <p>
          This mockup shows how squad cards could coexist with the battle view. Cards display:
        </p>
        <ul>
          <li>Unit type + alive/started count</li>
          <li>Health bar + current HP</li>
          <li>Leader name (if present) + mutations</li>
          <li>Lineage icon (✦ mutant, ⬡ True Kin, ⚙ machine)</li>
          <li>Damage per turn + turns engaged</li>
        </ul>
      </div>
    </div>
  )
}
