import { snapPx } from './display'

export type LayoutSizes = {
  cardWidth: number
  cardHeight: number
  handCardWidth: number
  handCardHeight: number
  handCardsPerRow: number
  opponentCardWidth: number
  opponentCardHeight: number
  opponentHandStep: number
  rightHandStep: number
  sideColumnWidth: number
  boardMaxWidth: number
  handGap: number
  isMobile: boolean
  isTouch: boolean
}

const CARD_ASPECT = 73 / 52
const TABLE_SLOTS = 4
const HAND_CARDS_PER_ROW = 7

export function computeLayout(
  viewportWidth: number,
  isTouch: boolean
): LayoutSizes {
  const isMobile = viewportWidth < 520
  const boardMaxWidth = isMobile
    ? snapPx(Math.min(viewportWidth - 8, 520))
    : 520

  const scale = isMobile
    ? Math.min(1.04, Math.max(0.82, (viewportWidth - 8) / 375))
    : 1

  const handGap = isMobile ? snapPx(2) : 4
  const tableGap = isMobile ? snapPx(4) : 12

  const cardWidth = isMobile
    ? snapPx(
        Math.min(
          54 * scale,
          (boardMaxWidth - tableGap * (TABLE_SLOTS - 1)) / TABLE_SLOTS
        )
      )
    : snapPx(54 * scale)
  const cardHeight = snapPx(cardWidth * CARD_ASPECT)

  const handCardWidth = snapPx(
    Math.min(
      cardWidth,
      (boardMaxWidth - handGap * (HAND_CARDS_PER_ROW - 1)) / HAND_CARDS_PER_ROW
    )
  )
  const handCardHeight = snapPx(handCardWidth * CARD_ASPECT)
  const opponentCardWidth = snapPx(30 * scale)
  const opponentCardHeight = snapPx(opponentCardWidth * CARD_ASPECT)
  const opponentHandStep = snapPx(Math.max(9, Math.round(13 * scale)))
  const rightHandStep = snapPx(Math.max(9, Math.round(13 * scale)))
  const sideColumnWidth = isMobile
    ? snapPx(Math.max(48, Math.round(68 * scale)))
    : 96

  return {
    cardWidth,
    cardHeight,
    handCardWidth,
    handCardHeight,
    handCardsPerRow: HAND_CARDS_PER_ROW,
    opponentCardWidth,
    opponentCardHeight,
    opponentHandStep,
    rightHandStep,
    sideColumnWidth,
    boardMaxWidth,
    handGap,
    isMobile,
    isTouch,
  }
}
