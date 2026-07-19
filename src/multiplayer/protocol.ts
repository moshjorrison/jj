import type { CardPick, GameState } from '../types'
import { MAX_ONLINE_PLAYERS, MIN_PLAYERS } from '../constants'

export type LobbyPlayer = {
  id: string
  name: string
  connected: boolean
}

export type ClientMessage =
  | { type: 'create'; playerCount: number; name: string }
  | { type: 'join'; code: string; name: string }
  | { type: 'start' }
  | { type: 'play'; picks: CardPick[] }
  | { type: 'flip'; index: number }
  | { type: 'endTurn' }
  | { type: 'overplay'; pick: CardPick }
  | { type: 'tiebreaker' }
  | { type: 'newGame' }

export type ServerMessage =
  | {
      type: 'lobby'
      code: string
      players: LobbyPlayer[]
      hostId: string
      maxPlayers: number
      yourPlayerId: string
    }
  | {
      type: 'game'
      state: GameState
      message: string
    }
  | { type: 'error'; message: string }

export function getWsUrl(): string {
  const configured = import.meta.env.VITE_WS_URL as string | undefined
  if (configured) return configured
  if (import.meta.env.DEV) return 'ws://localhost:3001'
  return ''
}

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
