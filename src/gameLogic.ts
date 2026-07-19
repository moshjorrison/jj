import type { Card, CardPick, Player, Rank, TableSlot } from './types'
import { RANK_ORDER } from './constants'

const SPECIAL_CLEAR_RANKS: ReadonlySet<Rank> = new Set(['J', 'Joker'])

const HAND_SORT_ORDER: Record<Rank, number> = {
  J: 0,
  Joker: 1,
  A: 2,
  '2': 3,
  '3': 4,
  '4': 5,
  '5': 6,
  '6': 7,
  '7': 8,
  '8': 9,
  '9': 10,
  '10': 11,
  Q: 12,
  K: 13,
}

export function cardsEqual(a: Card, b: Card): boolean {
  return (
    a.rank === b.rank &&
    a.suit === b.suit &&
    a.deckId === b.deckId &&
    a.jokerColor === b.jokerColor
  )
}

export function getRankValue(rank: Rank): number {
  if (rank === 'J' || rank === 'Joker') return -1
  return RANK_ORDER.indexOf(rank)
}

export function isSpecialClear(card: Card): boolean {
  return SPECIAL_CLEAR_RANKS.has(card.rank)
}

export function getTopCard(pile: Card[]): Card | null {
  return pile.length > 0 ? pile[pile.length - 1] : null
}

export function canPlay(card: Card, pile: Card[]): boolean {
  if (isSpecialClear(card)) return true

  const top = getTopCard(pile)
  if (!top) return true
  if (isSpecialClear(top)) return true

  return getRankValue(card.rank) <= getRankValue(top.rank)
}

export function isIntentionalOverplay(card: Card, pile: Card[]): boolean {
  if (pile.length === 0) return false
  if (isSpecialClear(card)) return false

  const top = getTopCard(pile)
  if (!top || isSpecialClear(top)) return false

  return getRankValue(card.rank) > getRankValue(top.rank)
}

export function checkFourOfAKind(pile: Card[]): boolean {
  if (pile.length < 4) return false

  const top = getTopCard(pile)
  if (!top) return false
  if (isSpecialClear(top)) return false

  let consecutive = 0
  for (let i = pile.length - 1; i >= 0; i -= 1) {
    if (pile[i].rank !== top.rank) break
    consecutive += 1
  }

  return consecutive >= 4
}

export function isClear(pile: Card[], played: Card[]): boolean {
  if (played.length === 0) return false

  const topPlayed = played[played.length - 1]
  if (isSpecialClear(topPlayed)) return true

  return checkFourOfAKind(pile)
}

export function isFaceDownAvailable(
  player: Pick<Player, 'faceUp'>,
  faceDownIndex: number
): boolean {
  return !player.faceUp[faceDownIndex]
}

export function countLiveCards(cards: TableSlot[]): number {
  return cards.filter(Boolean).length
}

export function getCardScore(card: Card): number {
  switch (card.rank) {
    case 'A':
      return 1
    case '2':
      return 2
    case '3':
      return 3
    case '4':
      return 4
    case '5':
      return 5
    case '6':
      return 6
    case '7':
      return 7
    case '8':
      return 8
    case '9':
      return 9
    case '10':
      return 10
    case 'J':
      return 50
    case 'Q':
      return 10
    case 'K':
      return 10
    case 'Joker':
      return 50
    default:
      return 0
  }
}

export function scoreRemainingCards(
  player: Pick<Player, 'hand' | 'faceUp' | 'faceDown'>
): number {
  const handScore = player.hand.reduce((sum, card) => sum + getCardScore(card), 0)
  const faceUpScore = player.faceUp.reduce(
    (sum, card) => sum + (card ? getCardScore(card) : 0),
    0
  )
  const faceDownScore = player.faceDown.reduce(
    (sum, card) => sum + (card ? getCardScore(card) : 0),
    0
  )

  return handScore + faceUpScore + faceDownScore
}

export function sortHand(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const rankDiff = HAND_SORT_ORDER[a.rank] - HAND_SORT_ORDER[b.rank]
    if (rankDiff !== 0) return rankDiff

    const suitA = a.suit ?? ''
    const suitB = b.suit ?? ''
    if (suitA !== suitB) return suitA.localeCompare(suitB)

    return (a.deckId ?? 0) - (b.deckId ?? 0)
  })
}

export function getCardAt(player: Player, pick: CardPick): Card | null {
  if (pick.zone === 'hand') return player.hand[pick.index] ?? null
  if (pick.zone === 'faceUp') return player.faceUp[pick.index] ?? null

  const card = player.faceDown[pick.index] ?? null
  if (!card) return null
  if (!isFaceDownAvailable(player, pick.index)) return null

  return card
}

export function listPlayableCards(player: Player): { pick: CardPick; card: Card }[] {
  const handCards = player.hand.map((card, index) => ({
    pick: { zone: 'hand' as const, index },
    card,
  }))

  const faceUpCards = player.faceUp
    .map((card, index) =>
      card ? { pick: { zone: 'faceUp' as const, index }, card } : null
    )
    .filter((x): x is { pick: CardPick; card: Card } => x !== null)

  const faceDownCards = player.faceDown
    .map((card, index) =>
      card && isFaceDownAvailable(player, index)
        ? { pick: { zone: 'faceDown' as const, index }, card }
        : null
    )
    .filter((x): x is { pick: CardPick; card: Card } => x !== null)

  return [...handCards, ...faceUpCards, ...faceDownCards]
}

export function listLegalPlays(
  player: Player,
  pile: Card[],
  turnRank: Rank | null
): { pick: CardPick; card: Card }[] {
  const cards = listPlayableCards(player)

  if (turnRank !== null) {
    return cards.filter(({ pick, card }) => {
      if (pick.zone === 'faceDown') return false
      return card.rank === turnRank
    })
  }

  return cards.filter(({ pick, card }) => {
    if (pick.zone === 'faceDown') return true
    return canPlay(card, pile)
  })
}

export function listOverplayOptions(
  player: Player,
  pile: Card[],
  turnRank: Rank | null
): { pick: CardPick; card: Card }[] {
  if (turnRank !== null) return []

  return listPlayableCards(player).filter(({ pick, card }) => {
    if (pick.zone === 'faceDown') return false
    return isIntentionalOverplay(card, pile)
  })
}

export function flippedCardIsTooHigh(card: Card, pile: Card[]): boolean {
  if (pile.length === 0) return false

  const top = getTopCard(pile)
  if (!top) return false
  if (isSpecialClear(top) || isSpecialClear(card)) return false

  return getRankValue(card.rank) > getRankValue(top.rank)
}

export function canStartMultiPlayWithPick(player: Player, pick: CardPick): boolean {
  const card = getCardAt(player, pick)
  return !!card
}

export function canAddToMultiPlay(
  player: Player,
  pick: CardPick,
  leadRank: Rank,
  firstPick: CardPick
): boolean {
  const card = getCardAt(player, pick)
  if (!card) return false
  if (card.rank !== leadRank) return false

  if (pick.zone === 'faceDown') {
    return firstPick.zone === 'faceDown' && pick.index === firstPick.index
  }

  return true
}

export function playerHasNoCards(player: Player): boolean {
  return (
    player.hand.length === 0 &&
    !player.faceUp.some(Boolean) &&
    !player.faceDown.some(Boolean)
  )
}

export function getWinnerIds(players: Player[]): string[] {
  const minScore = Math.min(...players.map((p) => p.score))
  return players.filter((p) => p.score === minScore).map((p) => p.id)
}

export function getLoserIds(players: Player[]): string[] {
  return players.filter((p) => p.score >= 200).map((p) => p.id)
}