import { snapPx } from './display'

export type LayoutSizes = {
  cardWidth: number
  cardHeight: number
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

const MOBILE_REFERENCE_HEIGHT = 640

export function computeLayout(
  viewportWidth: number,
  viewportHeight: number,
  isTouch: boolean
): LayoutSizes {
  const isMobile = viewportWidth < 520
  const boardMaxWidth = isMobile
    ? snapPx(Math.min(viewportWidth - 8, 520))
    : 520

  const widthScale = isMobile
    ? Math.min(1.04, Math.max(0.82, (viewportWidth - 8) / 375))
    : 1

  const heightBudget = viewportHeight - 16
  const heightScale = isMobile
    ? Math.min(1, Math.max(0.62, heightBudget / MOBILE_REFERENCE_HEIGHT))
    : 1

  const scale = isMobile ? widthScale * heightScale : 1

  const cardWidth = snapPx(54 * scale)
  const cardHeight = snapPx(cardWidth * CARD_ASPECT)
  const opponentCardWidth = snapPx(30 * scale)
  const opponentCardHeight = snapPx(opponentCardWidth * CARD_ASPECT)
  const opponentHandStep = snapPx(Math.max(9, Math.round(13 * scale)))
  const rightHandStep = snapPx(Math.max(9, Math.round(13 * scale)))
  const sideColumnWidth = isMobile
    ? snapPx(Math.max(52, Math.round(76 * scale)))
    : 96
  const handGap = isMobile ? snapPx(3) : 4

  return {
    cardWidth,
    cardHeight,
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
