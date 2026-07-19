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
    background: 'white',
    border: selected ? '2px solid #2563eb' : '1.5px solid #ccc',
    boxSizing: 'border-box',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: onClick || onDoubleClick ? 'pointer' : 'default',
    flexShrink: 0,
    opacity: faded ? 0.45 : 1,
    boxShadow: selected
      ? '0 0 0 2px rgba(37,99,235,0.4), 0 2px 6px rgba(0,0,0,0.15)'
      : '0 1px 4px rgba(0,0,0,0.12)',
    transition: 'box-shadow 0.15s, border-color 0.15s, transform 0.1s',
    transform: `${selected ? 'translateY(-4px) ' : ''}rotate(${rotation}deg)`,
    transformOrigin: 'center center',
    userSelect: 'none',
    overflow: 'hidden',
  }

  const rankFontSize = isSmallCard
    ? 19
    : isMediumCard
      ? Math.max(30, Math.round(height * 0.31))
      : Math.max(24, Math.round(height * 0.36))

  const suitFontSize = isSmallCard
    ? 17
    : isMediumCard
      ? Math.max(30, Math.round(height * 0.24))
      : Math.max(30, Math.round(height * 0.28))

  const jokerFontSize = isSmallCard
    ? 8
    : isMediumCard
      ? Math.max(11, Math.round(height * 0.23))
      : Math.max(20, Math.round(height * 0.26))

  const contentGap = 0

  if (isJokerCard) {
    return (
      <div style={style} onClick={onClick} onDoubleClick={onDoubleClick}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0,
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
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: contentGap,
          color: textColor,
          lineHeight: 1,
        }}
      >
        <span
          style={{
            fontSize: rankFontSize,
            fontWeight: 800,
            fontFamily: 'Georgia, serif',
          }}
        >
          {card.rank}
        </span>
        <span style={{ fontSize: suitFontSize }}>{suitSymbol}</span>
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
        background: 'linear-gradient(135deg, #1a3a6b 0%, #2563eb 100%)',
        border: '1.5px solid #1e40af',
        boxSizing: 'border-box',
        flexShrink: 0,
        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
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
          border: '1px solid rgba(255,255,255,0.25)',
          background:
            'repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 2px, transparent 2px, transparent 8px)',
        }}
      />
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
        border: '1.5px dashed rgba(255,255,255,0.25)',
        boxSizing: 'border-box',
        flexShrink: 0,
        transform: `rotate(${rotation}deg)`,
        transformOrigin: 'center center',
      }}
    />
  )
}
