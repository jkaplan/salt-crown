/**
 * The three places a camp can send you.
 *
 * One system each, and the blurb says which — a door labelled only "Warband"
 * makes the player open it to find out whether it is where the battle line
 * lives. Kept in its own module so the hub and the shell agree on the list
 * without importing each other.
 */
export type CampPage = 'warband' | 'market' | 'ruins'

export const CAMP_PAGES: { id: CampPage; label: string; blurb: string }[] = [
  {
    id: 'warband',
    label: 'Warband',
    blurb: 'The battle line, your leaders, and who is hurt',
  },
  {
    id: 'market',
    label: 'Market',
    blurb: 'Bodies, officers, and the implants you have not fitted',
  },
  {
    id: 'ruins',
    label: 'Ruins',
    blurb: 'Send a crew out. They miss the next battle',
  },
]
