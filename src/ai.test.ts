import { describe, expect, it } from 'vitest'
import { runAiStep } from './ai'
import { cardsForPlayAnimation } from './gameTable/utils'
import { isClear } from './gameLogic'
import { playCards, startGame } from './gameState'
import type { Card, CardPick } from './types'

function card(rank: Card['rank'], suit: Card['suit'] = 'hearts', deckId = 0): Card {
  return { rank, suit, deckId }
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

  it('retries blocked multi-card clears with a single card', () => {
    let state = startGame(2, 'ai')
    const bot = state.players.find((p) => !p.isHuman)!
    const rank = '6' as const

    const matching = bot.hand
      .map((c, index) => ({ c, index }))
      .filter(({ c }) => c.rank === rank)
    if (matching.length < 2) return

    state = {
      ...state,
      currentPlayerId: bot.id,
      activePile: [
        card(rank, 'diamonds', 90),
        card(rank, 'clubs', 91),
        card(rank, 'spades', 92),
      ],
      turnRank: rank,
      turnSource: 'hand',
      formTurnUsed: true,
    }

    const picks: CardPick[] = matching.slice(0, 1).map(({ index }) => ({
      zone: 'hand',
      index,
    }))
    const partial = playCards(state, bot.id, picks)
    expect(partial?.blocked).toBeFalsy()
  })
})
