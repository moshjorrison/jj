import {
  clearWouldLeaveMatchingCards,
  getCardScore,
  getRankValue,
  getTopCard,
  isClear,
  isFourOfAKindClear,
  isSpecialClear,
  listLegalPlays,
  listOverplayOptions,
  unincludedMatchingPicks,
} from './gameLogic'
import {
  endTurn,
  flipFaceDown,
  playCards,
  playIntentionalOverplay,
  type PlayResult,
} from './gameState'
import { resolveCardsFromPicks } from './gameTable/utils'
import type { Card, CardPick, GameState, Player, Rank } from './types'

export type AiStep = {
  state: GameState
  message: string
  delayMs?: number
  cleared?: boolean
  badFlip?: boolean
  blocked?: boolean
  playedCards?: Card[]
}

function playResultStep(
  result: PlayResult,
  message: string,
  delayMs: number,
  playedCards?: Card[]
): AiStep {
  return {
    state: result.state,
    message,
    delayMs,
    cleared: result.cleared,
    badFlip: result.badFlip,
    blocked: result.blocked,
    playedCards,
  }
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

function getAvailableFaceDownIndices(player: Player): number[] {
  return player.faceDown.flatMap((card, idx) =>
    card && !player.faceUp[idx] ? [idx] : []
  )
}

function getTopPileRunLength(pile: Card[]): number {
  if (pile.length === 0) return 0
  const top = getTopCard(pile)
  if (!top || isSpecialClear(top)) return 0

  let count = 0
  for (let i = pile.length - 1; i >= 0; i -= 1) {
    if (pile[i].rank !== top.rank) break
    count += 1
  }
  return count
}

function buildPlayPicks(
  player: Player,
  state: GameState,
  cards: { pick: CardPick; card: Card }[]
): CardPick[] {
  let picks = cards.map((x) => x.pick)
  const played = cards.map((x) => x.card)
  const rank = played[0]?.rank
  if (!rank) return picks

  const nextPile = [...state.activePile, ...played]
  if (isFourOfAKindClear(nextPile, played)) {
    const extras = unincludedMatchingPicks(player, picks, state.turnRank ?? rank)
    if (extras.length > 0) picks = [...picks, ...extras]
  }

  return picks
}

function isBlockedPlay(
  player: Player,
  state: GameState,
  picks: CardPick[]
): boolean {
  const cards = resolveCardsFromPicks(player, picks)
  if (cards.length !== picks.length) return true
  return clearWouldLeaveMatchingCards(state, player, picks, cards)
}

type PlayOption = {
  picks: CardPick[]
  cards: Card[]
  score: number
}

function scorePlayableRank(
  state: GameState,
  player: Player,
  rank: string,
  cards: { pick: CardPick; card: Card }[],
  resolved: Card[]
): number {
  const cardCount = resolved.length
  const rankValue = getRankValue(rank as Rank)
  const pilePoints = getPilePointValue(state.activePile)
  const progress = estimateGameProgress(state)
  const topRun = getTopPileRunLength(state.activePile)
  const top = getTopCard(state.activePile)
  const nextPile = [...state.activePile, ...resolved]
  const wouldClear =
    resolved.length > 0 &&
    (isClear(nextPile, resolved) || resolved.some((c) => isSpecialClear(c)))

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
  score += rankValue * 5
  score += Math.min(pilePoints, 35) * 0.4

  if (wouldClear) {
    score += 180
    if (isFourOfAKindClear(nextPile, resolved)) score += 100
  } else if (top?.rank === rank && topRun >= 2) {
    score -= 65
  }

  if (topRun === 3 && top?.rank === rank && cardCount > 0) {
    score += 200
  }

  const knownCounts = getRankCounts(getAllKnownCards(player))
  const totalRankCount = knownCounts.get(rank as Rank) ?? 0
  if (totalRankCount + state.activePile.filter((c) => c.rank === rank).length >= 4) {
    score += 55
  }

  if (progress > 0.65) {
    score += rankValue * 2
  }

  return score
}

function listRankedPlayOptions(player: Player, state: GameState): PlayOption[] {
  const legal = listLegalPlays(player, state.activePile, state.turnRank)
  if (legal.length === 0) return []

  const knownLegal = legal.filter(({ pick }) => pick.zone !== 'faceDown')
  const playable = knownLegal.length > 0 ? knownLegal : legal

  const byRank = groupByRank(playable)
  const options: PlayOption[] = []

  for (const [rank, cards] of byRank.entries()) {
    const picks = buildPlayPicks(player, state, cards)
    const resolved = resolveCardsFromPicks(player, picks)
    if (resolved.length !== picks.length) continue
    if (isBlockedPlay(player, state, picks)) continue

    options.push({
      picks,
      cards: resolved,
      score: scorePlayableRank(state, player, rank, cards, resolved),
    })
  }

  return options.sort((a, b) => b.score - a.score)
}

function shouldPlayMoreMatchingCards(
  player: Player,
  state: GameState,
  legal: { pick: CardPick; card: Card }[]
): boolean {
  if (state.turnRank === null || legal.length === 0) return true

  const matching = legal.filter(({ card }) => card.rank === state.turnRank)
  if (matching.length === 0) return false

  const picks = buildPlayPicks(player, state, matching)
  const resolved = resolveCardsFromPicks(player, picks)
  const nextPile = [...state.activePile, ...resolved]
  if (isClear(nextPile, resolved)) return true

  const pilePoints = getPilePointValue(state.activePile)
  if (pilePoints >= 28) return false

  return resolved.length <= 2 || pilePoints < 18
}

function scoreFaceDownFlip(state: GameState, player: Player): number {
  const pile = state.activePile
  const pilePoints = getPilePointValue(pile)
  const top = getTopCard(pile)
  let score = 0

  if (pile.length === 0) score += 100
  if (pilePoints >= 40) score -= 85
  if (top && !isSpecialClear(top)) score -= getRankValue(top.rank) * 6
  if (getPlayerCardCount(player) <= 4) score += 40
  if (player.hand.length === 0 && player.faceUp.filter(Boolean).length === 0) {
    score += 35
  }

  return score
}

function shouldFlipFaceDown(player: Player, state: GameState): boolean {
  if (getAvailableFaceDownIndices(player).length === 0) return false
  return scoreFaceDownFlip(state, player) >= 0
}

function pickBestFaceDownIndex(player: Player, state: GameState): number {
  const indices = getAvailableFaceDownIndices(player)
  if (indices.length === 0) return -1
  return indices[0]
}

function shouldPreferFaceDownOverOverplay(
  player: Player,
  state: GameState,
  overplayPick: CardPick | null
): boolean {
  if (!shouldFlipFaceDown(player, state)) return false
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
  const legal = listLegalPlays(player, state.activePile, state.turnRank)

  if (
    state.turnRank !== null &&
    legal.length > 0 &&
    !shouldPlayMoreMatchingCards(player, state, legal)
  ) {
    return {
      state: endTurn(state, playerId),
      message: `${player.name} ended their turn.`,
      delayMs: 500,
    }
  }

  for (const option of listRankedPlayOptions(player, state)) {
    const result = playCards(state, playerId, option.picks)
    if (!result || result.blocked) continue

    if (result.cleared) {
      return playResultStep(
        result,
        `${player.name} cleared the pile!`,
        700,
        option.cards
      )
    }

    if (state.turnRank === null) {
      return playResultStep(
        result,
        `${player.name} played ${option.cards.length} card(s).`,
        700,
        option.cards
      )
    }

    return playResultStep(
      result,
      `${player.name} continued with ${option.cards.length} more.`,
      600,
      option.cards
    )
  }

  if (state.turnRank === null) {
    const faceDownIdx = shouldFlipFaceDown(player, state)
      ? pickBestFaceDownIndex(player, state)
      : -1
    if (faceDownIdx >= 0) {
      const flippedCard = player.faceDown[faceDownIdx]
      const result = flipFaceDown(state, playerId, faceDownIdx)
      if (result) {
        const playedCards = flippedCard ? [flippedCard] : undefined

        if (result.badFlip) {
          return playResultStep(
            result,
            `${player.name} flipped too high and picked up the pile.`,
            950,
            playedCards
          )
        }

        if (result.cleared) {
          return playResultStep(
            result,
            `${player.name} flipped a clear card!`,
            950,
            playedCards
          )
        }

        return playResultStep(
          result,
          `${player.name} flipped a face-down card.`,
          950,
          playedCards
        )
      }
    }

    const overplayPick = pickBestOverplay(player, state)
    const mustOverplay = legal.length === 0 && !!overplayPick
    if (overplayPick && (mustOverplay || shouldOverplay(player, state, overplayPick))) {
      const overplayCard = getCardsFromPick(player, overplayPick)
      const result = playIntentionalOverplay(state, playerId, overplayPick)
      if (result) {
        return playResultStep(
          result,
          result.message,
          800,
          overplayCard ? [overplayCard] : undefined
        )
      }
    }

    return null
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

/** Auto-play one step for any seated player (online timer / disconnect). */
export function runAutoPlayForPlayer(
  state: GameState,
  playerId: string
): AiStep | null {
  if (state.phase !== 'playing') return null
  const player = state.players.find((p) => p.id === playerId)
  if (!player) return null
  return runAiTurnOnce(state, player)
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