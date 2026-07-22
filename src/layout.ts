import { snapPx } from './display'

export type LayoutSizes = {
  cardWidth: number
  cardHeight: number
  handCardWidth: number
  handCardHeight: number
  handCardsPerRow: number
  handRowWidth: number
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
const HAND_CARDS_PER_ROW = 6

export function computeLayout(
  viewportWidth: number,
  _viewportHeight: number,
  isTouch: boolean
): LayoutSizes {
  const isMobile = viewportWidth < 520
  const boardMaxWidth = isMobile
    ? snapPx(Math.min(viewportWidth - 8, 520))
    : 520

  const widthScale = isMobile
    ? Math.min(1, Math.max(0.78, (viewportWidth - 12) / 390))
    : 1

  const scale = isMobile ? widthScale : 1

  const cardWidth = snapPx(54 * scale)
  const cardHeight = snapPx(cardWidth * CARD_ASPECT)
  const opponentCardWidth = snapPx(30 * scale)
  const opponentCardHeight = snapPx(opponentCardWidth * CARD_ASPECT)
  const opponentHandStep = snapPx(Math.max(9, Math.round(13 * scale)))
  const rightHandStep = snapPx(Math.max(9, Math.round(13 * scale)))
  const sideColumnWidth = isMobile
    ? snapPx(Math.max(52, Math.round(76 * scale)))
    : 96
  const handGap = isMobile ? snapPx(2) : 4

  const handCardWidth = isMobile
    ? snapPx(
        Math.min(
          cardWidth,
          Math.max(
            34,
            (boardMaxWidth - handGap * (HAND_CARDS_PER_ROW - 1)) / HAND_CARDS_PER_ROW
          )
        )
      )
    : cardWidth
  const handCardHeight = snapPx(handCardWidth * CARD_ASPECT)
  const handRowWidth = snapPx(
    handCardWidth * HAND_CARDS_PER_ROW + handGap * (HAND_CARDS_PER_ROW - 1)
  )

  return {
    cardWidth,
    cardHeight,
    handCardWidth,
    handCardHeight,
    handCardsPerRow: HAND_CARDS_PER_ROW,
    handRowWidth,
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
