import { sortHand } from './gameLogic'
import {
  CARDS_PER_DECK,
  CARDS_PER_PLAYER,
  MIN_PLAYERS,
} from './constants'
import type { Card, Rank, Suit, TableSlot } from './types'

const SUITS: Exclude<Suit, 'joker'>[] = ['hearts', 'diamonds', 'clubs', 'spades']
const RANKS: Exclude<Rank, 'Joker'>[] = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
]

export function shuffle<T>(items: T[]): T[] {
  const arr = [...items]
  const cryptoObj = globalThis.crypto

  if (!cryptoObj?.getRandomValues) {
    throw new Error('Secure random generator not available')
  }

  const randomInt = (maxExclusive: number) => {
    if (maxExclusive <= 0) return 0

    const uint32Max = 0x100000000
    const limit = uint32Max - (uint32Max % maxExclusive)
    const buffer = new Uint32Array(1)

    let value = 0
    do {
      cryptoObj.getRandomValues(buffer)
      value = buffer[0]
    } while (value >= limit)

    return value % maxExclusive
  }

  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }

  return arr
}

function buildStandardDeck(deckId: number, includeJokers: boolean): Card[] {
  const cards: Card[] = []

  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({ rank, suit, deckId })
    }
  }

  if (includeJokers) {
    cards.push({ rank: 'Joker', suit: 'joker', jokerColor: 'red', deckId })
    cards.push({ rank: 'Joker', suit: 'joker', jokerColor: 'black', deckId })
  }

  return cards
}

/** Scale decks to fit player count (min 2 decks for 2–4 players). */
export function deckCountForPlayers(playerCount: number): number {
  const safeCount = Math.max(MIN_PLAYERS, playerCount)
  const cardsNeeded = safeCount * CARDS_PER_PLAYER
  return Math.max(2, Math.ceil(cardsNeeded / CARDS_PER_DECK))
}

export function buildDeck(playerCount: number): Card[] {
  const deckCount = deckCountForPlayers(playerCount)
  const cards: Card[] = []

  for (let deckId = 1; deckId <= deckCount; deckId++) {
    cards.push(...buildStandardDeck(deckId, true))
  }

  return shuffle(cards)
}

export function collectCardsForReshuffle(
  players: { hand: Card[]; faceUp: TableSlot[]; faceDown: TableSlot[] }[],
  sidelinedCards: Card[],
  activePile: Card[]
): Card[] {
  const pool: Card[] = [...sidelinedCards, ...activePile]

  for (const player of players) {
    pool.push(...player.hand)
    for (const card of player.faceUp) {
      if (card) pool.push(card)
    }
    for (const card of player.faceDown) {
      if (card) pool.push(card)
    }
  }

  return pool
}

export function dealCards(playerCount: number, existingPool?: Card[]) {
  const deck = existingPool?.length
    ? shuffle([...existingPool])
    : buildDeck(playerCount)

  const hands: Card[][] = Array.from({ length: playerCount }, () => [])
  const faceUps: TableSlot[][] = Array.from({ length: playerCount }, () =>
    Array.from({ length: 4 }, () => undefined)
  )
  const faceDowns: TableSlot[][] = Array.from({ length: playerCount }, () =>
    Array.from({ length: 4 }, () => undefined)
  )

  for (let r = 0; r < 4; r++) {
    for (let p = 0; p < playerCount; p++) {
      faceDowns[p][r] = deck.pop()!
    }
  }

  for (let r = 0; r < 4; r++) {
    for (let p = 0; p < playerCount; p++) {
      faceUps[p][r] = deck.pop()!
    }
  }

  for (let r = 0; r < 11; r++) {
    for (let p = 0; p < playerCount; p++) {
      hands[p].push(deck.pop()!)
    }
  }
  const sortedHands = hands.map((hand) => sortHand(hand))
  const sideline = deck

  return { hands: sortedHands, faceUps, faceDowns, sideline }
}
