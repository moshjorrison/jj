import type { RefObject } from 'react'
import { CardFace } from '../cardUi'
import { useLayout } from '../LayoutContext'
import {
  MessageBar,
  PileBannerOverlay,
  displayName,
  reviewingLeftoverCardsHint,
  type PileBannerVariant,
} from '../gameUi'
import { pickKey } from '../pickKey'
import type { Card, CardPick, GameState, Player } from '../types'
import { actionButtonStyle } from './buttonStyles'
import {
  ActivePile,
  OpponentHand,
  TableCards,
} from './TableComponents'
import type { RevealFlags, RoundRevealState } from './types'

type MobileGameBoardProps = {
  state: GameState
  bottom: Player
  opponents: Player[]
  topOpponent?: Player
  message: string
  roundReveal: RoundRevealState | null
  pileBanner: { text: string; variant: PileBannerVariant } | null
  selectedKeys: Set<string>
  isLocalTurn: boolean
  isAnimating: boolean
  canOverplaySelected: boolean
  canEndTurn: boolean
  selectedPickCount: number
  spreadRoundCards: boolean
  disconnectedIds: string[]
  pileAreaRef: RefObject<HTMLDivElement | null>
  bottomAreaRef: RefObject<HTMLDivElement | null>
  getRevealFlags: (player: Player | undefined) => RevealFlags
  canPressContinue: boolean
  continueButtonLabel: string
  onCardTap: (pick: CardPick, card: Card) => void
  onCardDoubleClick: (pick: CardPick, card: Card) => void
  onFaceDownFlip: (index: number) => void
  onPlay: () => void
  onOverplay: () => void
  onEndTurn: () => void
  onContinueRound: () => void
}

function HandFan({
  player,
  selectedKeys,
  disabled,
  onTap,
  onDoubleClick,
}: {
  player: Player
  selectedKeys: Set<string>
  disabled: boolean
  onTap: (pick: CardPick, card: Card) => void
  onDoubleClick: (pick: CardPick, card: Card) => void
}) {
  const layout = useLayout()
  const cards = player.hand
  if (cards.length === 0) return null

  const cardW = layout.cardWidth
  const cardH = layout.cardHeight
  const maxWidth = layout.boardMaxWidth - 8
  const step =
    cards.length > 1
      ? Math.min(
          cardW * 0.5,
          Math.max(14, (maxWidth - cardW) / (cards.length - 1))
        )
      : 0
  const totalWidth = cardW + step * (cards.length - 1)

  return (
    <div
      style={{
        position: 'relative',
        width: totalWidth,
        height: cardH,
        margin: '0 auto',
      }}
    >
      {cards.map((card, handIndex) => {
        const pick = { zone: 'hand' as const, index: handIndex }
        const key = pickKey(pick)
        const selected = selectedKeys.has(key)
        return (
          <div
            key={key}
            style={{
              position: 'absolute',
              left: handIndex * step,
              top: 0,
              zIndex: selected ? 200 : handIndex,
            }}
          >
            <CardFace
              card={card}
              width={cardW}
              height={cardH}
              selected={selected}
              faded={disabled}
              onClick={() => {
                if (disabled) return
                onTap(pick, card)
              }}
              onDoubleClick={() => {
                if (disabled) return
                onDoubleClick(pick, card)
              }}
            />
          </div>
        )
      })}
    </div>
  )
}

function OpponentChip({
  player,
  isActive,
  disconnected,
}: {
  player: Player
  isActive: boolean
  disconnected: boolean
}) {
  return (
    <div
      style={{
        flex: '0 0 auto',
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: isActive ? 700 : 500,
        whiteSpace: 'nowrap',
        border: isActive
          ? '1px solid rgba(251,191,36,0.7)'
          : '1px solid rgba(255,255,255,0.14)',
        background: isActive
          ? 'rgba(251,191,36,0.12)'
          : 'rgba(255,255,255,0.06)',
        opacity: disconnected ? 0.45 : 1,
      }}
    >
      {displayName(player)}
      {disconnected ? ' ○' : ''} · {player.hand.length}
    </div>
  )
}

export function MobileGameBoard({
  state,
  bottom,
  opponents,
  topOpponent,
  message,
  roundReveal,
  pileBanner,
  selectedKeys,
  isLocalTurn,
  isAnimating,
  canOverplaySelected,
  canEndTurn,
  selectedPickCount,
  spreadRoundCards,
  disconnectedIds,
  pileAreaRef,
  bottomAreaRef,
  getRevealFlags,
  canPressContinue,
  continueButtonLabel,
  onCardTap,
  onCardDoubleClick,
  onFaceDownFlip,
  onPlay,
  onOverplay,
  onEndTurn,
  onContinueRound,
}: MobileGameBoardProps) {
  const layout = useLayout()
  const bottomReveal = getRevealFlags(bottom)
  const topReveal = topOpponent ? getRevealFlags(topOpponent) : null
  const twoPlayer = opponents.length === 1 && topOpponent

  return (
    <div className="mobile-board">
      <div className="mobile-board__opponents">
        {twoPlayer && topOpponent && topReveal ? (
          <div className="mobile-board__opponent-detail">
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                opacity: 0.85,
                flexShrink: 0,
              }}
            >
              {displayName(topOpponent)}
            </span>
            <OpponentHand
              player={topOpponent}
              display="top"
              revealCards={topReveal.revealHand}
              spreadCards={spreadRoundCards && topReveal.revealHand}
            />
            <TableCards
              player={topOpponent}
              display="top"
              isBottom={false}
              selectedKeys={new Set()}
              turnRank={state.turnRank}
              isPlayerTurn={false}
              revealFaceDown={topReveal.revealFaceDown}
              spreadCards={spreadRoundCards && topReveal.revealFaceDown}
            />
          </div>
        ) : (
          <div className="mobile-board__opponent-chips">
            {opponents.map((player) => (
              <OpponentChip
                key={player.id}
                player={player}
                isActive={player.id === state.currentPlayerId && !roundReveal}
                disconnected={disconnectedIds.includes(player.id)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mobile-board__center">
        <div
          ref={pileAreaRef}
          className="mobile-board__pile"
          style={{
            minHeight: layout.cardHeight + 8,
            minWidth: layout.cardWidth + 24,
          }}
        >
          <ActivePile pile={state.activePile} />
          {pileBanner && (
            <PileBannerOverlay
              text={pileBanner.text}
              variant={pileBanner.variant}
            />
          )}
        </div>

        {roundReveal ? (
          <>
            <MessageBar
              message={roundReveal.roundMessage}
              hint={
                !roundReveal.revealComplete
                  ? reviewingLeftoverCardsHint()
                  : 'Everyone must continue before the next deal.'
              }
            />
            <button
              type="button"
              disabled={!canPressContinue}
              onClick={onContinueRound}
              style={{
                ...actionButtonStyle(canPressContinue),
                marginTop: 6,
                minWidth: 180,
              }}
            >
              {continueButtonLabel}
            </button>
          </>
        ) : (
          <MessageBar message={message} hint={null} />
        )}
      </div>

      <div ref={bottomAreaRef} className="mobile-board__player">
        <TableCards
          player={bottom}
          display="bottom"
          isBottom
          selectedKeys={selectedKeys}
          turnRank={state.turnRank}
          isPlayerTurn={isLocalTurn && !isAnimating}
          revealFaceDown={bottomReveal.revealFaceDown}
          spreadCards={spreadRoundCards && bottomReveal.revealFaceDown}
          onFaceUpClick={(idx) => {
            if (isAnimating) return
            const card = bottom.faceUp[idx]
            if (card) onCardTap({ zone: 'faceUp', index: idx }, card)
          }}
          onFaceUpDoubleClick={(idx) => {
            if (isAnimating) return
            const card = bottom.faceUp[idx]
            if (!card) return
            onCardDoubleClick({ zone: 'faceUp', index: idx }, card)
          }}
          onFaceDownDoubleClick={(idx) => {
            if (isAnimating) return
            onFaceDownFlip(idx)
          }}
        />

        <HandFan
          player={bottom}
          selectedKeys={selectedKeys}
          disabled={!isLocalTurn || isAnimating}
          onTap={onCardTap}
          onDoubleClick={onCardDoubleClick}
        />

        {!roundReveal && (
          <div className="mobile-board__actions">
            {selectedPickCount > 0 && (
              <button
                type="button"
                disabled={isAnimating}
                onClick={onPlay}
                style={{
                  ...actionButtonStyle(!isAnimating),
                  background: 'rgba(22,163,74,0.9)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  fontWeight: 800,
                }}
              >
                PLAY{selectedPickCount > 1 ? ` (${selectedPickCount})` : ''}
              </button>
            )}
            <button
              type="button"
              disabled={!canOverplaySelected}
              onClick={onOverplay}
              style={actionButtonStyle(canOverplaySelected)}
            >
              OVERPLAY
            </button>
            <button
              type="button"
              disabled={!canEndTurn || isAnimating}
              onClick={onEndTurn}
              style={actionButtonStyle(canEndTurn && !isAnimating)}
            >
              END TURN
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
