import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { gpuLayer, sharpText } from './display';
import {
  MessageBar,
  PileBannerOverlay,
  TurnChip,
  actionHintForTurn,
  displayName,
  displayPossessive,
  normalizeMessage,
  pileBannerVariant,
  seatBlockNameStyle,
  turnHandoffMessage,
  type PileBannerVariant,
} from './gameUi';
import { runAiStep } from './ai';
import { CardBack, CardFace, EmptySlot, cardFaceRotation } from './cardUi';
import {
  AI_STEP_DELAY_MS,
  FLIP_FLY_JACK_MS,
  FLIP_FLY_MS,
  HAND_END_DELAY_MS,
  MAX_LOCAL_PLAYERS,
  ROUND_END_DELAY_MS,
  ROUND_REVEAL_BANNER_OFFSET_MS,
  ROUND_REVEAL_FACE_DOWN_OFFSET_MS,
  ROUND_REVEAL_HAND_OFFSET_MS,
  ROUND_REVEAL_PLAYER_STEP_MS,
  ROUND_REVEAL_START_MS,
} from './constants';
import { useLayout } from './LayoutContext';
import { OnlineLobby } from './multiplayer/OnlineLobby';
import { useOnlineGame } from './multiplayer/useOnlineGame';
import { GameOverScreen } from './GameOverScreen';
import { HotSeatBanner } from './HotSeatBanner';
import { SetupScreen } from './SetupScreen';
import { defaultPlayerNames, opponentsFromView, playerAtDisplay } from './seats';
import {
  canPlay,
  isFaceDownAvailable,
  isIntentionalOverplay,
} from './gameLogic';
import {
  checkRoundEnd,
  canEndTurn,
  canPickUpPile,
  createSetupState,
  endTurn,
  flipFaceDown,
  pickUpPile,
  playCards,
  playIntentionalOverplay,
  startGame,
  startTiebreakerRound,
} from './gameState';
import { pickKey, parsePickKey } from './pickKey';
import type {
  Card,
  CardPick,
  GameMode,
  GameState,
  Player,
  Rank,
  Seat,
} from './types';

type PlayLikeResult = {
  state: GameState;
  message: string;
  cleared?: boolean;
  badFlip?: boolean;
  blocked?: boolean;
};

type FlyingCard = {
  id: string;
  card: Card;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  startRotation: number;
  endRotation: number;
  width: number;
  height: number;
  delayMs: number;
  durationMs: number;
};

type RoundRevealPlayerState = {
  playerId: string;
  revealedHand: boolean;
  revealedFaceDown: boolean;
  showPointsBanner: boolean;
  points: number;
};

type RoundRevealState = {
  pendingFinalState: GameState;
  roundMessage: string;
  winnerId: string | null;
  players: RoundRevealPlayerState[];
  revealComplete: boolean;
  continuedPlayerIds: string[];
  requiredPlayerIds: string[];
};

function flipFlyDurationMs(card: Card): number {
  if (card.rank === 'J' || card.rank === 'Joker') return FLIP_FLY_JACK_MS;
  return FLIP_FLY_MS;
}

function requiredContinuePlayerIds(
  players: Player[],
  mode: GameMode
): string[] {
  if (mode === 'ai') {
    return players.filter((p) => p.isHuman).map((p) => p.id);
  }
  return players.map((p) => p.id);
}

function seatRotation(seat: Seat) {
  return cardFaceRotation(seat);
}

function cardMatches(a: Card, b: Card) {
  return (
    a.rank === b.rank &&
    a.suit === b.suit &&
    a.deckId === b.deckId &&
    a.jokerColor === b.jokerColor
  );
}

function resolveCardsFromPicks(player: Player, picks: CardPick[]): Card[] {
  return picks
    .map((pick) => {
      if (pick.zone === 'hand') return player.hand[pick.index] ?? null;
      if (pick.zone === 'faceUp') return player.faceUp[pick.index] ?? null;
      if (pick.zone === 'faceDown') {
        if (!isFaceDownAvailable(player, pick.index)) return null;
        return player.faceDown[pick.index] ?? null;
      }
      return null;
    })
    .filter((card): card is Card => !!card);
}

function cardsAddedToPile(prev: Card[], next: Card[]) {
  const remaining = [...prev];
  const added: Card[] = [];

  for (const card of next) {
    const matchIndex = remaining.findIndex((c) => cardMatches(c, card));
    if (matchIndex >= 0) {
      remaining.splice(matchIndex, 1);
    } else {
      added.push(card);
    }
  }

  return added;
}

function roundPenaltyPoints(player: Player) {
  const allCards = [
    ...player.hand,
    ...player.faceUp.filter((c): c is Card => !!c),
    ...player.faceDown.filter((c): c is Card => !!c),
  ];

  return allCards.reduce((sum, card) => {
    if (card.rank === 'Joker') return sum + 50;
    if (card.rank === 'J') return sum + 50;
    if (card.rank === 'Q') return sum + 10;
    if (card.rank === 'K') return sum + 10;
    if (card.rank === 'A') return sum + 1;
    return sum + Number(card.rank);
  }, 0);
}

function OpponentHand({
  player,
  display,
  revealCards = false,
  spreadCards = false,
}: {
  player: Player;
  display: Seat;
  revealCards?: boolean;
  spreadCards?: boolean;
}) {
  const layout = useLayout();
  const count = player.hand.length;
  if (count === 0) return null;

  const isVertical = display === 'left' || display === 'right';
  const cardW = layout.opponentCardWidth;
  const cardH = layout.opponentCardHeight;
  const step = isVertical ? layout.rightHandStep : layout.opponentHandStep;
  const spreadGap = 3;
  const maxSize = spreadCards ? 2000 : 300;
  const spreadStep = isVertical ? cardH + spreadGap : cardW + spreadGap;
  const actualStep =
    spreadCards && count > 0
      ? spreadStep
      : count > 1
        ? Math.min(step, (maxSize - (isVertical ? cardH : cardW)) / (count - 1))
        : step;

  const containerW = isVertical ? cardW : cardW + (count - 1) * actualStep;
  const containerH = isVertical ? cardH + (count - 1) * actualStep : cardH;
  const rotation = cardFaceRotation(display);

  return (
    <div
      style={{ position: 'relative', width: containerW, height: containerH }}
    >
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
            <CardFace
              card={card}
              width={cardW}
              height={cardH}
              rotation={rotation}
            />
          ) : (
            <CardBack width={cardW} height={cardH} rotation={rotation} />
          )}
        </div>
      ))}
    </div>
  );
}

function TableCards({
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
  player: Player;
  isBottom: boolean;
  display: Seat;
  onFaceUpClick?: (idx: number) => void;
  onFaceUpDoubleClick?: (idx: number) => void;
  onFaceDownDoubleClick?: (idx: number) => void;
  selectedKeys: Set<string>;
  turnRank: Rank | null;
  isPlayerTurn: boolean;
  revealFaceDown?: boolean;
  spreadCards?: boolean;
}) {
  const layout = useLayout();
  const w = isBottom ? layout.cardWidth : layout.opponentCardWidth;
  const h = isBottom ? layout.cardHeight : layout.opponentCardHeight;
  const overlap = spreadCards ? 0 : 10;
  const slotGap = spreadCards ? 6 : isBottom ? 12 : 8;
  const isVertical = !isBottom && (display === 'left' || display === 'right');
  const rotation = isBottom ? 0 : cardFaceRotation(display);

  const faceDownOffset =
    display === 'top'
      ? { top: overlap, left: 0 }
      : display === 'left'
        ? { top: 0, left: overlap }
        : display === 'right'
          ? { top: 0, left: 0 }
          : { top: 0, left: 0 };

  const faceUpOffset =
    display === 'top'
      ? { top: 0, left: 0 }
      : display === 'left'
        ? { top: 0, left: 0 }
        : display === 'right'
          ? { top: 0, left: overlap }
          : { top: overlap, left: 0 };

  const containerWidth =
    display === 'left' || display === 'right' ? w + overlap : w;

  const containerHeight =
    display === 'top' || display === 'bottom' ? h + overlap : h;

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
        const faceUpCard = player.faceUp[i];
        const faceDownCard = player.faceDown[i];
        const hasFaceUp = !!faceUpCard;
        const hasFaceDown = !!faceDownCard;
        const faceUpKey = pickKey({ zone: 'faceUp', index: i });

        const slotWidth =
          spreadCards && hasFaceUp && hasFaceDown
            ? isVertical
              ? w
              : w * 2 + slotGap
            : hasFaceUp && hasFaceDown
              ? containerWidth
              : w;

        const slotHeight =
          spreadCards && hasFaceUp && hasFaceDown
            ? isVertical
              ? h * 2 + slotGap
              : h
            : hasFaceUp && hasFaceDown
              ? containerHeight
              : h;

        const slotLayoutStyle = spreadCards
          ? {
              display: 'flex' as const,
              flexDirection: (isVertical ? 'column' : 'row') as 'column' | 'row',
              gap: slotGap,
              alignItems: 'center' as const,
              justifyContent: 'center' as const,
            }
          : { position: 'relative' as const };

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
                        onFaceDownDoubleClick?.(i);
                      }
                    }}
                    onDoubleClick={() => {
                      if (
                        isBottom &&
                        isPlayerTurn &&
                        isFaceDownAvailable(player, i)
                      ) {
                        onFaceDownDoubleClick?.(i);
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
        );
      })}
    </div>
  );
}

function ActivePile({ pile }: { pile: Card[] }) {
  const layout = useLayout();
  const cardW = layout.cardWidth;
  const cardH = layout.cardHeight;
  const overlap = 10;
  const maxVisibleWidth = layout.isMobile ? 150 : 180;
  const actualOverlap =
    pile.length > 1
      ? Math.min(overlap, (maxVisibleWidth - cardW) / (pile.length - 1))
      : overlap;

  return (
    <div
      style={{
        position: 'relative',
        width:
          pile.length > 0
            ? cardW + (pile.length - 1) * actualOverlap
            : cardW,
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
              : '#111827';

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
            <div
              style={{
                position: 'relative',
                width: cardW,
                height: cardH,
              }}
            >
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
        );
      })}

      {pile.length === 0 && (
        <EmptySlot width={cardW} height={cardH} />
      )}
    </div>
  );
}

function ScorePanel({
  players,
  currentId,
}: {
  players: Player[];
  currentId: string;
}) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.07)',
        border: '0.5px solid rgba(255,255,255,0.18)',
        borderRadius: 10,
        padding: '8px 14px',
        minWidth: 110,
        boxShadow: '0 4px 16px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.06)',
        ...sharpText,
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
            }}
          >
            {displayName(p)}
          </span>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{p.score}</span>
        </div>
      ))}
    </div>
  );
}

function SeatBlock({
  player,
  isActiveTurn = false,
  children,
}: {
  player: Player | undefined;
  isActiveTurn?: boolean;
  children?: React.ReactNode;
}) {
  if (!player) return <div />;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: player.seat === 'bottom' ? 4 : 6,
      }}
    >
      <div style={seatBlockNameStyle(isActiveTurn)}>{displayName(player)}</div>
      {children}
    </div>
  );
}

function SeatPointsBanner({
  points,
  winner,
}: {
  points: number;
  winner: boolean;
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
  );
}

type RevealFlags = {
  revealHand: boolean;
  revealFaceDown: boolean;
  showPointsBanner: boolean;
  points: number;
  isWinner: boolean;
};

function OpponentStrip({
  opponents,
  turnRank,
  currentPlayerId,
  getRevealFlags,
  spreadCards = false,
}: {
  opponents: Player[];
  turnRank: Rank | null;
  currentPlayerId: string;
  getRevealFlags: (player: Player | undefined) => RevealFlags;
  spreadCards?: boolean;
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
          const reveal = getRevealFlags(player);
          const isActive = player.id === currentPlayerId;

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
                isActiveTurn={player.id === currentPlayerId}
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
          );
        })}
      </div>
    </div>
  );
}

export default function GameTable() {
  const layout = useLayout();
  const online = useOnlineGame();
  const [showOnlineLobby, setShowOnlineLobby] = useState(
    () => !!new URLSearchParams(window.location.search).get('room')
  );
  const [setupCount, setSetupCount] = useState(4);
  const [setupMode, setSetupMode] = useState<GameMode>('ai');
  const [setupNames, setSetupNames] = useState(() => defaultPlayerNames(4));
  const [state, setState] = useState<GameState>(() =>
    createSetupState(4, 'ai', defaultPlayerNames(4))
  );
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('Choose players and start.');
  const [showPassBanner, setShowPassBanner] = useState(false);
  const [pileBanner, setPileBanner] = useState<{
    text: string;
    variant: PileBannerVariant;
  } | null>(null);
  const [flyingCards, setFlyingCards] = useState<FlyingCard[]>([]);
  const [pendingState, setPendingState] = useState<GameState | null>(null);
  const [roundReveal, setRoundReveal] = useState<RoundRevealState | null>(null);

  const boardRef = useRef<HTMLDivElement | null>(null);
  const pileAreaRef = useRef<HTMLDivElement | null>(null);
  const bottomAreaRef = useRef<HTMLDivElement | null>(null);
  const topAreaRef = useRef<HTMLDivElement | null>(null);
  const leftAreaRef = useRef<HTMLDivElement | null>(null);
  const rightAreaRef = useRef<HTMLDivElement | null>(null);
  const animationTimerRef = useRef<number | null>(null);
  const roundRevealTimersRef = useRef<number[]>([]);

  const mode: GameMode = state.gameMode ?? setupMode;
  const currentPlayer = state.players.find((p) => p.id === state.currentPlayerId);
  const localPlayer =
    mode === 'online'
      ? state.players.find((p) => p.id === online.myPlayerId)
      : mode === 'hotSeat'
        ? currentPlayer
        : state.players.find((p) => p.isHuman) ?? state.players[0];

  const viewSeat: Seat =
    mode === 'online' && localPlayer
      ? localPlayer.seat
      : mode === 'hotSeat' && currentPlayer
        ? currentPlayer.seat
        : 'bottom';

  const isLocalTurn =
    !!localPlayer &&
    state.currentPlayerId === localPlayer.id &&
    state.phase === 'playing';

  const isAnimating =
    flyingCards.length > 0 ||
    pendingState !== null ||
    roundReveal !== null;

  const getSeatRef = useCallback((seat: Seat) => {
    if (seat === 'bottom') return bottomAreaRef;
    if (seat === 'top') return topAreaRef;
    if (seat === 'left') return leftAreaRef;
    return rightAreaRef;
  }, []);

  const showPileBanner = useCallback(
    (text: string, duration = 1500, variant?: PileBannerVariant) => {
      const resolved = variant ?? pileBannerVariant(text);
      setPileBanner({ text, variant: resolved });
      window.setTimeout(() => {
        setPileBanner((current) => (current?.text === text ? null : current));
      }, duration);
    },
    []
  );

  const showEventBannerFromMessage = useCallback(
    (text: string) => {
      const normalized = normalizeMessage(text);
      const upper = normalized.toUpperCase();

      if (upper.includes('PICKED UP THE PILE')) {
        const match = normalized.match(
          /^(.+?)\s+(overplayed and picked up the pile|picked up the pile)/i
        );
        if (match?.[1]) {
          const actor =
            match[1].toUpperCase() === 'YOU' ? 'YOU' : match[1].toUpperCase();
          showPileBanner(
            actor === 'YOU' ? 'YOU PICK UP' : `${actor} PICKS UP`,
            1400,
            'pickup'
          );
          return;
        }
      }

      if (upper.includes('WON THE ROUND')) {
        const match = normalized.match(/^(.+?) won the round/i);
        if (match?.[1]) {
          showPileBanner(`${match[1].toUpperCase()} WINS ROUND`, 2200, 'win');
          return;
        }
      }

      if (upper.includes('CLEAR')) {
        showPileBanner('CLEAR!', 1300, 'clear');
        return;
      }

      if (upper.includes('BAD FLIP')) {
        showPileBanner('BAD FLIP!', 1300, 'bad');
        return;
      }

      if (upper.includes('FLIPPED')) {
        showPileBanner('FLIPPED!', 1200, 'flip');
      }
    },
    [showPileBanner]
  );

  const startRoundRevealSequence = useCallback(
    (
      displayState: GameState,
      pendingFinalState: GameState,
      roundMessage: string,
      initialContinued: string[] = [],
      requiredIds?: string[]
    ) => {
      const winner =
        displayState.players.find(
          (p) =>
            p.hand.length === 0 &&
            p.faceUp.every((c) => !c) &&
            p.faceDown.every((c) => !c)
        ) ?? null;

      const requiredPlayerIds =
        requiredIds ??
        requiredContinuePlayerIds(displayState.players, displayState.gameMode);

      const initial: RoundRevealState = {
        pendingFinalState,
        roundMessage: normalizeMessage(roundMessage),
        winnerId: winner?.id ?? null,
        players: displayState.players.map((p) => ({
          playerId: p.id,
          revealedHand: p.id === winner?.id,
          revealedFaceDown: p.id === winner?.id,
          showPointsBanner: p.id === winner?.id,
          points: p.id === winner?.id ? 0 : roundPenaltyPoints(p),
        })),
        revealComplete: false,
        continuedPlayerIds: [...initialContinued],
        requiredPlayerIds,
      };

      setRoundReveal(initial);
      setState(displayState);
      setSelectedKeys(new Set());
      setPendingState(null);
      setMessage(normalizeMessage(roundMessage));

      roundRevealTimersRef.current.forEach((t) => window.clearTimeout(t));
      roundRevealTimersRef.current = [];

      const losers = displayState.players.filter((p) => p.id !== winner?.id);
      const step = ROUND_REVEAL_PLAYER_STEP_MS;

      losers.forEach((player, index) => {
        const base = ROUND_REVEAL_START_MS + index * step;

        const handTimer = window.setTimeout(() => {
          setRoundReveal((current) =>
            current
              ? {
                  ...current,
                  players: current.players.map((entry) =>
                    entry.playerId === player.id
                      ? { ...entry, revealedHand: true }
                      : entry
                  ),
                }
              : current
          );
        }, base + ROUND_REVEAL_HAND_OFFSET_MS);

        const faceDownTimer = window.setTimeout(() => {
          setRoundReveal((current) =>
            current
              ? {
                  ...current,
                  players: current.players.map((entry) =>
                    entry.playerId === player.id
                      ? { ...entry, revealedFaceDown: true }
                      : entry
                  ),
                }
              : current
          );
        }, base + ROUND_REVEAL_FACE_DOWN_OFFSET_MS);

        const bannerTimer = window.setTimeout(() => {
          setRoundReveal((current) =>
            current
              ? {
                  ...current,
                  players: current.players.map((entry) =>
                    entry.playerId === player.id
                      ? { ...entry, showPointsBanner: true }
                      : entry
                  ),
                }
              : current
          );
        }, base + ROUND_REVEAL_BANNER_OFFSET_MS);

        roundRevealTimersRef.current.push(handTimer, faceDownTimer, bannerTimer);
      });

      const revealDoneTimer = window.setTimeout(() => {
        setRoundReveal((current) =>
          current ? { ...current, revealComplete: true } : current
        );
      }, ROUND_REVEAL_START_MS + losers.length * step + ROUND_REVEAL_BANNER_OFFSET_MS + 600);

      roundRevealTimersRef.current.push(revealDoneTimer);
    },
    []
  );

  const finalizeResolvedResult = useCallback(
    (result: PlayLikeResult) => {
      const round = checkRoundEnd(result.state);

      if (round) {
        startRoundRevealSequence(
          result.state,
          round.state,
          round.message,
          [],
          requiredContinuePlayerIds(result.state.players, mode)
        );
        return;
      }

      const finalState = result.state;
      const finalMessage = normalizeMessage(result.message);

      setState(finalState);
      setMessage(finalMessage);
      setSelectedKeys(new Set());
      setPendingState(null);

      if (result.badFlip) {
        showPileBanner('BAD FLIP!', 1300, 'bad');
      } else if (result.cleared) {
        showPileBanner('CLEAR!', 1300, 'clear');
      } else if (/Flipped Joker/i.test(result.message)) {
        showPileBanner('JOKER!', 1300, 'flip');
      } else if (/Flipped J\b/i.test(result.message)) {
        showPileBanner('JACK!', 1300, 'flip');
      } else {
        showEventBannerFromMessage(result.message);
      }
    },
    [showPileBanner, showEventBannerFromMessage, startRoundRevealSequence, mode]
  );

  const applyResult = useCallback(
    (result: PlayLikeResult | null) => {
      if (!result) return;
      if (result.blocked) {
        setMessage(normalizeMessage(result.message));
        return;
      }
      finalizeResolvedResult(result);
    },
    [finalizeResolvedResult]
  );

  const onlineRoundEndKeyRef = useRef<string | null>(null);

  const animateResolvedResult = useCallback(
    (
      cards: Card[],
      fromSeat: Seat,
      result: PlayLikeResult,
      revealFlipCard?: Card | null
    ) => {
      const boardRect = boardRef.current?.getBoundingClientRect();
      const pileRect = pileAreaRef.current?.getBoundingClientRect();
      const fromRect = getSeatRef(fromSeat).current?.getBoundingClientRect();

      const flipCard =
        revealFlipCard ??
        (result.message.includes('Flipped') || result.badFlip
          ? cards[0] ?? null
          : null);
      const isFlipPlay = flipCard !== null;
      const durationMs = isFlipPlay ? flipFlyDurationMs(flipCard) : 360;

      setPendingState(result.state);
      setSelectedKeys(new Set());

      const runFlyAnimation = () => {
        if (!boardRect || !pileRect || !fromRect || cards.length === 0) {
          setFlyingCards([]);
          finalizeResolvedResult(result);
          return;
        }

        const startCenterX = fromRect.left - boardRect.left + fromRect.width / 2;
        const startCenterY = fromRect.top - boardRect.top + fromRect.height / 2;
        const pileCenterX = pileRect.left - boardRect.left + pileRect.width / 2;
        const pileCenterY = pileRect.top - boardRect.top + pileRect.height / 2;

        const count = cards.length;
        const fanSpacing = 10;
        const staggerMs = isFlipPlay ? 0 : 40;
        const startRotation = seatRotation(fromSeat);

        const overlayCards: FlyingCard[] = cards.map((card, index) => {
          const centeredOffset = (index - (count - 1) / 2) * fanSpacing;
          return {
            id: `${card.rank}-${card.suit}-${card.deckId}-${card.jokerColor ?? 'n'}-${index}-${Date.now()}`,
            card,
            fromX: startCenterX,
            fromY: startCenterY,
            toX: pileCenterX + centeredOffset,
            toY: pileCenterY + Math.abs(centeredOffset) * 0.2,
            startRotation,
            endRotation: 0,
            width: fromSeat === 'bottom' ? layout.cardWidth : layout.opponentCardWidth,
            height: fromSeat === 'bottom' ? layout.cardHeight : layout.opponentCardHeight,
            delayMs: index * staggerMs,
            durationMs,
          };
        });

        setFlyingCards(overlayCards);

        const totalMs = durationMs + (count - 1) * staggerMs + 30;

        if (animationTimerRef.current) {
          window.clearTimeout(animationTimerRef.current);
        }

        animationTimerRef.current = window.setTimeout(() => {
          setFlyingCards([]);
          finalizeResolvedResult(result);
        }, totalMs);
      };

      runFlyAnimation();
    },
    [finalizeResolvedResult, getSeatRef, layout]
  );

  useEffect(() => {
    return () => {
      if (animationTimerRef.current) {
        window.clearTimeout(animationTimerRef.current);
      }
      roundRevealTimersRef.current.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  useEffect(() => {
    const room = new URLSearchParams(window.location.search).get('room')
    if (room) {
      setSetupMode('online')
      setShowOnlineLobby(true)
    }
  }, [])

  useEffect(() => {
    if (setupMode !== 'online' || !online.gameState) return;
    if (online.roundEnd) return;

    setState(online.gameState);
    if (online.message) setMessage(normalizeMessage(online.message));
    setSelectedKeys(new Set());
    setFlyingCards([]);
    setPendingState(null);
    setRoundReveal(null);
    onlineRoundEndKeyRef.current = null;
    setShowOnlineLobby(false);
  }, [online.gameState, online.message, online.roundEnd, setupMode]);

  useEffect(() => {
    if (setupMode !== 'online' || !online.roundEnd) return;

    const rd = online.roundEnd;
    setState(rd.displayState);
    setMessage(normalizeMessage(rd.message));
    setFlyingCards([]);
    setPendingState(null);
    setShowOnlineLobby(false);

    const revealKey = rd.message;
    if (onlineRoundEndKeyRef.current === revealKey) {
      setRoundReveal((current) =>
        current
          ? { ...current, continuedPlayerIds: [...rd.continuedIds] }
          : current
      );
      return;
    }

    onlineRoundEndKeyRef.current = revealKey;
    startRoundRevealSequence(
      rd.displayState,
      rd.pendingState,
      rd.message,
      rd.continuedIds,
      rd.displayState.players.map((p) => p.id)
    );
  }, [online.roundEnd, setupMode, startRoundRevealSequence]);

  useEffect(() => {
    if (state.phase !== 'playing' || mode !== 'ai' || isAnimating) return;
    const current = state.players.find((p) => p.id === state.currentPlayerId);
    if (!current || current.isHuman) return;

    const timer = window.setTimeout(() => {
      const prevState = state;
      const step = runAiStep(state);
      if (!step) return;

      const actor = prevState.players.find(
        (p) => p.id === prevState.currentPlayerId
      );
      if (!actor) {
        applyResult(step);
        return;
      }

      const added = cardsAddedToPile(
        prevState.activePile,
        step.state.activePile
      );

      if (added.length > 0) {
        animateResolvedResult(added, actor.seat, step);
      } else {
        applyResult(step);
      }
    }, 1100);

    return () => window.clearTimeout(timer);
  }, [state, mode, isAnimating, animateResolvedResult, applyResult]);

  useEffect(() => {
    if (mode === 'hotSeat' && state.phase === 'playing') {
      setShowPassBanner(true);
    }
  }, [state.currentPlayerId, mode, state.phase]);

  const toggleSelect = useCallback(
    (pick: CardPick, card: Card) => {
      if (!isLocalTurn || !localPlayer || isAnimating) return;
      const key = pickKey(pick);

      setSelectedKeys((prev) => {
        const next = new Set(prev);

        if (next.has(key)) {
          next.delete(key);
          return next;
        }

        const existingPicks = [...next]
          .map(parsePickKey)
          .filter((p): p is CardPick => p !== null);

        const existingCards = existingPicks
          .map((p) => {
            if (p.zone === 'hand') return localPlayer.hand[p.index];
            if (p.zone === 'faceUp') return localPlayer.faceUp[p.index];
            if (p.zone === 'faceDown') {
              return isFaceDownAvailable(localPlayer, p.index)
                ? localPlayer.faceDown[p.index]
                : null;
            }
            return null;
          })
          .filter((c): c is Card => !!c);

        const lockedRank =
          state.turnRank ??
          (existingCards.length > 0 ? existingCards[0].rank : null);

        if (lockedRank && card.rank !== lockedRank) {
          setMessage(`Select ${lockedRank}s only.`);
          return prev;
        }

        const existingHasFaceDown = existingPicks.some(
          (p) => p.zone === 'faceDown'
        );
        const addingFaceDown = pick.zone === 'faceDown';

        if (state.turnRank !== null && addingFaceDown) {
          setMessage(
            'You cannot add a face-down card after a play has started.'
          );
          return prev;
        }

        if (existingHasFaceDown && addingFaceDown) {
          setMessage('Only one face-down card can be used in a play.');
          return prev;
        }

        if (addingFaceDown && existingPicks.length > 0) {
          setMessage('A face-down card can only be the first card in a play.');
          return prev;
        }

        if (state.turnRank === null && existingCards.length === 0) {
          if (
            pick.zone !== 'faceDown' &&
            !canPlay(card, state.activePile) &&
            !isIntentionalOverplay(card, state.activePile)
          ) {
            setMessage('That card cannot be played on the pile.');
            return prev;
          }
        }

        next.add(key);
        return next;
      });
    },
    [localPlayer, isLocalTurn, state.activePile, state.turnRank, isAnimating]
  );

  const selectedPicks = useMemo(
    () =>
      [...selectedKeys]
        .map(parsePickKey)
        .filter((p): p is CardPick => p !== null),
    [selectedKeys]
  );

  const canOverplaySelected = useMemo(() => {
    if (
      !localPlayer ||
      !isLocalTurn ||
      selectedPicks.length !== 1 ||
      isAnimating
    )
      return false;
    if (state.turnRank !== null) return false;

    const pick = selectedPicks[0];
    if (pick.zone === 'faceDown') return false;

    return playIntentionalOverplay(state, localPlayer.id, pick) !== null;
  }, [localPlayer, isLocalTurn, selectedPicks, state, isAnimating]);

  const handlePlay = useCallback(
    (picksOverride?: CardPick[]) => {
      if (!localPlayer || isAnimating) return;

      const picks = picksOverride ?? selectedPicks;
      if (picks.length === 0) return;

      const preview = playCards(state, localPlayer.id, picks);
      if (preview?.blocked) {
        setMessage(normalizeMessage(preview.message));
        if (picksOverride) {
          setSelectedKeys(new Set(picksOverride.map((p) => pickKey(p))));
        }
        return;
      }

      if (mode === 'online') {
        online.sendPlay(picks);
        setSelectedKeys(new Set());
        return;
      }

      const actor = state.players.find((p) => p.id === localPlayer.id);
      if (!actor) return;

      const playedCards = resolveCardsFromPicks(actor, picks);
      const result = playCards(state, localPlayer.id, picks);
      if (!result || result.blocked) return;

      const added = cardsAddedToPile(state.activePile, result.state.activePile);
      const cardsToAnimate = added.length > 0 ? added : playedCards;

      if (cardsToAnimate.length > 0) {
        animateResolvedResult(cardsToAnimate, actor.seat, result);
      } else {
        applyResult(result);
      }
    },
    [
      localPlayer,
      isAnimating,
      selectedPicks,
      state,
      animateResolvedResult,
      applyResult,
      mode,
      online,
    ]
  );

  const handleCardDoubleClick = useCallback(
    (pick: CardPick, card: Card) => {
      if (!localPlayer || !isLocalTurn || isAnimating) return;

      const key = pickKey(pick);
      const alreadySelected = selectedKeys.has(key);

      const next = alreadySelected
        ? new Set(selectedKeys)
        : new Set([...selectedKeys, key]);

      const nextPicks = [...next]
        .map(parsePickKey)
        .filter((p): p is CardPick => p !== null);

      const preview = playCards(state, localPlayer.id, nextPicks);
      if (!preview) {
        if (!alreadySelected) {
          toggleSelect(pick, card);
        }
        return;
      }

      if (preview.blocked) {
        setSelectedKeys(next);
        setMessage(normalizeMessage(preview.message));
        return;
      }

      setSelectedKeys(next);
      handlePlay(nextPicks);
    },
    [
      localPlayer,
      isLocalTurn,
      isAnimating,
      selectedKeys,
      state,
      toggleSelect,
      handlePlay,
    ]
  );

  const handleCardTap = useCallback(
    (pick: CardPick, card: Card) => {
      if (!localPlayer || !isLocalTurn || isAnimating) return;
      const key = pickKey(pick);
      if (layout.isTouch && selectedKeys.has(key)) {
        handleCardDoubleClick(pick, card);
      } else {
        toggleSelect(pick, card);
      }
    },
    [
      localPlayer,
      isLocalTurn,
      isAnimating,
      layout.isTouch,
      selectedKeys,
      handleCardDoubleClick,
      toggleSelect,
    ]
  );

  const handleOverplay = () => {
    if (!localPlayer || selectedPicks.length !== 1 || isAnimating) return;
    if (mode === 'online') {
      online.sendOverplay(selectedPicks[0]);
      setSelectedKeys(new Set());
      return;
    }
    applyResult(
      playIntentionalOverplay(state, localPlayer.id, selectedPicks[0])
    );
  };

  const handlePickUp = () => {
    if (!localPlayer || isAnimating) return;
    if (!canPickUpPile(state, localPlayer.id)) return;

    if (mode === 'online') {
      online.sendPickUp();
      setSelectedKeys(new Set());
      return;
    }

    const previousId = localPlayer.id;
    const next = pickUpPile(state, localPlayer.id);
    if (next === state) return;

    setState(next);
    setMessage(turnHandoffMessage(next, previousId));
    setSelectedKeys(new Set());
    showPileBanner('PICK UP', 1300, 'pickup');
  };

  const syncSetupState = (
    count: number,
    nextMode: GameMode,
    names: string[]
  ) => {
    setState(createSetupState(count, nextMode, names));
  };

  const handleStart = () => {
    const names = setupMode === 'hotSeat' ? setupNames : undefined;
    const next = startGame(setupCount, setupMode, names);
    setState(next);
    const first = next.players[0];
    setMessage(`${displayPossessive(first)} turn — select cards to play.`);
    setSelectedKeys(new Set());
    setShowPassBanner(setupMode === 'hotSeat');
  };

  const handleNewGame = () => {
    if (mode === 'online') {
      online.sendNewGame();
      setShowOnlineLobby(true);
    }
    setState(createSetupState(setupCount, setupMode, setupNames));
    setMessage('Choose players and start.');
    setSelectedKeys(new Set());
    setShowPassBanner(false);
    setFlyingCards([]);
    setPendingState(null);
    setRoundReveal(null);
    roundRevealTimersRef.current.forEach((t) => window.clearTimeout(t));
    roundRevealTimersRef.current = [];
  };

  const handleContinueAfterRoundReveal = () => {
    if (!roundReveal?.revealComplete) return;

    if (mode === 'online') {
      if (!localPlayer) return;
      if (roundReveal.continuedPlayerIds.includes(localPlayer.id)) return;
      online.sendContinueRound();
      return;
    }

    const nextId = roundReveal.requiredPlayerIds.find(
      (id) => !roundReveal.continuedPlayerIds.includes(id)
    );
    if (!nextId) return;

    const nextContinued = [...roundReveal.continuedPlayerIds, nextId];
    const allReady = roundReveal.requiredPlayerIds.every((id) =>
      nextContinued.includes(id)
    );

    if (allReady) {
      setState(roundReveal.pendingFinalState);
      setMessage(roundReveal.roundMessage);
      setRoundReveal(null);
      roundRevealTimersRef.current.forEach((t) => window.clearTimeout(t));
      roundRevealTimersRef.current = [];
      return;
    }

    setRoundReveal({ ...roundReveal, continuedPlayerIds: nextContinued });
  };

  const tiedAtEnd =
    state.phase === 'finished' &&
    new Set(state.players.map((p) => p.score)).size > 1 &&
    state.players.filter(
      (p) => p.score === Math.min(...state.players.map((x) => x.score))
    ).length > 1;

  const useExpandedTable = state.playerCount > MAX_LOCAL_PLAYERS;
  const tablePlayers = pendingState?.players ?? state.players;
  const showLeft = !useExpandedTable && state.playerCount >= 3;
  const showRight = !useExpandedTable && state.playerCount === 4;
  const opponents =
    useExpandedTable && localPlayer
      ? opponentsFromView(tablePlayers, localPlayer.id)
      : [];
  const top = playerAtDisplay(
    tablePlayers,
    'top',
    viewSeat,
    state.playerCount
  );
  const left = playerAtDisplay(
    tablePlayers,
    'left',
    viewSeat,
    state.playerCount
  );
  const right = playerAtDisplay(
    tablePlayers,
    'right',
    viewSeat,
    state.playerCount
  );
  const bottom =
    useExpandedTable && localPlayer
      ? tablePlayers.find((p) => p.id === localPlayer.id) ?? localPlayer
      : playerAtDisplay(tablePlayers, 'bottom', viewSeat, state.playerCount) ??
        tablePlayers[0];
  const showTable =
    state.phase === 'playing' || state.phase === 'finished' || !!roundReveal

  const bottomHandRows = bottom
    ? [
        bottom.hand.slice(0, 5).map((card, i) => ({ card, handIndex: i })),
        bottom.hand.slice(5, 10).map((card, i) => ({ card, handIndex: i + 5 })),
        bottom.hand.slice(10).map((card, i) => ({ card, handIndex: i + 10 })),
      ]
    : [[], [], []]

  const revealEntryById = new Map(
    (roundReveal?.players ?? []).map((entry) => [entry.playerId, entry])
  );

  const getRevealFlags = (player: Player | undefined) => {
    if (!player) {
      return {
        revealHand: false,
        revealFaceDown: false,
        showPointsBanner: false,
        points: 0,
        isWinner: false,
      };
    }

    const entry = revealEntryById.get(player.id);
    return {
      revealHand: !!entry?.revealedHand,
      revealFaceDown: !!entry?.revealedFaceDown,
      showPointsBanner: !!entry?.showPointsBanner,
      points: entry?.points ?? 0,
      isWinner: roundReveal?.winnerId === player.id,
    };
  };

  const topReveal = getRevealFlags(top);
  const leftReveal = getRevealFlags(left);
  const rightReveal = getRevealFlags(right);
  const bottomReveal = getRevealFlags(bottom);
  const spreadRoundCards = !!roundReveal;

  const roundContinueCount = roundReveal
    ? roundReveal.continuedPlayerIds.length
    : 0;
  const roundContinueRequired = roundReveal?.requiredPlayerIds.length ?? 0;
  const nextContinuePlayerId = roundReveal?.requiredPlayerIds.find(
    (id) => !roundReveal.continuedPlayerIds.includes(id)
  );
  const nextContinuePlayer = nextContinuePlayerId
    ? state.players.find((p) => p.id === nextContinuePlayerId)
    : null;
  const localHasContinued =
    !!localPlayer &&
    !!roundReveal?.continuedPlayerIds.includes(localPlayer.id);
  const canPressContinue =
    !!roundReveal?.revealComplete &&
    (mode === 'online'
      ? !!localPlayer && !localHasContinued
      : !!nextContinuePlayerId);
  const continueButtonLabel = !roundReveal?.revealComplete
    ? 'Reviewing cards…'
    : mode === 'online'
      ? localHasContinued
        ? `Waiting ${roundContinueCount}/${roundContinueRequired}`
        : 'CONTINUE'
      : nextContinuePlayer
        ? `${displayName(nextContinuePlayer)} — CONTINUE (${roundContinueCount}/${roundContinueRequired})`
        : 'CONTINUE';

  const actionHint = actionHintForTurn(state, isLocalTurn, !!roundReveal);
  const turnChipLabel =
    currentPlayer && isLocalTurn
      ? 'Your turn'
      : currentPlayer
        ? `${displayName(currentPlayer)}'s turn`
        : '';
  const canPickUp =
    !!localPlayer && canPickUpPile(state, localPlayer.id) && !isAnimating;

  return (
    <div
      className="game-felt"
      style={{
        minHeight: '100dvh',
        color: 'white',
        padding:
          'max(6px, env(safe-area-inset-top)) max(6px, env(safe-area-inset-right)) max(max(6px, env(safe-area-inset-bottom)), env(keyboard-inset-height, 0px)) max(6px, env(safe-area-inset-left))',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif',
        overflowX: 'hidden',
        ...sharpText,
      }}
    >
      <style>{`
        @keyframes flying-card-to-pile {
          0% {
            transform:
              translate3d(var(--from-x), var(--from-y), 0)
              rotate(var(--from-rot))
              scale(1);
            opacity: 1;
          }
          70% {
            opacity: 1;
          }
          100% {
            transform:
              translate3d(var(--to-x), var(--to-y), 0)
              rotate(var(--to-rot))
              scale(0.96);
            opacity: 1;
          }
        }
      `}</style>

      {state.phase === 'setup' && (
        <SetupScreen
          playerCount={setupCount}
          gameMode={setupMode}
          playerNames={setupNames}
          onPlayerCountChange={(n) => {
            setSetupCount(n);
            const names = defaultPlayerNames(n).map(
              (label, i) => setupNames[i] ?? label
            );
            setSetupNames(names);
            syncSetupState(n, setupMode, names);
          }}
          onGameModeChange={(nextMode) => {
            setSetupMode(nextMode);
            syncSetupState(setupCount, nextMode, setupNames);
          }}
          onPlayerNameChange={(index, name) => {
            const names = [...setupNames];
            names[index] = name;
            setSetupNames(names);
            syncSetupState(setupCount, setupMode, names);
          }}
          onStart={handleStart}
          onPlayOnline={() => setShowOnlineLobby(true)}
        />
      )}

      {showOnlineLobby && setupMode === 'online' && online.status !== 'playing' && (
        <OnlineLobby
          session={online}
          onBack={() => {
            setShowOnlineLobby(false);
            if (!online.roomCode) setSetupMode('ai');
          }}
        />
      )}

      {state.phase === 'playing' &&
        mode === 'hotSeat' &&
        showPassBanner &&
        currentPlayer && (
          <HotSeatBanner
            playerName={`${displayPossessive(currentPlayer)} turn`}
            onDismiss={() => setShowPassBanner(false)}
          />
        )}

      {state.phase === 'finished' && !roundReveal && (
        <GameOverScreen
          players={state.players}
          tied={tiedAtEnd}
          onNewGame={handleNewGame}
          onTiebreaker={() => {
            if (mode === 'online') {
              online.sendTiebreaker();
              return;
            }
            setState(startTiebreakerRound(state));
            setMessage('Tiebreaker round — lowest score deals first.');
            setSelectedKeys(new Set());
          }}
        />
      )}

      <div
        ref={boardRef}
        className="game-board"
        style={{
          width: '100%',
          maxWidth: layout.boardMaxWidth,
          margin: '0 auto',
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: layout.isMobile ? 8 : 6,
            gap: 8,
          }}
        >
          <div>
            <div
              style={{
                fontSize: layout.isMobile ? 24 : 22,
                fontWeight: 800,
                letterSpacing: -0.3,
              }}
            >
              J&amp;J
            </div>
            <div
              style={{
                fontSize: 12,
                opacity: 0.72,
                letterSpacing: 0.2,
                textTransform: 'uppercase',
              }}
            >
              {mode === 'hotSeat'
                ? 'Hot-seat'
                : mode === 'online'
                  ? 'Online'
                  : 'vs AI'}
            </div>
          </div>
          <button
            type="button"
            onClick={handleNewGame}
            disabled={isAnimating && !roundReveal?.revealComplete}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.18)',
              background:
                isAnimating && !roundReveal?.revealComplete
                  ? 'rgba(255,255,255,0.05)'
                  : 'rgba(255,255,255,0.08)',
              color:
                isAnimating && !roundReveal?.revealComplete
                  ? 'rgba(255,255,255,0.45)'
                  : 'white',
              fontWeight: 700,
              cursor:
                isAnimating && !roundReveal?.revealComplete
                  ? 'default'
                  : 'pointer',
            }}
          >
            NEW GAME
          </button>
        </div>

        {state.phase === 'playing' && !roundReveal && currentPlayer && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <TurnChip label={turnChipLabel} isYours={isLocalTurn} />
          </div>
        )}

        {state.phase === 'setup' && (
          <p style={{ textAlign: 'center', opacity: 0.85, marginTop: 40 }}>
            Use the setup dialog above to choose mode and players, then start.
          </p>
        )}

        {showTable && bottom && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: showLeft
                ? `${layout.sideColumnWidth}px 1fr ${layout.sideColumnWidth}px`
                : '1fr',
              gridTemplateRows: 'auto auto auto auto',
              gap: layout.isMobile ? 4 : 8,
              alignItems: 'center',
              justifyItems: 'center',
            }}
          >
            {showLeft && <div />}

            <div
              ref={topAreaRef}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
                position: 'relative',
              }}
            >
              <ScorePanel
                players={roundReveal?.pendingFinalState.players ?? state.players}
                currentId={state.currentPlayerId}
              />

              {useExpandedTable ? (
                <OpponentStrip
                  opponents={opponents}
                  turnRank={state.turnRank}
                  currentPlayerId={state.currentPlayerId}
                  getRevealFlags={getRevealFlags}
                  spreadCards={spreadRoundCards}
                />
              ) : (
              <SeatBlock
                player={top}
                isActiveTurn={top?.id === state.currentPlayerId && !roundReveal}
              >
                {top && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                      position: 'relative',
                    }}
                  >
                    <OpponentHand
                      player={top}
                      display="top"
                      revealCards={topReveal.revealHand}
                      spreadCards={spreadRoundCards && topReveal.revealHand}
                    />
                    <TableCards
                      player={top}
                      display="top"
                      isBottom={false}
                      selectedKeys={new Set()}
                      turnRank={state.turnRank}
                      isPlayerTurn={false}
                      revealFaceDown={topReveal.revealFaceDown}
                      spreadCards={spreadRoundCards && topReveal.revealFaceDown}
                    />
                    {topReveal.showPointsBanner && (
                      <SeatPointsBanner
                        points={topReveal.points}
                        winner={topReveal.isWinner}
                      />
                    )}
                  </div>
                )}
              </SeatBlock>
              )}
            </div>

            {showRight && <div />}

            {showLeft && (
              <div ref={leftAreaRef} style={{ position: 'relative' }}>
                <SeatBlock
                  player={left}
                  isActiveTurn={left?.id === state.currentPlayerId && !roundReveal}
                >
                  {left && (
                    <div
                      style={{
                        display: 'flex',
                        gap: 16,
                        alignItems: 'center',
                        position: 'relative',
                      }}
                    >
                      <OpponentHand
                        player={left}
                        display="left"
                        revealCards={leftReveal.revealHand}
                        spreadCards={spreadRoundCards && leftReveal.revealHand}
                      />
                      <TableCards
                        player={left}
                        display="left"
                        isBottom={false}
                        selectedKeys={new Set()}
                        turnRank={state.turnRank}
                        isPlayerTurn={false}
                        revealFaceDown={leftReveal.revealFaceDown}
                        spreadCards={spreadRoundCards && leftReveal.revealFaceDown}
                      />
                      {leftReveal.showPointsBanner && (
                        <SeatPointsBanner
                          points={leftReveal.points}
                          winner={leftReveal.isWinner}
                        />
                      )}
                    </div>
                  )}
                </SeatBlock>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <div style={{ fontWeight: 700 }}>Active pile</div>

              <div
                ref={pileAreaRef}
                style={{
                  position: 'relative',
                  minHeight: layout.cardHeight + 24,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: layout.cardWidth + 36,
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
                <MessageBar
                  message={roundReveal.roundMessage}
                  hint={
                    !roundReveal.revealComplete
                      ? 'Reviewing leftover cards…'
                      : 'Everyone must continue before the next deal.'
                  }
                />
              ) : (
                <MessageBar
                  message={normalizeMessage(message)}
                  hint={actionHint}
                />
              )}

              {roundReveal && (
                <button
                  type="button"
                  disabled={!canPressContinue}
                  onClick={handleContinueAfterRoundReveal}
                  style={{
                    ...btnStyle(canPressContinue),
                    minWidth: 220,
                    marginTop: 8,
                  }}
                >
                  {continueButtonLabel}
                </button>
              )}
            </div>

            {showRight && (
              <div ref={rightAreaRef} style={{ position: 'relative' }}>
                <SeatBlock
                  player={right}
                  isActiveTurn={right?.id === state.currentPlayerId && !roundReveal}
                >
                  {right && (
                    <div
                      style={{
                        display: 'flex',
                        gap: 16,
                        alignItems: 'center',
                        position: 'relative',
                      }}
                    >
                      <TableCards
                        player={right}
                        display="right"
                        isBottom={false}
                        selectedKeys={new Set()}
                        turnRank={state.turnRank}
                        isPlayerTurn={false}
                        revealFaceDown={rightReveal.revealFaceDown}
                        spreadCards={spreadRoundCards && rightReveal.revealFaceDown}
                      />
                      <OpponentHand
                        player={right}
                        display="right"
                        revealCards={rightReveal.revealHand}
                        spreadCards={spreadRoundCards && rightReveal.revealHand}
                      />
                      {rightReveal.showPointsBanner && (
                        <SeatPointsBanner
                          points={rightReveal.points}
                          winner={rightReveal.isWinner}
                        />
                      )}
                    </div>
                  )}
                </SeatBlock>
              </div>
            )}

            <div />
            <div ref={bottomAreaRef} style={{ position: 'relative' }}>
              <SeatBlock
                player={bottom}
                isActiveTurn={bottom?.id === state.currentPlayerId && !roundReveal}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 20,
                    width: '100%',
                    position: 'relative',
                  }}
                >
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
                      if (isAnimating) return;
                      const card = bottom.faceUp[idx];
                      if (card) {
                        handleCardTap({ zone: 'faceUp', index: idx }, card);
                      }
                    }}
                    onFaceUpDoubleClick={(idx) => {
                      if (isAnimating) return;
                      const card = bottom.faceUp[idx];
                      if (!card) return;
                      const pick = { zone: 'faceUp', index: idx } as const;
                      handleCardDoubleClick(pick, card);
                    }}
                    onFaceDownDoubleClick={(idx) => {
                      if (isAnimating) return;
                      if (mode === 'online') {
                        online.sendFlip(idx);
                        return;
                      }
                      const flippedCard = bottom.faceDown[idx];
                      if (!flippedCard) return;
                      const result = flipFaceDown(state, bottom.id, idx);
                      if (!result) return;
                      const added = cardsAddedToPile(
                        state.activePile,
                        result.state.activePile
                      );
                      const cardsToAnimate =
                        added.length > 0 ? added : [flippedCard];
                      animateResolvedResult(
                        cardsToAnimate,
                        bottom.seat,
                        result,
                        flippedCard
                      );
                    }}
                  />

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                      paddingBottom: 4,
                      width: '100%',
                    }}
                  >
                    {bottomHandRows.map((row, rowIndex) =>
                      row.length > 0 ? (
                        <div
                          key={rowIndex}
                          style={{
                            display: 'flex',
                            justifyContent: 'center',
                            gap: layout.handGap,
                            width: '100%',
                          }}
                        >
                          {row.map(({ card, handIndex }) => {
                            const pick = { zone: 'hand', index: handIndex } as const;
                            const key = pickKey(pick);

                            return (
                              <CardFace
                                key={key}
                                card={card}
                                width={layout.cardWidth}
                                height={layout.cardHeight}
                                selected={selectedKeys.has(key)}
                                faded={
                                  !isLocalTurn ||
                                  (state.turnRank !== null &&
                                    card.rank !== state.turnRank)
                                }
                                onClick={() => {
                                  if (isAnimating) return;
                                  handleCardTap(pick, card);
                                }}
                                onDoubleClick={() => {
                                  if (isAnimating) return;
                                  handleCardDoubleClick(pick, card);
                                }}
                              />
                            );
                          })}
                        </div>
                      ) : null
                    )}
                  </div>

                  {bottomReveal.showPointsBanner && (
                    <SeatPointsBanner
                      points={bottomReveal.points}
                      winner={bottomReveal.isWinner}
                    />
                  )}

                  {!roundReveal && (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'row',
                        gap: layout.isMobile ? 6 : 8,
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginTop: 8,
                        width: '100%',
                        padding: '0 4px',
                      }}
                    >
                      {selectedPicks.length > 0 && (
                        <button
                          type="button"
                          disabled={isAnimating}
                          onClick={() => handlePlay()}
                          style={{
                            ...btnStyle(!isAnimating),
                            background: 'rgba(22,163,74,0.9)',
                            border: '1px solid rgba(255,255,255,0.25)',
                            minWidth: layout.isMobile ? 100 : 110,
                            fontWeight: 800,
                          }}
                        >
                          PLAY
                          {selectedPicks.length > 1
                            ? ` (${selectedPicks.length})`
                            : ''}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={!canOverplaySelected}
                        onClick={handleOverplay}
                        style={btnStyle(canOverplaySelected)}
                      >
                        OVERPLAY
                      </button>
                      <button
                        type="button"
                        disabled={!canPickUp}
                        onClick={handlePickUp}
                        style={btnStyle(canPickUp)}
                      >
                        PICK UP
                      </button>
                      <button
                        type="button"
                        disabled={!canEndTurn(state, bottom.id) || isAnimating}
                        onClick={() => {
                          if (mode === 'online') {
                            online.sendEndTurn();
                            setSelectedKeys(new Set());
                            return;
                          }
                          const previousId = bottom.id;
                          const next = endTurn(state, bottom.id);
                          if (next === state) {
                            setMessage(
                              'You must play, flip, or overplay before ending your turn.'
                            );
                            return;
                          }
                          setState(next);
                          setMessage(turnHandoffMessage(next, previousId));
                          setSelectedKeys(new Set());
                        }}
                        style={{
                          ...btnStyle(
                            canEndTurn(state, bottom.id) && !isAnimating
                          ),
                          whiteSpace: 'nowrap',
                          minWidth: 96,
                        }}
                      >
                        END TURN
                      </button>
                    </div>
                  )}
                </div>
              </SeatBlock>
            </div>
            <div />
          </div>
        )}

        {flyingCards.map((item) => (
          <div
            key={item.id}
            className="card-surface"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              zIndex: 60,
              pointerEvents: 'none',
              willChange: 'transform, opacity',
              ['--from-x' as string]: `${item.fromX - item.width / 2}px`,
              ['--from-y' as string]: `${item.fromY - item.height / 2}px`,
              ['--to-x' as string]: `${item.toX - item.width / 2}px`,
              ['--to-y' as string]: `${item.toY - item.height / 2}px`,
              ['--from-rot' as string]: `${item.startRotation}deg`,
              ['--to-rot' as string]: `${item.endRotation}deg`,
              animationName: 'flying-card-to-pile',
              animationDuration: `${item.durationMs}ms`,
              animationTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
              animationDelay: `${item.delayMs}ms`,
              animationFillMode: 'forwards',
              ...gpuLayer,
            }}
          >
            <CardFace
              card={item.card}
              width={item.width}
              height={item.height}
              rotation={item.startRotation}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function btnStyle(enabled: boolean): React.CSSProperties {
  return {
    padding: '11px 18px',
    borderRadius: 10,
    border: enabled
      ? '0.5px solid rgba(255,255,255,0.28)'
      : '0.5px solid rgba(255,255,255,0.12)',
    background: enabled
      ? 'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.08) 100%)'
      : 'rgba(255,255,255,0.05)',
    color: enabled ? 'white' : 'rgba(255,255,255,0.25)',
    fontWeight: 700,
    fontSize: 14,
    cursor: enabled ? 'pointer' : 'default',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    boxShadow: enabled
      ? '0 1px 0 rgba(255,255,255,0.12) inset, 0 4px 14px rgba(0,0,0,0.18)'
      : 'none',
    ...sharpText,
  };
}