import type { ReactNode } from 'react'
import { useLayout } from '../LayoutContext'
import { CardBack, CardFace, EmptySlot, cardFaceRotation } from '../cardUi'
import { isFaceDownAvailable } from '../gameLogic'
import { displayName, seatBlockNameStyle } from '../gameUi'
import { pickKey } from '../pickKey'
import type { Player, Rank, Seat } from '../types'
import type { RevealFlags } from './types'

export function OpponentHand({
  player,
  display,
  revealCards = false,
  spreadCards = false,
}: {
  player: Player
  display: Seat
  revealCards?: boolean
  spreadCards?: boolean
}) {
  const layout = useLayout()
  const count = player.hand.length
  if (count === 0) return null

  const isVertical = display === 'left' || display === 'right'
  const cardW = layout.opponentCardWidth
  const cardH = layout.opponentCardHeight
  const step = isVertical ? layout.rightHandStep : layout.opponentHandStep
  const spreadGap = 3
  const maxSize = spreadCards ? 2000 : 300
  const spreadStep = isVertical ? cardH + spreadGap : cardW + spreadGap
  const actualStep =
    spreadCards && count > 0
      ? spreadStep
      : count > 1
        ? Math.min(step, (maxSize - (isVertical ? cardH : cardW)) / (count - 1))
        : step

  const containerW = isVertical ? cardW : cardW + (count - 1) * actualStep
  const containerH = isVertical ? cardH + (count - 1) * actualStep : cardH
  const rotation = cardFaceRotation(display)

  return (
    <div style={{ position: 'relative', width: containerW, height: containerH }}>
      {player.hand.map((card, i) => (
        <div
          key={`${card.rank}-${card.suit}-${card.deckId}-${card.jokerColor ?? 'n'}-${i}`}
          style={{
            position: 'absolute',
            ...(isVertical
              ? { top: i * actualStep, left: 0 }
              : { left: i * actualStep, top: 0 }),
            zIndex: i,
          }}
        >
          {revealCards ? (
            <CardFace card={card} width={cardW} height={cardH} rotation={rotation} />
          ) : (
            <CardBack width={cardW} height={cardH} rotation={rotation} />
          )}
        </div>
      ))}
    </div>
  )
}

export function TableCards({
  player,
  isBottom,
  display,
  onFaceUpClick,
  onFaceUpDoubleClick,
  onFaceDownDoubleClick,
  selectedKeys,
  turnRank,
  isPlayerTurn,
  revealFaceDown = false,
  spreadCards = false,
}: {
  player: Player
  isBottom: boolean
  display: Seat
  onFaceUpClick?: (idx: number) => void
  onFaceUpDoubleClick?: (idx: number) => void
  onFaceDownDoubleClick?: (idx: number) => void
  selectedKeys: Set<string>
  turnRank: Rank | null
  isPlayerTurn: boolean
  revealFaceDown?: boolean
  spreadCards?: boolean
}) {
  const layout = useLayout()
  const w = isBottom ? layout.cardWidth : layout.opponentCardWidth
  const h = isBottom ? layout.cardHeight : layout.opponentCardHeight
  const overlap = spreadCards ? 0 : 10
  const slotGap = spreadCards ? 6 : isBottom ? 12 : 8
  const isVertical = !isBottom && (display === 'left' || display === 'right')
  const rotation = isBottom ? 0 : cardFaceRotation(display)

  const faceDownOffset =
    display === 'top'
      ? { top: overlap, left: 0 }
      : display === 'left'
        ? { top: 0, left: overlap }
        : display === 'right'
          ? { top: 0, left: 0 }
          : { top: 0, left: 0 }

  const faceUpOffset =
    display === 'top'
      ? { top: 0, left: 0 }
      : display === 'left'
        ? { top: 0, left: 0 }
        : display === 'right'
          ? { top: 0, left: overlap }
          : { top: overlap, left: 0 }

  const containerWidth =
    display === 'left' || display === 'right' ? w + overlap : w

  const containerHeight =
    display === 'top' || display === 'bottom' ? h + overlap : h

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isVertical ? 'column' : 'row',
        gap: slotGap,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {Array.from({ length: 4 }).map((_, i) => {
        const faceUpCard = player.faceUp[i]
        const faceDownCard = player.faceDown[i]
        const hasFaceUp = !!faceUpCard
        const hasFaceDown = !!faceDownCard
        const faceUpKey = pickKey({ zone: 'faceUp', index: i })

        const slotWidth =
          spreadCards && hasFaceUp && hasFaceDown
            ? isVertical
              ? w
              : w * 2 + slotGap
            : hasFaceUp && hasFaceDown
              ? containerWidth
              : w

        const slotHeight =
          spreadCards && hasFaceUp && hasFaceDown
            ? isVertical
              ? h * 2 + slotGap
              : h
            : hasFaceUp && hasFaceDown
              ? containerHeight
              : h

        const slotLayoutStyle = spreadCards
          ? {
              display: 'flex' as const,
              flexDirection: (isVertical ? 'column' : 'row') as 'column' | 'row',
              gap: slotGap,
              alignItems: 'center' as const,
              justifyContent: 'center' as const,
            }
          : { position: 'relative' as const }

        return (
          <div
            key={i}
            style={{
              ...slotLayoutStyle,
              width: slotWidth,
              height: slotHeight,
            }}
          >
            {hasFaceDown && (
              <div
                style={
                  spreadCards
                    ? undefined
                    : {
                        position: 'absolute',
                        ...faceDownOffset,
                        zIndex: 1,
                      }
                }
              >
                {!hasFaceUp && isBottom && !revealFaceDown ? (
                  <div
                    onClick={() => {
                      if (
                        layout.isTouch &&
                        isBottom &&
                        isPlayerTurn &&
                        isFaceDownAvailable(player, i)
                      ) {
                        onFaceDownDoubleClick?.(i)
                      }
                    }}
                    onDoubleClick={() => {
                      if (
                        isBottom &&
                        isPlayerTurn &&
                        isFaceDownAvailable(player, i)
                      ) {
                        onFaceDownDoubleClick?.(i)
                      }
                    }}
                    style={{
                      cursor:
                        isBottom &&
                        isPlayerTurn &&
                        isFaceDownAvailable(player, i)
                          ? 'pointer'
                          : 'default',
                    }}
                  >
                    <CardBack width={w} height={h} rotation={rotation} />
                  </div>
                ) : revealFaceDown && faceDownCard ? (
                  <CardFace
                    card={faceDownCard}
                    width={w}
                    height={h}
                    rotation={rotation}
                  />
                ) : (
                  <CardBack width={w} height={h} rotation={rotation} />
                )}
              </div>
            )}

            {hasFaceUp && faceUpCard && (
              <div
                style={
                  spreadCards
                    ? undefined
                    : {
                        position: 'absolute',
                        ...faceUpOffset,
                        zIndex: 2,
                      }
                }
              >
                <CardFace
                  card={faceUpCard}
                  width={w}
                  height={h}
                  rotation={rotation}
                  onClick={() => onFaceUpClick?.(i)}
                  onDoubleClick={
                    isBottom && isPlayerTurn
                      ? () => onFaceUpDoubleClick?.(i)
                      : undefined
                  }
                  selected={selectedKeys.has(faceUpKey)}
                  faded={
                    isBottom
                      ? !isPlayerTurn ||
                        (turnRank !== null && faceUpCard.rank !== turnRank)
                      : false
                  }
                />
              </div>
            )}

            {!hasFaceUp && !hasFaceDown && (
              <EmptySlot width={w} height={h} rotation={rotation} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export function ActivePile({ pile }: { pile: import('../types').Card[] }) {
  const layout = useLayout()
  const cardW = layout.cardWidth
  const cardH = layout.cardHeight
  const overlap = 10
  const maxVisibleWidth = layout.isMobile ? 150 : 180
  const actualOverlap =
    pile.length > 1
      ? Math.min(overlap, (maxVisibleWidth - cardW) / (pile.length - 1))
      : overlap

  return (
    <div
      style={{
        position: 'relative',
        width:
          pile.length > 0 ? cardW + (pile.length - 1) * actualOverlap : cardW,
        maxWidth: maxVisibleWidth,
        height: cardH,
      }}
    >
      {pile.map((card, i) => {
        const color =
          card.rank === 'Joker'
            ? card.jokerColor === 'red'
              ? '#dc2626'
              : '#111827'
            : card.suit === 'hearts' || card.suit === 'diamonds'
              ? '#dc2626'
              : '#111827'

        return (
          <div
            key={`${card.rank}-${card.suit}-${card.deckId}-${card.jokerColor ?? 'n'}-${i}`}
            style={{
              position: 'absolute',
              left: i * actualOverlap,
              top: 0,
              zIndex: i,
            }}
          >
            <div style={{ position: 'relative', width: cardW, height: cardH }}>
              <CardFace card={card} width={cardW} height={cardH} />
              <div
                style={{
                  position: 'absolute',
                  left: 2,
                  bottom: 2,
                  fontSize: 12,
                  lineHeight: 1,
                  fontWeight: 900,
                  color,
                  textShadow: '0 1px 0 rgba(255,255,255,0.85)',
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              >
                {card.rank}
              </div>
            </div>
          </div>
        )
      })}

      {pile.length === 0 && <EmptySlot width={cardW} height={cardH} />}
    </div>
  )
}

export function ScorePanel({
  players,
  currentId,
  disconnectedIds = [],
}: {
  players: Player[]
  currentId: string
  disconnectedIds?: string[]
}) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.07)',
        border: '0.5px solid rgba(255,255,255,0.18)',
        borderRadius: 10,
        padding: '8px 14px',
        minWidth: 110,
      }}
    >
      <div
        style={{ fontSize: 10, fontWeight: 700, opacity: 0.5, marginBottom: 6 }}
      >
        SCORES
      </div>
      {players.map((p) => (
        <div
          key={p.id}
          style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}
        >
          <span
            style={{
              fontSize: 12,
              color: p.id === currentId ? '#60a5fa' : undefined,
              opacity: disconnectedIds.includes(p.id) ? 0.45 : 1,
            }}
          >
            {displayName(p)}
            {disconnectedIds.includes(p.id) ? ' ○' : ''}
          </span>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{p.score}</span>
        </div>
      ))}
    </div>
  )
}

export function SeatBlock({
  player,
  isActiveTurn = false,
  disconnected = false,
  children,
}: {
  player: Player | undefined
  isActiveTurn?: boolean
  disconnected?: boolean
  children?: ReactNode
}) {
  if (!player) return <div />
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: player.seat === 'bottom' ? 4 : 6,
        opacity: disconnected ? 0.55 : 1,
      }}
    >
      <div style={seatBlockNameStyle(isActiveTurn)}>
        {displayName(player)}
        {disconnected ? ' (away)' : ''}
      </div>
      {children}
    </div>
  )
}

export function SeatPointsBanner({
  points,
  winner,
}: {
  points: number
  winner: boolean
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        padding: winner ? '12px 18px' : '14px 22px',
        borderRadius: 14,
        background: winner ? 'rgba(21, 128, 61, 0.92)' : 'rgba(0, 0, 0, 0.84)',
        border: '1px solid rgba(255,255,255,0.16)',
        color: 'white',
        fontWeight: 900,
        fontSize: winner ? 18 : 28,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        zIndex: 40,
        boxShadow: '0 12px 28px rgba(0,0,0,0.35)',
        pointerEvents: 'none',
      }}
    >
      {winner ? 'Winner' : `+${points}`}
    </div>
  )
}

export function OpponentStrip({
  opponents,
  turnRank,
  currentPlayerId,
  getRevealFlags,
  spreadCards = false,
  disconnectedIds = [],
}: {
  opponents: Player[]
  turnRank: Rank | null
  currentPlayerId: string
  getRevealFlags: (player: Player | undefined) => RevealFlags
  spreadCards?: boolean
  disconnectedIds?: string[]
}) {
  return (
    <div
      style={{
        width: '100%',
        overflowX: 'auto',
        paddingBottom: 4,
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 10,
          justifyContent: 'flex-start',
          minWidth: 'min-content',
          padding: '0 4px',
        }}
      >
        {opponents.map((player) => {
          const reveal = getRevealFlags(player)
          const isActive = player.id === currentPlayerId

          return (
            <div
              key={player.id}
              style={{
                flex: '0 0 auto',
                padding: '6px 8px',
                borderRadius: 10,
                border: isActive
                  ? '1px solid rgba(251,191,36,0.65)'
                  : '1px solid rgba(255,255,255,0.12)',
                background: isActive
                  ? 'rgba(251,191,36,0.08)'
                  : 'rgba(255,255,255,0.04)',
              }}
            >
              <SeatBlock
                player={player}
                isActiveTurn={isActive}
                disconnected={disconnectedIds.includes(player.id)}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    position: 'relative',
                  }}
                >
                  <OpponentHand
                    player={player}
                    display="top"
                    revealCards={reveal.revealHand}
                    spreadCards={spreadCards && reveal.revealHand}
                  />
                  <TableCards
                    player={player}
                    display="top"
                    isBottom={false}
                    selectedKeys={new Set()}
                    turnRank={turnRank}
                    isPlayerTurn={false}
                    revealFaceDown={reveal.revealFaceDown}
                    spreadCards={spreadCards && reveal.revealFaceDown}
                  />
                  {reveal.showPointsBanner && (
                    <SeatPointsBanner
                      points={reveal.points}
                      winner={reveal.isWinner}
                    />
                  )}
                </div>
              </SeatBlock>
            </div>
          )
        })}
      </div>
    </div>
  )
}
