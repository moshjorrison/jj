import type { Card, GameState } from '../types'

export type PlayLikeResult = {
  state: GameState
  message: string
  cleared?: boolean
  badFlip?: boolean
  blocked?: boolean
}

export type FlyingCard = {
  id: string
  card: Card
  fromX: number
  fromY: number
  toX: number
  toY: number
  startRotation: number
  endRotation: number
  width: number
  height: number
  delayMs: number
  durationMs: number
}

export type RoundRevealPlayerState = {
  playerId: string
  revealedHand: boolean
  revealedFaceDown: boolean
  showPointsBanner: boolean
  points: number
}

export type RoundRevealState = {
  pendingFinalState: GameState
  roundMessage: string
  winnerId: string | null
  players: RoundRevealPlayerState[]
  revealComplete: boolean
  continuedPlayerIds: string[]
  requiredPlayerIds: string[]
}

export type RevealFlags = {
  revealHand: boolean
  revealFaceDown: boolean
  showPointsBanner: boolean
  points: number
  isWinner: boolean
}
