import type { GameMode, Player, Seat } from './types'

export function seatsForPlayerCount(count: number): Seat[] {
  if (count === 2) return ['bottom', 'top']
  if (count === 3) return ['bottom', 'left', 'top']
  return ['bottom', 'left', 'top', 'right']
}

export function defaultPlayerNames(count: number): string[] {
  if (count === 2) return ['You', 'Player 2']
  if (count === 3) return ['You', 'Player 2', 'Player 3']
  return ['You', 'Player 2', 'Player 3', 'Player 4']
}

/** Where a seat appears on screen when `viewSeat` is treated as bottom. */
export function displaySeat(
  playerSeat: Seat,
  viewSeat: Seat,
  playerCount: number
): Seat {
  const active = seatsForPlayerCount(playerCount)
  const viewIdx = active.indexOf(viewSeat)
  const playerIdx = active.indexOf(playerSeat)
  if (viewIdx < 0 || playerIdx < 0) return playerSeat
  const offset = (playerIdx - viewIdx + active.length) % active.length
  return active[offset]
}

export function createPlayers(
  playerCount: number,
  gameMode: GameMode,
  names?: string[]
): Player[] {
  const seats = seatsForPlayerCount(playerCount)
  const defaults = defaultPlayerNames(playerCount)

  return seats.map((seat, i) => ({
    id: `player-${i}`,
    name: i === 0 ? 'You' : names?.[i]?.trim() || defaults[i],
    seat,
    hand: [],
    faceUp: Array.from({ length: 4 }, () => undefined),
    faceDown: Array.from({ length: 4 }, () => undefined),
    score: 0,
    isHuman: gameMode === 'ai' ? i === 0 : true,
  }))
}

export function orderPlayersFromWinner(players: Player[], winnerId: string): Player[] {
  const winnerIndex = players.findIndex((p) => p.id === winnerId)
  if (winnerIndex <= 0) return players
  return [...players.slice(winnerIndex), ...players.slice(0, winnerIndex)]
}

export function playerAtDisplay(
  players: Player[],
  display: Seat,
  viewSeat: Seat,
  playerCount: number
): Player | undefined {
  return players.find(
    (p) => displaySeat(p.seat, viewSeat, playerCount) === display
  )
}