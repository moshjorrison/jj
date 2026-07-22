import type { Card, CardPick, GameState } from '../types'

export type LobbyPlayer = {
  id: string
  name: string
  connected: boolean
}

export type ClientMessage =
  | { type: 'create'; playerCount: number; name: string }
  | { type: 'join'; code: string; name: string; rejoinToken?: string }
  | { type: 'rejoin'; code: string; token: string }
  | { type: 'start' }
  | { type: 'play'; picks: CardPick[] }
  | { type: 'flip'; index: number }
  | { type: 'endTurn' }
  | { type: 'pickUp' }
  | { type: 'overplay'; pick: CardPick }
  | { type: 'tiebreaker' }
  | { type: 'newGame' }
  | { type: 'continueRound' }
  | { type: 'kick'; playerId: string }

export type ServerMessage =
  | {
      type: 'lobby'
      code: string
      players: LobbyPlayer[]
      hostId: string
      maxPlayers: number
      yourPlayerId: string
      rejoinToken: string
    }
  | {
      type: 'game'
      state: GameState
      message: string
      turnDeadline?: number
      disconnectedPlayerIds?: string[]
    }
  | {
      type: 'roundEnd'
      displayState: GameState
      pendingState: GameState
      message: string
      continuedIds: string[]
      turnDeadline?: number
      disconnectedPlayerIds?: string[]
    }
  | { type: 'error'; message: string }

const HIDDEN_CARD: Card = {
  rank: '2',
  suit: 'spades',
  deckId: -1,
}

function hiddenHand(count: number): Card[] {
  return Array.from({ length: count }, () => ({ ...HIDDEN_CARD }))
}

/** Strip hidden card data for opponents before sending state to a client. */
export function filterGameStateForPlayer(
  state: GameState,
  viewerId: string
): GameState {
  return {
    ...state,
    players: state.players.map((player) => {
      if (player.id === viewerId) {
        return { ...player, name: 'You' }
      }

      return {
        ...player,
        hand: hiddenHand(player.hand.length),
        faceDown: player.faceDown.map((slot) =>
          slot ? { ...HIDDEN_CARD } : undefined
        ),
      }
    }),
  }
}

/** At round end, show every player's leftover cards for scoring. */
export function filterGameStateForRoundEnd(
  state: GameState,
  viewerId: string
): GameState {
  return {
    ...state,
    players: state.players.map((player) => ({
      ...player,
      name: player.id === viewerId ? 'You' : player.name,
    })),
  }
}

export function parseClientMessage(raw: string): ClientMessage | null {
  try {
    const data = JSON.parse(raw) as ClientMessage
    if (!data || typeof data !== 'object' || !('type' in data)) return null
    return data
  } catch {
    return null
  }
}

export function sendJson(socket: { send: (data: string) => void }, msg: ServerMessage) {
  socket.send(JSON.stringify(msg))
}
