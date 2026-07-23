export const DEFAULT_WIN_SCORE = 200
export const MIN_WIN_SCORE = 100
export const MAX_WIN_SCORE = 1000
export const WIN_SCORE_STEP = 100

export const WIN_SCORE_OPTIONS = Array.from(
  { length: MAX_WIN_SCORE / WIN_SCORE_STEP },
  (_, i) => (i + 1) * WIN_SCORE_STEP
)

export function normalizeWinScore(value: number): number {
  const clamped = Math.min(MAX_WIN_SCORE, Math.max(MIN_WIN_SCORE, value))
  return Math.round(clamped / WIN_SCORE_STEP) * WIN_SCORE_STEP
}
