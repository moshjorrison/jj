import { snapPx } from './display'

export type LayoutSizes = {
  pileCardWidth: number
  pileCardHeight: number
  cardWidth: number
  cardHeight: number
  handCardWidth: number
  handCardHeight: number
  handCardsPerRow: number
  handRowWidth: number
  bottomTableWidth: number
  opponentCardWidth: number
  opponentCardHeight: number
  opponentHandStep: number
  rightHandStep: number
  sideColumnWidth: number
  boardMaxWidth: number
  handGap: number
  sideSeatGap: number
  sideSeatPull: number
  sideTablePull: number
  isMobile: boolean
  isTouch: boolean
}

const CARD_ASPECT = 73 / 52
const TABLE_SLOTS = 4
const HAND_CARDS_PER_ROW = 7
const BOTTOM_PLAYER_SCALE = 0.92

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

  const pileCardWidth = isMobile
    ? snapPx(
        Math.min(
          54 * scale,
          (boardMaxWidth - tableGap * (TABLE_SLOTS - 1)) / TABLE_SLOTS
        )
      )
    : snapPx(54 * scale)
  const pileCardHeight = snapPx(pileCardWidth * CARD_ASPECT)

  const cardWidth = snapPx(pileCardWidth * BOTTOM_PLAYER_SCALE)
  const cardHeight = snapPx(cardWidth * CARD_ASPECT)

  const handCardWidth = snapPx(
    Math.min(
      cardWidth,
      (boardMaxWidth - handGap * (HAND_CARDS_PER_ROW - 1)) / HAND_CARDS_PER_ROW
    )
  )
  const handCardHeight = snapPx(handCardWidth * CARD_ASPECT)
  const handRowWidth = snapPx(
    handCardWidth * HAND_CARDS_PER_ROW + handGap * (HAND_CARDS_PER_ROW - 1)
  )
  const bottomTableWidth = snapPx(
    cardWidth * TABLE_SLOTS + tableGap * (TABLE_SLOTS - 1)
  )
  const opponentCardWidth = snapPx(30 * scale)
  const opponentCardHeight = snapPx(opponentCardWidth * CARD_ASPECT)
  const opponentHandStep = snapPx(Math.max(9, Math.round(13 * scale)))
  const rightHandStep = snapPx(Math.max(9, Math.round(13 * scale)))
  const sideColumnWidth = isMobile
    ? snapPx(Math.max(48, Math.round(68 * scale)))
    : 96
  const sideSeatGap = isMobile ? snapPx(2) : snapPx(4)
  const sideSeatPull = isMobile ? snapPx(20) : snapPx(32)
  const sideTablePull = isMobile ? snapPx(16) : snapPx(24)

  return {
    pileCardWidth,
    pileCardHeight,
    cardWidth,
    cardHeight,
    handCardWidth,
    handCardHeight,
    handCardsPerRow: HAND_CARDS_PER_ROW,
    handRowWidth,
    bottomTableWidth,
    opponentCardWidth,
    opponentCardHeight,
    opponentHandStep,
    rightHandStep,
    sideColumnWidth,
    boardMaxWidth,
    handGap,
    sideSeatGap,
    sideSeatPull,
    sideTablePull,
    isMobile,
    isTouch,
  }
}
