import { describe, expect, it } from 'vitest'
import { normalizePlayerCount, PLAYER_COUNT_OPTIONS } from './playerCount'

describe('playerCount', () => {
  it('offers player counts from 2 to 10', () => {
    expect(PLAYER_COUNT_OPTIONS).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('normalizes values to the valid range', () => {
    expect(normalizePlayerCount(1)).toBe(2)
    expect(normalizePlayerCount(4.7)).toBe(5)
    expect(normalizePlayerCount(12)).toBe(10)
  })
})
