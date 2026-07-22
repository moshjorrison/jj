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
  viewportHeight: number
  viewportOffsetTop: number
}

const CARD_ASPECT = 73 / 52

/** Non-card chrome: header, turn chip, scores, message, buttons, safe area. */
const MOBILE_CHROME_HEIGHT = 190
/** Target height for card/table areas on a reference phone. */
const MOBILE_CONTENT_HEIGHT = 470

export function computeLayout(
  viewportWidth: number,
  viewportHeight: number,
  isTouch: boolean,
  viewportOffsetTop = 0
): LayoutSizes {
  const isMobile = viewportWidth < 520
  const boardMaxWidth = isMobile
    ? snapPx(Math.min(viewportWidth - 8, 520))
    : 520

  const widthScale = isMobile
    ? Math.min(1.04, Math.max(0.82, (viewportWidth - 8) / 375))
    : 1

  const contentBudget = Math.max(280, viewportHeight - MOBILE_CHROME_HEIGHT)
  const heightScale = isMobile
    ? Math.min(1, Math.max(0.55, contentBudget / MOBILE_CONTENT_HEIGHT))
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
    viewportHeight,
    viewportOffsetTop,
  }
}
