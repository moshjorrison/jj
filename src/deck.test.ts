import { describe, expect, it } from 'vitest'
import { buildDeck, deckCountForPlayers } from './deck'

describe('deckCountForPlayers', () => {
  it('uses two decks for a 2-player game', () => {
    expect(deckCountForPlayers(2)).toBe(2)
    expect(buildDeck(2).length).toBe(108)
  })
})
