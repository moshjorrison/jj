import {
  getCardScore,
  getRankValue,
  isSpecialClear,
  listLegalPlays,
  listOverplayOptions,
} from './gameLogic'
import {
  endTurn,
  flipFaceDown,
  playCards,
  playIntentionalOverplay,
} from './gameState'
import type { Card, CardPick, GameState, Player, Rank } from './types'

export type AiStep = {
  state: GameState
  message: string
  delayMs?: number
}

function groupByRank<T extends { card: { rank: string } }>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const list = map.get(item.card.rank) ?? []
    list.push(item)
    map.set(item.card.rank, list)
  }
  return map
}

function getCardsFromPick(player: Player, pick: CardPick): Card | null {
  if (pick.zone === 'hand') return player.hand[pick.index] ?? null
  if (pick.zone === 'faceUp') return player.faceUp[pick.index] ?? null
  return player.faceDown[pick.index] ?? null
}

function getAllKnownCards(player: Player): Card[] {
  return [...player.hand, ...player.faceUp.filter((c): c is Card => !!c)]
}

function getRankCounts(cards: Card[]): Map<Rank, number> {
  const counts = new Map<Rank, number>()
  for (const card of cards) {
    counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1)
  }
  return counts
}

function getPilePointValue(pile: Card[]): number {
  return pile.reduce((sum, card) => sum + getCardScore(card), 0)
}

function getPlayerCardCount(player: Player): number {
  return (
    player.hand.length +
    player.faceUp.filter(Boolean).length +
    player.faceDown.filter(Boolean).length
  )
}

function estimateGameProgress(state: GameState): number {
  const total = state.players.reduce((sum, p) => sum + getPlayerCardCount(p), 0)
  const maxStartingCards = state.playerCount * 19
  return 1 - total / maxStartingCards
}

function isEarlyGame(state: GameState): boolean {
  return estimateGameProgress(state) < 0.4
}

function isLateGame(state: GameState): boolean {
  return estimateGameProgress(state) > 0.72
}

function rankWouldMakeFourPlus(player: Player, pickedUpPile: Card[], rank: Rank): boolean {
  const known = getAllKnownCards(player)
  const knownCount = known.filter((c) => c.rank === rank).length
  const pileCount = pickedUpPile.filter((c) => c.rank === rank).length
  return knownCount + pileCount >= 4
}

function overplayCreatesFutureFourPlus(
  player: Player,
  state: GameState,
  overplayCard: Card
): boolean {
  const pickupPile = [...state.activePile, overplayCard]
  const pileRanks = [...new Set(pickupPile.map((c) => c.rank))] as Rank[]
  return pileRanks.some((rank) => rankWouldMakeFourPlus(player, pickupPile, rank))
}

function isHighValueBurn(card: Card): boolean {
  return card.rank === 'J' || card.rank === 'Joker'
}

function getAvailableFaceDownIndex(player: Player): number {
  return player.faceDown.findIndex((card, idx) => !!card && !player.faceUp[idx])
}

function scorePlayableRank(
  state: GameState,
  player: Player,
  rank: string,
  cards: { pick: CardPick; card: Card }[]
): number {
  const cardCount = cards.length
  const rankValue = getRankValue(rank as Rank)
  const pilePoints = getPilePointValue(state.activePile)
  const progress = estimateGameProgress(state)

  let score = 0

  if (cards.some((x) => isSpecialClear(x.card))) {
    score += 220
    if (pilePoints <= 20 && !isLateGame(state)) score -= 120
    if (pilePoints >= 45) score += 80
    if (progress > 0.7) score += 60
    if (cardCount > 1) score += 20
    return score
  }

  score += cardCount * 55
  score += rankValue * 3
  score -= Math.max(0, rankValue) * 2.5
  score += Math.min(pilePoints, 35) * 0.4

  const knownCounts = getRankCounts(getAllKnownCards(player))
  const totalRankCount = knownCounts.get(rank as Rank) ?? 0
  if (totalRankCount + state.activePile.filter((c) => c.rank === rank).length >= 4) {
    score += 45
  }

  if (progress > 0.65) {
    score += rankValue * 2.5
  }

  return score
}

function pickBestPlayGroup(player: Player, state: GameState): CardPick[] | null {
  const legal = listLegalPlays(player, state.activePile, state.turnRank)
  if (legal.length === 0) return null

  const byRank = groupByRank(legal)

  const ranked = [...byRank.entries()]
    .map(([rank, cards]) => ({
      rank,
      cards,
      score: scorePlayableRank(state, player, rank, cards),
    }))
    .sort((a, b) => b.score - a.score)

  return ranked[0]?.cards.map((x) => x.pick) ?? null
}

function shouldPreferFaceDownOverOverplay(
  player: Player,
  state: GameState,
  overplayPick: CardPick | null
): boolean {
  const faceDownIdx = getAvailableFaceDownIndex(player)
  if (faceDownIdx < 0) return false
  if (!overplayPick) return true

  const overplayCard = getCardsFromPick(player, overplayPick)
  if (!overplayCard) return true

  const pilePoints = getPilePointValue(state.activePile)
  const early = isEarlyGame(state)
  const late = isLateGame(state)
  const createsFourPlus = overplayCreatesFutureFourPlus(player, state, overplayCard)
  const burnsHighValue = isHighValueBurn(overplayCard)

  if (late) return false
  if (burnsHighValue && pilePoints < 40) return true
  if (early && pilePoints < 25 && !createsFourPlus) return true
  if (early && pilePoints < 35 && burnsHighValue) return true

  return false
}

function shouldOverplay(player: Player, state: GameState, overplayPick: CardPick | null): boolean {
  if (!overplayPick) return false

  const card = getCardsFromPick(player, overplayPick)
  if (!card) return false

  const pilePoints = getPilePointValue(state.activePile)
  const progress = estimateGameProgress(state)
  const early = isEarlyGame(state)
  const late = isLateGame(state)
  const createsFourPlus = overplayCreatesFutureFourPlus(player, state, card)
  const burnsHighValue = isHighValueBurn(card)

  if (shouldPreferFaceDownOverOverplay(player, state, overplayPick)) return false

  let score = 0

  if (pilePoints <= 15) score += 50
  else if (pilePoints <= 30) score += 20
  else if (pilePoints >= 45) score -= 40

  if (createsFourPlus) score += early ? 70 : 25

  if (burnsHighValue) {
    score -= early ? 90 : late ? 20 : 50
  }

  score -= progress * 50

  const playerCardsLeft = getPlayerCardCount(player)
  if (playerCardsLeft <= 6) score -= 25
  if (playerCardsLeft >= 12 && early) score += 10

  return score > 15
}

function pickBestOverplay(player: Player, state: GameState): CardPick | null {
  const options = listOverplayOptions(player, state.activePile, state.turnRank)
  if (options.length === 0) return null

  const scored = options
    .map((option) => {
      const card = option.card
      const pilePoints = getPilePointValue(state.activePile)
      const createsFourPlus = overplayCreatesFutureFourPlus(player, state, card)
      const burnsHighValue = isHighValueBurn(card)
      const progress = estimateGameProgress(state)

      let score = 0

      if (pilePoints <= 15) score += 60
      else if (pilePoints <= 30) score += 25
      else score -= pilePoints * 1.2

      if (createsFourPlus) score += progress < 0.4 ? 70 : 25
      if (burnsHighValue) score -= progress < 0.4 ? 100 : 40

      score += getRankValue(card.rank) * 2

      return { pick: option.pick, score }
    })
    .sort((a, b) => b.score - a.score)

  return scored[0]?.pick ?? null
}

function runAiTurnOnce(state: GameState, player: Player): AiStep | null {
  const playerId = player.id

  const picks = pickBestPlayGroup(player, state)
  if (picks && picks.length > 0) {
    const result = playCards(state, playerId, picks)
    if (result) {
      if (result.cleared) {
        return {
          state: result.state,
          message: `${player.name} cleared the pile!`,
          delayMs: 700,
        }
      }

      if (state.turnRank === null) {
        return {
          state: result.state,
          message: `${player.name} played ${picks.length} card(s).`,
          delayMs: 700,
        }
      }

      return {
        state: result.state,
        message: `${player.name} continued with ${picks.length} more.`,
        delayMs: 600,
      }
    }
  }

  if (state.turnRank === null) {
    const faceDownIdx = getAvailableFaceDownIndex(player)
    if (faceDownIdx >= 0) {
      const result = flipFaceDown(state, playerId, faceDownIdx)
      if (result) {
        if (result.badFlip) {
          return {
            state: result.state,
            message: `${player.name} flipped too high and picked up the pile.`,
            delayMs: 950,
          }
        }

        if (result.cleared) {
          return {
            state: result.state,
            message: `${player.name} flipped a clear card!`,
            delayMs: 950,
          }
        }

        return {
          state: result.state,
          message: `${player.name} flipped a face-down card.`,
          delayMs: 950,
        }
      }
    }

    const overplayPick = pickBestOverplay(player, state)
    if (shouldOverplay(player, state, overplayPick)) {
      const result = playIntentionalOverplay(state, playerId, overplayPick!)
      if (result) {
        return {
          state: result.state,
          message: result.message,
          delayMs: 800,
        }
      }
    }
  }

  return {
    state: endTurn(state, playerId),
    message: `${player.name} ended their turn.`,
    delayMs: 500,
  }
}

export function runAiStep(state: GameState): AiStep | null {
  const current = state.players.find((p) => p.id === state.currentPlayerId)
  if (
    state.gameMode !== 'ai' ||
    !current ||
    current.isHuman ||
    state.phase !== 'playing'
  ) {
    return null
  }
  return runAiTurnOnce(state, current)
}

export function runAiTurnToCompletion(
  state: GameState,
  maxSteps = 12
): { state: GameState; messages: string[] } {
  let next = state
  const messages: string[] = []
  let steps = 0
  const startingPlayerId = state.currentPlayerId

  while (steps < maxSteps) {
    const current = next.players.find((p) => p.id === next.currentPlayerId)
    if (!current || current.isHuman) break

    const step = runAiStep(next)
    if (!step) break

    const previousPlayerId = next.currentPlayerId
    next = step.state
    messages.push(step.message)
    steps++

    if (next.currentPlayerId !== previousPlayerId) break
    if (next.currentPlayerId !== startingPlayerId) break
  }

  return { state: next, messages }
}