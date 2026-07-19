import type { CardPick } from './types'

export function pickKey(pick: CardPick): string {
  return `${pick.zone}:${pick.index}`
}

export function parsePickKey(key: string): CardPick | null {
  const [zone, indexStr] = key.split(':')
  const index = Number(indexStr)
  if (zone !== 'hand' && zone !== 'faceUp' && zone !== 'faceDown') return null
  if (!Number.isInteger(index) || index < 0) return null
  return { zone, index }
}
