import { WIN_SCORE } from './constants'
import { collectCardsForReshuffle, dealCards } from './deck'
import {
  canPlay,
  flippedCardIsTooHigh,
  isClear,
  isFaceDownAvailable,
  isIntentionalOverplay,
  listLegalPlays,
  playerHasNoCards,
  scoreRemainingCards,
  sortHand,
} from './gameLogic'
import { createPlayers, orderPlayersFromWinner } from './seats'
import type { Card, CardPick, GameMode, GameState, Player, Rank } from './types'

function withDisplayName(player: Player): Player {
  return {
    ...player,
    name: player.id === 'player-0' ? 'You' : player.name,
  }
}

export function createSetupState(
  playerCount: number,
  gameMode: GameMode,
  playerNames?: string[]
): GameState {
  const players = createPlayers(playerCount, gameMode, playerNames).map(withDisplayName)

  return {
    players,
    activePile: [],
    sidelinedCards: [],
    currentPlayerId: players[0].id,
    roundStartPlayerId: players[0].id,
    phase: 'setup',
    playerCount,
    gameMode,
    formTurnUsed: false,
    turnRank: null,
    turnSource: null,
  }
}

export function startGame(
  playerCount: number,
  gameMode: GameMode,
  playerNames?: string[]
): GameState {
  const { hands, faceUps, faceDowns, sideline } = dealCards(playerCount)

  const players = createPlayers(playerCount, gameMode, playerNames)
    .map((player, i) => ({
      ...player,
      hand: sortHand(hands[i]),
      faceUp: faceUps[i],
      faceDown: faceDowns[i],
    }))
    .map(withDisplayName)

  return {
    players,
    activePile: [],
    sidelinedCards: sideline,
    currentPlayerId: players[0].id,
    roundStartPlayerId: players[0].id,
    phase: 'playing',
    playerCount,
    gameMode,
    formTurnUsed: false,
    turnRank: null,
    turnSource: null,
  }
}

export function getPlayer(state: GameState, playerId: string): Player {
  const player = state.players.find((p) => p.id === playerId)
  if (!player) throw new Error(`Unknown player: ${playerId}`)
  return player
}

export function advanceTurn(players: Player[], currentId: string): string {
  const idx = players.findIndex((p) => p.id === currentId)
  if (idx < 0 || players.length === 0) {
    throw new Error(`Invalid turn state: ${currentId}`)
  }
  return players[(idx + 1) % players.length].id
}

function removeCardFromPlayer(player: Player, pick: CardPick): Player {
  if (pick.zone === 'hand') {
    const hand = [...player.hand]
    hand.splice(pick.index, 1)
    return { ...player, hand }
  }

  if (pick.zone === 'faceUp') {
    const faceUp = [...player.faceUp]
    faceUp[pick.index] = undefined
    return { ...player, faceUp }
  }

  const faceDown = [...player.faceDown]
  faceDown[pick.index] = undefined
  return { ...player, faceDown }
}

function updatePlayer(
  state: GameState,
  playerId: string,
  updater: (player: Player) => Player
): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? updater(p) : p)),
  }
}

function endTurnState(state: GameState, playerId: string): GameState {
  return {
    ...state,
    currentPlayerId: advanceTurn(state.players, playerId),
    turnRank: null,
    turnSource: null,
    formTurnUsed: false,
  }
}

function pickupPileForPlayer(state: GameState, playerId: string): GameState {
  let next = updatePlayer(state, playerId, (p) => ({
    ...p,
    hand: sortHand([...p.hand, ...state.activePile]),
  }))

  next = { ...next, activePile: [] }

  return endTurnState(next, playerId)
}

function hasAnyOpeningPlayOption(state: GameState, player: Player): boolean {
  return listLegalPlays(player, state.activePile, null).length > 0
}

export type PlayResult = {
  state: GameState
  cleared: boolean
  badFlip: boolean
  message: string
}

function resolvePicks(player: Player, picks: CardPick[]): Card[] {
  return picks
    .map((pick) => {
      if (pick.zone === 'hand') return player.hand[pick.index]
      if (pick.zone === 'faceUp') return player.faceUp[pick.index]
      if (pick.zone === 'faceDown') {
        if (!isFaceDownAvailable(player, pick.index)) return null
        return player.faceDown[pick.index]
      }
      return null
    })
    .filter((c): c is Card => !!c)
}

function removePicks(player: Player, picks: CardPick[]): Player {
  let updated = player

  const sorted = [...picks].sort((a, b) => {
    if (a.zone !== b.zone) return a.zone.localeCompare(b.zone)
    return b.index - a.index
  })

  for (const pick of sorted) {
    updated = removeCardFromPlayer(updated, pick)
  }

  return updated
}

function clearStateAfterPlay(state: GameState): GameState {
  return {
    ...state,
    sidelinedCards: [...state.sidelinedCards, ...state.activePile],
    activePile: [],
    turnRank: null,
    turnSource: null,
    formTurnUsed: false,
  }
}

function applyMidTurnPlay(
  state: GameState,
  playerId: string,
  cards: Card[],
  picks: CardPick[],
  source: 'hand' | 'faceUp' | 'faceDown' | 'mixed'
): PlayResult {
  const next = updatePlayer(state, playerId, (p) => removePicks(p, picks))
  const nextPile = [...state.activePile, ...cards]
  const nextState = {
    ...next,
    activePile: nextPile,
    turnRank: cards[0].rank,
    turnSource: source,
    formTurnUsed: true,
  }
  const cleared = isClear(nextPile, cards)

  if (cleared) {
    return {
      state: clearStateAfterPlay(nextState),
      cleared: true,
      badFlip: false,
      message: 'Clear! Play again.',
    }
  }

  return {
    state: nextState,
    cleared: false,
    badFlip: false,
    message: `Played ${cards.length} ${cards[0].rank}(s). Add more, end turn, or pick up.`,
  }
}

function getSourceLabel(picks: CardPick[]): 'hand' | 'faceUp' | 'faceDown' | 'mixed' {
  const zones = [...new Set(picks.map((p) => p.zone))]
  if (zones.length === 1) return zones[0] as 'hand' | 'faceUp' | 'faceDown'
  return 'mixed'
}

function hasDuplicatePicks(picks: CardPick[]): boolean {
  const seen = new Set<string>()

  for (const pick of picks) {
    const key = `${pick.zone}:${pick.index}`
    if (seen.has(key)) return true
    seen.add(key)
  }

  return false
}

function validatePicksForCurrentTurn(
  state: GameState,
  player: Player,
  picks: CardPick[]
): { cards: Card[]; playRank: Rank } | null {
  if (picks.length === 0) return null
  if (hasDuplicatePicks(picks)) return null

  const cards = resolvePicks(player, picks)
  if (cards.length !== picks.length) return null

  const playRank = cards[0].rank
  if (!cards.every((c) => c.rank === playRank)) return null

  if (state.turnRank !== null) {
    const firstPick = picks[0]
    if (firstPick.zone === 'faceDown') return null
    if (picks.some((p) => p.zone === 'faceDown')) return null

    const allAllowed = cards.every((c) => c.rank === state.turnRank)
    if (!allAllowed) return null

    return { cards, playRank }
  }

  const faceDownPicks = picks.filter((p) => p.zone === 'faceDown')
  if (faceDownPicks.length > 1) return null

  if (faceDownPicks.length === 1) {
    if (picks[0].zone !== 'faceDown') return null
    if (picks.slice(1).some((p) => p.zone === 'faceDown')) return null
  }

  return { cards, playRank }
}

export function playCards(
  state: GameState,
  playerId: string,
  picks: CardPick[]
): PlayResult | null {
  if (state.currentPlayerId !== playerId || state.phase !== 'playing') return null

  const player = getPlayer(state, playerId)
  const validated = validatePicksForCurrentTurn(state, player, picks)
  if (!validated) return null

  const { cards, playRank } = validated

  if (state.turnRank === null) {
    const firstPick = picks[0]
    const firstCard = cards[0]

    if (firstPick.zone === 'faceDown') {
      const tooHigh = flippedCardIsTooHigh(firstCard, state.activePile)
      let next = updatePlayer(state, playerId, (p) => removePicks(p, [firstPick]))

      if (tooHigh) {
        const newPile = [...state.activePile, firstCard]

        next = updatePlayer(next, playerId, (p) => ({
          ...p,
          hand: sortHand([...p.hand, ...newPile]),
        }))

        return {
          state: endTurnState(
            {
              ...next,
              activePile: [],
              formTurnUsed: true,
            },
            playerId
          ),
          cleared: false,
          badFlip: true,
          message: 'Bad flip — you picked up the pile.',
        }
      }

      const extraPicks = picks.slice(1)
      const extraCards = cards.slice(1)
      const fullPlayed = [firstCard, ...extraCards]

      if (!extraCards.every((c) => c.rank === firstCard.rank)) return null
      if (extraPicks.some((p) => p.zone === 'faceDown')) return null

      const nextPile = [...state.activePile, ...fullPlayed]

      if (isClear(nextPile, fullPlayed)) {
        if (extraPicks.length > 0) {
          next = updatePlayer(next, playerId, (p) => removePicks(p, extraPicks))
        }

        const clearedState = {
          ...next,
          activePile: nextPile,
          turnRank: playRank,
          turnSource: extraPicks.length > 0 ? 'mixed' : 'faceDown',
          formTurnUsed: true,
        }

        return {
          state: clearStateAfterPlay(clearedState),
          cleared: true,
          badFlip: false,
          message: 'Clear! Play again.',
        }
      }

      if (extraPicks.length > 0) {
        next = updatePlayer(next, playerId, (p) => removePicks(p, extraPicks))
      }

      return {
        state: {
          ...next,
          activePile: [...state.activePile, ...fullPlayed],
          turnRank: playRank,
          turnSource: extraPicks.length > 0 ? 'mixed' : 'faceDown',
          formTurnUsed: true,
        },
        cleared: false,
        badFlip: false,
        message:
          extraPicks.length > 0
            ? `Flipped ${firstCard.rank} and added matches. Add more, end turn, or pick up.`
            : `Flipped ${firstCard.rank}. Add matching cards, end turn, or pick up.`,
      }
    }

    const legal = cards.every((c) => canPlay(c, state.activePile))
    if (!legal) return null

    return applyMidTurnPlay(state, playerId, cards, picks, getSourceLabel(picks))
  }

  return applyMidTurnPlay(state, playerId, cards, picks, getSourceLabel(picks))
}

export function flipFaceDown(
  state: GameState,
  playerId: string,
  index: number
): PlayResult | null {
  return playCards(state, playerId, [{ zone: 'faceDown', index }])
}

export function endTurn(state: GameState, playerId: string): GameState {
  if (state.currentPlayerId !== playerId) return state

  if (state.turnRank !== null || state.formTurnUsed) {
    return endTurnState(state, playerId)
  }

  const player = getPlayer(state, playerId)
  if (hasAnyOpeningPlayOption(state, player)) {
    return state
  }

  return endTurnState(state, playerId)
}

export function pickUpPile(state: GameState, playerId: string): GameState {
  if (state.currentPlayerId !== playerId || state.activePile.length === 0) {
    return state
  }

  if (state.turnRank === null && !state.formTurnUsed) {
    return state
  }

  return pickupPileForPlayer(state, playerId)
}

export function playIntentionalOverplay(
  state: GameState,
  playerId: string,
  pick: CardPick
): PlayResult | null {
  if (state.currentPlayerId !== playerId || state.phase !== 'playing') return null
  if (state.turnRank !== null) return null
  if (pick.zone === 'faceDown') return null

  const player = getPlayer(state, playerId)
  const card = resolvePicks(player, [pick])[0]

  if (!card) return null
  if (!isIntentionalOverplay(card, state.activePile)) return null

  let next = updatePlayer(state, playerId, (p) => removeCardFromPlayer(p, pick))
  const newPile = [...state.activePile, card]

  next = updatePlayer(next, playerId, (p) => ({
    ...p,
    hand: sortHand([...p.hand, ...newPile]),
  }))

  return {
    state: endTurnState(
      {
        ...next,
        activePile: [],
        formTurnUsed: true,
      },
      playerId
    ),
    cleared: false,
    badFlip: false,
    message: `${player.name} overplayed and picked up the pile.`,
  }
}

export function checkRoundEnd(
  state: GameState
): { state: GameState; message: string } | null {
  const winner = state.players.find((p) => playerHasNoCards(p))
  if (!winner || state.phase !== 'playing') return null

  const updatedPlayers = state.players.map((p) =>
    p.id === winner.id ? p : { ...p, score: p.score + scoreRemainingCards(p) }
  )

  if (updatedPlayers.some((p) => p.score >= WIN_SCORE)) {
    return {
      state: {
        ...state,
        players: updatedPlayers,
        phase: 'finished',
        activePile: [],
        turnRank: null,
        turnSource: null,
        formTurnUsed: false,
      },
      message: `${winner.name} won the round. Game over!`,
    }
  }

  const pool = collectCardsForReshuffle(
    updatedPlayers,
    state.sidelinedCards,
    state.activePile
  )

  const { hands, faceUps, faceDowns, sideline } = dealCards(state.playerCount, pool)

  const resetPlayers = updatedPlayers.map((p, i) => ({
    ...p,
    hand: sortHand(hands[i]),
    faceUp: faceUps[i],
    faceDown: faceDowns[i],
  }))

  const ordered = orderPlayersFromWinner(resetPlayers, winner.id)

  return {
    state: {
      ...state,
      players: ordered,
      activePile: [],
      sidelinedCards: sideline,
      currentPlayerId: winner.id,
      roundStartPlayerId: winner.id,
      phase: 'playing',
      turnRank: null,
      turnSource: null,
      formTurnUsed: false,
    },
    message: `${winner.name} won the round. New deal — ${winner.name} goes first.`,
  }
}

export function startTiebreakerRound(state: GameState): GameState {
  const pool = collectCardsForReshuffle(
    state.players,
    state.sidelinedCards,
    state.activePile
  )

  const { hands, faceUps, faceDowns, sideline } = dealCards(state.playerCount, pool)
  const leader = state.players.reduce((a, b) => (a.score <= b.score ? a : b))

  const resetPlayers = state.players.map((p, i) => ({
    ...p,
    hand: sortHand(hands[i]),
    faceUp: faceUps[i],
    faceDown: faceDowns[i],
  }))

  const ordered = orderPlayersFromWinner(resetPlayers, leader.id)

  return {
    ...state,
    players: ordered,
    activePile: [],
    sidelinedCards: sideline,
    currentPlayerId: leader.id,
    roundStartPlayerId: leader.id,
    phase: 'playing',
    turnRank: null,
    turnSource: null,
    formTurnUsed: false,
  }
}