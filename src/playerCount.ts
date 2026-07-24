import { MAX_ONLINE_PLAYERS, MIN_PLAYERS } from './constants'

export const DEFAULT_PLAYER_COUNT = 4
export const MIN_PLAYER_COUNT = MIN_PLAYERS
export const MAX_PLAYER_COUNT = MAX_ONLINE_PLAYERS

export const PLAYER_COUNT_OPTIONS = Array.from(
  { length: MAX_PLAYER_COUNT - MIN_PLAYER_COUNT + 1 },
  (_, i) => MIN_PLAYER_COUNT + i
)

export function normalizePlayerCount(value: number): number {
  const rounded = Math.round(value)
  return Math.min(MAX_PLAYER_COUNT, Math.max(MIN_PLAYER_COUNT, rounded))
}
