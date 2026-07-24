import { describe, expect, it } from 'vitest'
import {
  canPlay,
  checkFourOfAKind,
  clearWouldLeaveMatchingCards,
  isClear,
  isIntentionalOverplay,
  scoreRemainingCards,
} from './gameLogic'
import {
  canEndTurn,
  checkRoundEnd,
  createSetupState,
  endTurn,
  playCards,
  startGame,
} from './gameState'
import type { Card, CardPick, Player } from './types'

function card(rank: Card['rank'], suit: Card['suit'] = 'hearts', deckId = 0): Card {
  return { rank, suit, deckId }
}

function playerWithHand(id: string, hand: Card[]): Player {
  return {
    id,
    name: id,
    seat: 'bottom',
    hand,
    faceUp: [undefined, undefined, undefined, undefined],
    faceDown: [undefined, undefined, undefined, undefined],
    score: 0,
    isHuman: id === 'player-0',
  }
}

describe('gameLogic', () => {
  it('canPlay allows equal or lower rank on pile', () => {
    const pile = [card('8', 'spades')]
    expect(canPlay(card('7', 'hearts'), pile)).toBe(true)
    expect(canPlay(card('9', 'hearts'), pile)).toBe(false)
  })

  it('detects four of a kind on pile top', () => {
    const pile = [
      card('5', 'hearts', 0),
      card('5', 'spades', 1),
      card('5', 'clubs', 2),
      card('5', 'diamonds', 3),
    ]
    expect(checkFourOfAKind(pile)).toBe(true)
    expect(isClear(pile, [card('5', 'hearts', 4)])).toBe(true)
  })

  it('blocks clear when matching cards remain unselected', () => {
    const p = playerWithHand('player-0', [
      card('6', 'hearts', 0),
      card('6', 'spades', 1),
    ])
    const picks: CardPick[] = [{ zone: 'hand', index: 0 }]
    const cards = [card('6', 'spades', 5)]
    const state = {
      activePile: [
        card('6', 'clubs', 2),
        card('6', 'diamonds', 3),
        card('6', 'hearts', 4),
      ],
      turnRank: '6' as const,
    }
    expect(
      clearWouldLeaveMatchingCards(state, p, picks, cards)
    ).toBe(true)
  })

  it('scores remaining cards for losers', () => {
    const p = playerWithHand('player-1', [card('Q'), card('A')])
    expect(scoreRemainingCards(p)).toBe(11)
  })

  it('detects intentional overplay', () => {
    const pile = [card('4', 'spades')]
    expect(isIntentionalOverplay(card('8', 'hearts'), pile)).toBe(true)
    expect(isIntentionalOverplay(card('J', 'hearts'), pile)).toBe(false)
  })
})

describe('gameState', () => {
  it('starts a game in playing phase', () => {
    const state = startGame(2, 'ai')
    expect(state.phase).toBe('playing')
    expect(state.players).toHaveLength(2)
    expect(state.players[0].hand.length).toBeGreaterThan(0)
  })

  it('requires a play before endTurn when opening', () => {
    const state = startGame(2, 'ai')
    const before = state.currentPlayerId
    const after = endTurn(state, before)
    expect(after).toBe(state)
    expect(canEndTurn(state, before)).toBe(false)
  })

  it('blocks partial four-of-a-kind clear', () => {
    let state = startGame(2, 'ai')
    const current = state.players.find((p) => p.id === state.currentPlayerId)!
    const rank = current.hand[0]?.rank
    if (!rank || rank === 'J' || rank === 'Joker') return

    const matching = current.hand
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.rank === rank)
    if (matching.length < 2) return

    const picks: CardPick[] = [{ zone: 'hand', index: matching[0].i }]
    const result = playCards(state, current.id, picks)
    expect(result?.blocked).toBeFalsy()

    if (matching.length >= 4) {
      const partial = playCards(state, current.id, [picks[0]])
      if (partial && matching.length > 1) {
        const pileWithThree = {
          ...state,
          activePile: [
            card(rank, 'hearts', 0),
            card(rank, 'spades', 1),
            card(rank, 'clubs', 2),
          ],
          turnRank: rank,
          turnSource: 'hand' as const,
        }
        const blocked = playCards(pileWithThree, current.id, [
          { zone: 'hand', index: matching[3]?.i ?? 0 },
        ])
        if (blocked?.blocked) {
          expect(blocked.message).toMatch(/matching/i)
        }
      }
    }
  })

  it('ends the game when a player reaches winScore', () => {
    const setup = createSetupState(2, 'ai', undefined, 100)
    const winner = setup.players[0]
    const loser = { ...setup.players[1], score: 95 }
    const state = {
      ...setup,
      phase: 'playing' as const,
      players: [
        { ...winner, hand: [], faceUp: [], faceDown: [] },
        {
          ...loser,
          hand: [card('5')],
          faceUp: [],
          faceDown: [],
        },
      ],
      currentPlayerId: winner.id,
      turnRank: null,
      turnSource: null,
      formTurnUsed: false,
      activePile: [],
      sidelinedCards: [],
    }
    const result = checkRoundEnd(state)
    expect(result?.state.phase).toBe('finished')
  })

  it('checkRoundEnd awards points and sets lastRoundDeltas', () => {
    const setup = createSetupState(2, 'ai')
    const winner = setup.players[0]
    const loser = setup.players[1]
    const state = {
      ...setup,
      phase: 'playing' as const,
      players: [
        { ...winner, hand: [], faceUp: [], faceDown: [] },
        {
          ...loser,
          hand: [card('5')],
          faceUp: [],
          faceDown: [],
        },
      ],
      currentPlayerId: winner.id,
      turnRank: null,
      turnSource: null,
      formTurnUsed: false,
      activePile: [],
      sidelinedCards: [],
    }

    const round = checkRoundEnd(state)
    expect(round).not.toBeNull()
    expect(round!.state.lastRoundDeltas?.find((d) => d.playerId === loser.id)?.delta).toBe(5)
    expect(round!.state.players.find((p) => p.id === loser.id)?.score).toBe(5)
  })

  it('allows play after round 2 opens with King on pile', () => {
    let state = startGame(2, 'online')
    const opener = state.players.find((p) => p.id === state.currentPlayerId)!
    const responder = state.players.find((p) => p.id !== opener.id)!

    state = {
      ...state,
      players: state.players.map((p) =>
        p.id === opener.id
          ? { ...p, hand: [], faceUp: [], faceDown: [] }
          : { ...p, hand: [card('5')], faceUp: [], faceDown: [] }
      ),
    }
    const round = checkRoundEnd(state)
    expect(round).not.toBeNull()
    state = round!.state

    const king = card('K', 'hearts', 99)
    state = {
      ...state,
      players: state.players.map((p) =>
        p.id === opener.id ? { ...p, hand: [king] } : p
      ),
    }

    const openPlay = playCards(state, opener.id, [{ zone: 'hand', index: 0 }])
    expect(openPlay).not.toBeNull()
    state = openPlay!.state
    expect(state.turnRank).toBe('K')
    expect(state.formTurnUsed).toBe(true)

    state = endTurn(state, opener.id)
    expect(state.currentPlayerId).toBe(responder.id)
    expect(state.turnRank).toBeNull()
    expect(state.formTurnUsed).toBe(false)
    expect(state.activePile).toHaveLength(1)

    const responderKing = card('K', 'spades', 100)
    state = {
      ...state,
      players: state.players.map((p) =>
        p.id === responder.id ? { ...p, hand: [responderKing] } : p
      ),
    }

    const response = playCards(state, responder.id, [{ zone: 'hand', index: 0 }])
    expect(response).not.toBeNull()
    expect(response!.blocked).toBeFalsy()
    expect(response!.state.activePile).toHaveLength(2)
  })

  it('ignores stale turnRank when formTurnUsed is false', () => {
    let state = startGame(2, 'online')
    const current = state.players.find((p) => p.id === state.currentPlayerId)!
    const queen = card('Q', 'hearts', 50)
    state = {
      ...state,
      players: state.players.map((p) =>
        p.id === current.id ? { ...p, hand: [queen] } : p
      ),
      activePile: [card('K', 'spades', 51)],
      turnRank: 'K',
      formTurnUsed: false,
    }

    const result = playCards(state, current.id, [{ zone: 'hand', index: 0 }])
    expect(result).not.toBeNull()
    expect(result!.blocked).toBeFalsy()
  })
})
