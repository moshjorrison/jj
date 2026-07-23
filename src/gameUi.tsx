import type { CSSProperties } from 'react'
import type { GameState, Player } from './types'
import { sharpText } from './display'

export type PileBannerVariant = 'default' | 'clear' | 'bad' | 'flip' | 'win' | 'pickup'

export function pileBannerVariant(text: string): PileBannerVariant {
  const upper = text.toUpperCase()
  if (upper.includes('CLEAR')) return 'clear'
  if (upper.includes('BAD FLIP')) return 'bad'
  if (upper.includes('FLIP')) return 'flip'
  if (upper.includes('WIN')) return 'win'
  if (upper.includes('PICK UP')) return 'pickup'
  return 'default'
}

export function displayName(player: Player) {
  return player.id === 'player-0' ? 'You' : player.name
}

export function displayPossessive(player: Player) {
  return player.id === 'player-0' ? 'Your' : `${player.name}'s`
}

export function normalizeMessage(message: string) {
  return message.replaceAll('Player 1', 'You').replaceAll("You's", 'Your')
}

export function turnHandoffMessage(state: GameState, previousPlayerId: string) {
  const next = state.players.find((p) => p.id === state.currentPlayerId)
  if (!next) return 'Turn ended.'
  if (next.id === previousPlayerId) {
    return 'Clear! Play again with any card.'
  }
  return turnStartMessage(next)
}

export function turnStartMessage(player: Player) {
  return `${displayPossessive(player)} turn — select cards to play.`
}

export function reviewingCardsLabel() {
  return 'Reviewing cards…'
}

export function continueRoundLabel(
  player: Player,
  count: number,
  required: number
) {
  return `${displayName(player)} — CONTINUE (${count}/${required})`
}

export function tiebreakerMessage() {
  return 'Tiebreaker round — lowest score deals first.'
}

export function reviewingLeftoverCardsHint() {
  return 'Reviewing leftover cards…'
}

export function actionHintForTurn(
  state: GameState,
  isLocalTurn: boolean,
  roundReveal: boolean
): string | null {
  if (!isLocalTurn || roundReveal || state.phase !== 'playing') return null

  if (state.turnRank !== null) {
    return `Locked to ${state.turnRank}s — add more or end turn.`
  }

  if (state.activePile.length === 0) {
    return 'Pile is empty — play any card or double-tap face-down to flip.'
  }

  return 'Play ≤ top card, overplay to pick up, or double-tap face-down to flip.'
}

export function TurnChip({
  label,
  isYours,
}: {
  label: string
  isYours: boolean
}) {
  return (
    <div
      className={`turn-chip${isYours ? ' turn-chip--yours' : ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 14px',
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: 0.2,
        ...sharpText,
      }}
    >
      <span
        className="turn-chip-dot"
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: isYours ? '#4ade80' : '#fbbf24',
          boxShadow: isYours
            ? '0 0 8px rgba(74,222,128,0.8)'
            : '0 0 8px rgba(251,191,36,0.7)',
          flexShrink: 0,
        }}
      />
      {label}
    </div>
  )
}

export function MessageBar({
  message,
  hint,
  maxWidth,
}: {
  message: string
  hint: string | null
  maxWidth?: number
}) {
  const wrapStyle = {
    whiteSpace: 'normal' as const,
    overflowWrap: 'break-word' as const,
    wordBreak: 'break-word' as const,
  }

  return (
    <div
      className="message-bar"
      style={{
        width: '100%',
        maxWidth: maxWidth ?? 380,
        marginLeft: 'auto',
        marginRight: 'auto',
      }}
    >
      <div
        key={message}
        className="message-bar-text"
        style={{
          fontSize: 14,
          fontWeight: 600,
          lineHeight: 1.35,
          textAlign: 'center',
          ...wrapStyle,
          ...sharpText,
        }}
      >
        {message}
      </div>
      {hint && (
        <div
          style={{
            marginTop: 6,
            fontSize: 12,
            lineHeight: 1.35,
            textAlign: 'center',
            opacity: 0.72,
            ...wrapStyle,
            ...sharpText,
          }}
        >
          {hint}
        </div>
      )}
    </div>
  )
}

export function PileBannerOverlay({
  text,
  variant,
  maxWidth,
}: {
  text: string
  variant: PileBannerVariant
  maxWidth?: number
}) {
  const wraps = maxWidth !== undefined

  return (
    <div
      className={`pile-banner pile-banner--${variant}`}
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate3d(-50%, -50%, 0)',
        padding: wraps ? '10px 14px' : '12px 22px',
        borderRadius: 14,
        color: 'white',
        fontWeight: 900,
        fontSize: wraps ? 18 : 22,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        whiteSpace: wraps ? 'normal' : 'nowrap',
        textAlign: 'center',
        lineHeight: 1.15,
        maxWidth: maxWidth,
        zIndex: 30,
        pointerEvents: 'none',
        ...sharpText,
      }}
    >
      {text}
    </div>
  )
}

export function seatBlockNameStyle(isActiveTurn: boolean): CSSProperties {
  return {
    fontWeight: 700,
    fontSize: 14,
    lineHeight: 1,
    padding: '4px 10px',
    borderRadius: 999,
    background: isActiveTurn ? 'rgba(251,191,36,0.16)' : 'transparent',
    border: isActiveTurn
      ? '0.5px solid rgba(251,191,36,0.5)'
      : '0.5px solid transparent',
    boxShadow: isActiveTurn ? '0 0 14px rgba(251,191,36,0.22)' : undefined,
    transition: 'background 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease',
    ...sharpText,
  }
}
