import type { Card, CardPick, GameMode, Player, Seat } from '../types'
import { isFaceDownAvailable } from '../gameLogic'

export function flipFlyDurationMs(
  card: Card,
  flipFlyMs: number,
  flipFlyJackMs: number
): number {
  if (card.rank === 'J' || card.rank === 'Joker') return flipFlyJackMs
  return flipFlyMs
}

export function requiredContinuePlayerIds(
  players: Player[],
  mode: GameMode
): string[] {
  if (mode === 'ai') {
    return players.filter((p) => p.isHuman).map((p) => p.id)
  }
  return players.map((p) => p.id)
}

export function seatRotation(seat: Seat, cardFaceRotation: (s: Seat) => number) {
  return cardFaceRotation(seat)
}

export function cardMatches(a: Card, b: Card) {
  return (
    a.rank === b.rank &&
    a.suit === b.suit &&
    a.deckId === b.deckId &&
    a.jokerColor === b.jokerColor
  )
}

export function resolveCardsFromPicks(player: Player, picks: CardPick[]): Card[] {
  return picks
    .map((pick) => {
      if (pick.zone === 'hand') return player.hand[pick.index] ?? null
      if (pick.zone === 'faceUp') return player.faceUp[pick.index] ?? null
      if (pick.zone === 'faceDown') {
        if (!isFaceDownAvailable(player, pick.index)) return null
        return player.faceDown[pick.index] ?? null
      }
      return null
    })
    .filter((card): card is Card => !!card)
}

export function cardsAddedToPile(prev: Card[], next: Card[]) {
  const remaining = [...prev]
  const added: Card[] = []

  for (const card of next) {
    const matchIndex = remaining.findIndex((c) => cardMatches(c, card))
    if (matchIndex >= 0) {
      remaining.splice(matchIndex, 1)
    } else {
      added.push(card)
    }
  }

  return added
}

export function cardsForPlayAnimation(
  prevPile: Card[],
  nextPile: Card[],
  playedCards: Card[]
) {
  const added = cardsAddedToPile(prevPile, nextPile)
  return added.length > 0 ? added : playedCards
}

export function roundPenaltyPoints(player: Player) {
  const allCards = [
    ...player.hand,
    ...player.faceUp.filter((c): c is Card => !!c),
    ...player.faceDown.filter((c): c is Card => !!c),
  ]

  return allCards.reduce((sum, card) => {
    if (card.rank === 'Joker') return sum + 50
    if (card.rank === 'J') return sum + 50
    if (card.rank === 'Q') return sum + 10
    if (card.rank === 'K') return sum + 10
    if (card.rank === 'A') return sum + 1
    return sum + Number(card.rank)
  }, 0)
}
