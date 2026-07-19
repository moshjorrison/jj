import type { GameMode, Player, Seat } from './types'
import { MAX_LOCAL_PLAYERS } from './constants'

export function seatsForPlayerCount(count: number): Seat[] {
  if (count === 2) return ['bottom', 'top']
  if (count === 3) return ['bottom', 'left', 'top']
  if (count === 4) return ['bottom', 'left', 'top', 'right']
  return Array.from({ length: count }, (_, i) =>
    i === 0 ? 'bottom' : 'top'
  )
}

export function defaultPlayerNames(count: number): string[] {
  return Array.from({ length: count }, (_, i) =>
    i === 0 ? 'You' : `Player ${i + 1}`
  )
}

/** Where a seat appears on screen when `viewSeat` is treated as bottom. */
export function displaySeat(
  playerSeat: Seat,
  viewSeat: Seat,
  playerCount: number
): Seat {
  if (playerCount > MAX_LOCAL_PLAYERS) {
    return playerSeat
  }

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
  if (playerCount > MAX_LOCAL_PLAYERS) {
    if (display === 'bottom') {
      return players.find((p) => p.seat === viewSeat)
    }
    return undefined
  }

  return players.find(
    (p) => displaySeat(p.seat, viewSeat, playerCount) === display
  )
}

/** Opponents in clockwise order from the local player's perspective. */
export function opponentsFromView(
  players: Player[],
  viewPlayerId: string
): Player[] {
  const viewIndex = players.findIndex((p) => p.id === viewPlayerId)
  if (viewIndex < 0) return players.filter((p) => p.id !== viewPlayerId)

  const ordered: Player[] = []
  for (let i = 1; i < players.length; i++) {
    ordered.push(players[(viewIndex + i) % players.length])
  }
  return ordered
}
