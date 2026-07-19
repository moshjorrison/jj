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

export function computeLayout(
  viewportWidth: number,
  isTouch: boolean
): LayoutSizes {
  const isMobile = viewportWidth < 520
  const boardMaxWidth = isMobile ? Math.min(viewportWidth - 8, 520) : 520

  const scale = isMobile
    ? Math.min(1, Math.max(0.72, (viewportWidth - 12) / 390))
    : 1

  const cardWidth = Math.round(52 * scale)
  const cardHeight = Math.round(cardWidth * CARD_ASPECT)
  const opponentCardWidth = Math.round(28 * scale)
  const opponentCardHeight = Math.round(opponentCardWidth * CARD_ASPECT)
  const opponentHandStep = Math.max(8, Math.round(12 * scale))
  const rightHandStep = Math.max(8, Math.round(12 * scale))
  const sideColumnWidth = isMobile
    ? Math.max(48, Math.round(72 * scale))
    : 96
  const handGap = isMobile ? 2 : 4

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
