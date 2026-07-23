import { describe, expect, it } from 'vitest'
import { runAiStep } from './ai'
import { cardsForPlayAnimation } from './gameTable/utils'
import { isClear } from './gameLogic'
import { createSetupState, playCards, startGame } from './gameState'
import type { Card, GameState, Player } from './types'

function card(rank: Card['rank'], suit: Card['suit'] = 'hearts', deckId = 0): Card {
  return { rank, suit, deckId }
}

function botPlayer(id: string, hand: Card[]): Player {
  return {
    id,
    name: id,
    seat: 'left',
    hand,
    faceUp: [undefined, undefined, undefined, undefined],
    faceDown: [undefined, undefined, undefined, undefined],
    score: 0,
    isHuman: false,
  }
}

function aiTurnState(
  bot: Player,
  activePile: Card[],
  overrides: Partial<GameState> = {}
): GameState {
  const base = createSetupState(4, 'ai')
  const players = base.players.map((p) =>
    p.id === bot.id ? bot : { ...p, isHuman: p.id === 'player-0' }
  )

  return {
    ...base,
    phase: 'playing',
    players,
    currentPlayerId: bot.id,
    activePile,
    sidelinedCards: [],
    turnRank: null,
    turnSource: null,
    formTurnUsed: false,
    ...overrides,
  }
}

describe('cardsForPlayAnimation', () => {
  it('returns played cards when a clear empties the pile', () => {
    const prev = [card('7', 'spades', 1)]
    const played = [card('J', 'hearts', 2)]
    expect(cardsForPlayAnimation(prev, [], played)).toEqual(played)
  })
})

describe('runAiStep', () => {
  it('only reports cleared when playCards clears the pile', () => {
    let state = startGame(4, 'ai')
    const opener = state.players[0]
    const openerRank = opener.hand[0]?.rank
    if (!openerRank || openerRank === 'J' || openerRank === 'Joker') return

    const open = playCards(state, opener.id, [{ zone: 'hand', index: 0 }])
    expect(open).not.toBeNull()
    state = open!.state
    state = {
      ...state,
      currentPlayerId: state.players[1].id,
      turnRank: null,
      turnSource: null,
      formTurnUsed: false,
    }

    const step = runAiStep(state)
    expect(step).not.toBeNull()

    const played = step!.playedCards ?? []
    const nextPile = [...state.activePile, ...played]
    const shouldClear = played.length > 0 && isClear(nextPile, played)

    expect(!!step!.cleared).toBe(shouldClear)
    if (step!.cleared) {
      expect(step!.state.activePile).toHaveLength(0)
    }
  })

  it('plays all matching cards to clear a four-of-a-kind pile', () => {
    const rank = '8' as const
    const bot = botPlayer('player-1', [
      card(rank, 'hearts', 10),
      card(rank, 'diamonds', 11),
      card('3', 'clubs', 12),
    ])
    const state = aiTurnState(bot, [
      card(rank, 'spades', 1),
      card(rank, 'clubs', 2),
      card(rank, 'diamonds', 3),
    ])

    const step = runAiStep(state)
    expect(step).not.toBeNull()
    expect(step!.cleared).toBe(true)
    expect(step!.playedCards?.filter((c) => c.rank === rank)).toHaveLength(2)
    expect(step!.state.activePile).toHaveLength(0)
  })

  it('respects turn rank when continuing a turn', () => {
    const rank = '5' as const
    const bot = botPlayer('player-2', [
      card(rank, 'hearts', 20),
      card('9', 'spades', 21),
    ])
    const state = aiTurnState(
      bot,
      [card(rank, 'clubs', 1)],
      {
        turnRank: rank,
        turnSource: 'hand',
        formTurnUsed: true,
      }
    )

    const step = runAiStep(state)
    expect(step).not.toBeNull()
    expect(step!.playedCards?.every((c) => c.rank === rank)).toBe(true)
    expect(step!.playedCards).toHaveLength(1)
  })

  it('ends the turn when locked rank has no legal plays', () => {
    const bot = botPlayer('player-3', [card('4', 'hearts', 30)])
    const state = aiTurnState(
      bot,
      [card('7', 'clubs', 1)],
      {
        turnRank: '9',
        turnSource: 'hand',
        formTurnUsed: true,
      }
    )

    const step = runAiStep(state)
    expect(step).not.toBeNull()
    expect(step!.message).toMatch(/ended their turn/i)
    expect(step!.state.currentPlayerId).not.toBe(bot.id)
  })

  it('prefers a known legal play over flipping face-down', () => {
    const bot = botPlayer('player-1', [card('4', 'hearts', 40)])
    bot.faceDown = [
      card('K', 'spades', 41),
      undefined,
      undefined,
      undefined,
    ]
    const state = aiTurnState(bot, [card('9', 'clubs', 1)])

    const step = runAiStep(state)
    expect(step).not.toBeNull()
    expect(step!.playedCards?.[0]?.rank).toBe('4')
    expect(step!.badFlip).toBeFalsy()
  })
})
