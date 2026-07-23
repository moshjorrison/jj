export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades' | 'joker'

export type Rank =
  | 'A'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K'
  | 'Joker'

export type Seat = 'bottom' | 'left' | 'top' | 'right'

export type Card = {
  rank: Rank
  suit: Suit
  jokerColor?: 'red' | 'black'
  deckId?: number
}

export type TableSlot = Card | undefined

export type Player = {
  id: string
  name: string
  seat: Seat
  hand: Card[]
  faceUp: TableSlot[]
  faceDown: TableSlot[]
  score: number
  isHuman: boolean
}

export type TurnSource = 'hand' | 'faceUp' | 'faceDown' | 'mixed'

export type GamePhase = 'setup' | 'playing' | 'finished'

/** AI: you vs bots. Hot-seat: pass the device. Online: play across devices. */
export type GameMode = 'ai' | 'hotSeat' | 'online'

export type RoundScoreDelta = {
  playerId: string
  delta: number
}

export type GameState = {
  players: Player[]
  activePile: Card[]
  sidelinedCards: Card[]
  currentPlayerId: string
  roundStartPlayerId: string
  phase: GamePhase
  playerCount: number
  gameMode: GameMode
  formTurnUsed: boolean
  turnRank: Rank | null
  turnSource: TurnSource | null
  /** Points added last round (losers only; winner is 0). */
  lastRoundDeltas?: RoundScoreDelta[] | null
  /** First player to reach this score triggers game over (after the round). */
  winScore: number
}

export type CardPick =
  | { zone: 'hand'; index: number }
  | { zone: 'faceUp'; index: number }
  | { zone: 'faceDown'; index: number }
