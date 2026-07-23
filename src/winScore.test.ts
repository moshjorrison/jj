import { describe, expect, it } from 'vitest'
import { normalizeWinScore, WIN_SCORE_OPTIONS } from './winScore'

describe('winScore', () => {
  it('offers scores from 100 to 1000 in steps of 100', () => {
    expect(WIN_SCORE_OPTIONS).toEqual([
      100, 200, 300, 400, 500, 600, 700, 800, 900, 1000,
    ])
  })

  it('normalizes values to the nearest valid score', () => {
    expect(normalizeWinScore(250)).toBe(300)
    expect(normalizeWinScore(50)).toBe(100)
    expect(normalizeWinScore(1500)).toBe(1000)
  })
})
