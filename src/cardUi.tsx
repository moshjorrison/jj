import type { CSSProperties } from 'react'
import type { Card, Seat } from './types'
import { SUIT_SYMBOL } from './constants'

export function isRed(card: Card): boolean {
  return (
    card.suit === 'hearts' ||
    card.suit === 'diamonds' ||
    card.jokerColor === 'red'
  )
}

export function sortHandCards(cards: Card[]): Card[] {
  const order: Record<string, number> = {
    Joker: 0,
    J: 1,
    A: 2,
    '2': 3,
    '3': 4,
    '4': 5,
    '5': 6,
    '6': 7,
    '7': 8,
    '8': 9,
    '9': 10,
    '10': 11,
    Q: 12,
    K: 13,
  }

  return [...cards].sort((a, b) => {
    const rankDiff = (order[a.rank] ?? 999) - (order[b.rank] ?? 999)
    if (rankDiff !== 0) return rankDiff
    return a.suit.localeCompare(b.suit)
  })
}

export function cardFaceRotation(seat: Seat): number {
  if (seat === 'top') return 180
  if (seat === 'left') return 90
  if (seat === 'right') return -90
  return 0
}

type CardFaceProps = {
  card: Card
  width: number
  height: number
  selected?: boolean
  faded?: boolean
  onClick?: () => void
  onDoubleClick?: () => void
  rotation?: number
}

function cornerFontSize(width: number, height: number, isSmall: boolean) {
  if (isSmall) return Math.max(8, Math.round(width * 0.22))
  return Math.max(10, Math.round(height * 0.16))
}

export function CardFace({
  card,
  width,
  height,
  selected = false,
  faded = false,
  onClick,
  onDoubleClick,
  rotation = 0,
}: CardFaceProps) {
  const red = isRed(card)
  const textColor = red ? '#c0392b' : '#1a1a2e'
  const suitSymbol = SUIT_SYMBOL[card.suit] ?? ''
  const isJokerCard = card.rank === 'Joker'
  const isSmallCard = width <= 34 || height <= 48
  const isMediumCard = width <= 52 || height <= 73

  const style: CSSProperties = {
    width,
    height,
    borderRadius: Math.round(width * 0.1),
    background: 'linear-gradient(160deg, #ffffff 0%, #f4f4f5 100%)',
    border: selected ? '2px solid #2563eb' : '1.5px solid #d4d4d8',
    boxSizing: 'border-box',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: onClick || onDoubleClick ? 'pointer' : 'default',
    flexShrink: 0,
    opacity: faded ? 0.45 : 1,
    boxShadow: selected
      ? '0 0 0 2px rgba(37,99,235,0.4), 0 4px 12px rgba(0,0,0,0.18)'
      : '0 2px 6px rgba(0,0,0,0.14)',
    transition: 'box-shadow 0.15s, border-color 0.15s, transform 0.1s',
    transform: `${selected ? 'translateY(-4px) ' : ''}rotate(${rotation}deg)`,
    transformOrigin: 'center center',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    overflow: 'hidden',
  }

  const centerRankSize = isSmallCard
    ? 19
    : isMediumCard
      ? Math.max(30, Math.round(height * 0.31))
      : Math.max(24, Math.round(height * 0.36))

  const centerSuitSize = isSmallCard
    ? 17
    : isMediumCard
      ? Math.max(30, Math.round(height * 0.24))
      : Math.max(30, Math.round(height * 0.28))

  const cornerSize = cornerFontSize(width, height, isSmallCard)

  const cornerStyle: CSSProperties = {
    position: 'absolute',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    lineHeight: 1,
    color: textColor,
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontWeight: 800,
    fontSize: cornerSize,
    pointerEvents: 'none',
  }

  if (isJokerCard) {
    const jokerFontSize = isSmallCard
      ? 8
      : isMediumCard
        ? Math.max(11, Math.round(height * 0.23))
        : Math.max(20, Math.round(height * 0.26))

    return (
      <div style={style} onClick={onClick} onDoubleClick={onDoubleClick}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: red ? '#c0392b' : '#1a1a2e',
            textAlign: 'center',
            padding: isSmallCard ? 2 : 4,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: jokerFontSize,
              fontWeight: 800,
              fontFamily: 'Georgia, serif',
              lineHeight: 0.8,
            }}
          >
            <span>J</span>
            <span>O</span>
            <span>K</span>
            <span>E</span>
            <span>R</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={style} onClick={onClick} onDoubleClick={onDoubleClick}>
      <div style={{ ...cornerStyle, top: 3, left: 4 }}>
        <span>{card.rank}</span>
        <span style={{ fontSize: cornerSize * 0.9 }}>{suitSymbol}</span>
      </div>
      <div
        style={{
          ...cornerStyle,
          bottom: 3,
          right: 4,
          transform: 'rotate(180deg)',
        }}
      >
        <span>{card.rank}</span>
        <span style={{ fontSize: cornerSize * 0.9 }}>{suitSymbol}</span>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: textColor,
          lineHeight: 1,
          pointerEvents: 'none',
        }}
      >
        <span
          style={{
            fontSize: centerRankSize,
            fontWeight: 800,
            fontFamily: 'Georgia, serif',
          }}
        >
          {card.rank}
        </span>
        <span style={{ fontSize: centerSuitSize }}>{suitSymbol}</span>
      </div>
    </div>
  )
}

export function CardBack({
  width,
  height,
  rotation = 0,
}: {
  width: number
  height: number
  rotation?: number
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: Math.round(width * 0.1),
        background:
          'linear-gradient(145deg, #1e3a5f 0%, #1d4ed8 45%, #1e40af 100%)',
        border: '1.5px solid #1e3a8a',
        boxSizing: 'border-box',
        flexShrink: 0,
        boxShadow: '0 2px 6px rgba(0,0,0,0.22)',
        overflow: 'hidden',
        position: 'relative',
        transform: `rotate(${rotation}deg)`,
        transformOrigin: 'center center',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 4,
          borderRadius: Math.round(width * 0.07),
          border: '1px solid rgba(255,255,255,0.28)',
          background:
            'repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 2px, transparent 2px, transparent 7px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.35)',
          fontSize: Math.max(10, Math.round(width * 0.22)),
          fontWeight: 800,
          fontFamily: 'Georgia, serif',
          letterSpacing: 1,
        }}
      >
        J&J
      </div>
    </div>
  )
}

export function EmptySlot({
  width,
  height,
  rotation = 0,
}: {
  width: number
  height: number
  rotation?: number
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: Math.round(width * 0.1),
        border: '1.5px dashed rgba(255,255,255,0.28)',
        boxSizing: 'border-box',
        flexShrink: 0,
        transform: `rotate(${rotation}deg)`,
        transformOrigin: 'center center',
        background: 'rgba(255,255,255,0.03)',
      }}
    />
  )
}
