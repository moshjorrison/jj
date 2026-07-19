import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { runAiStep } from './ai';
import { CardBack, CardFace, EmptySlot, cardFaceRotation } from './cardUi';
import {
  AI_STEP_DELAY_MS,
  HAND_END_DELAY_MS,
  ROUND_END_DELAY_MS,
} from './constants';
import { useLayout } from './LayoutContext';
import { OnlineLobby } from './multiplayer/OnlineLobby';
import { useOnlineGame } from './multiplayer/useOnlineGame';
import { GameOverScreen } from './GameOverScreen';
import { HotSeatBanner } from './HotSeatBanner';
import { SetupScreen } from './SetupScreen';
import { defaultPlayerNames, playerAtDisplay } from './seats';
import {
  canPlay,
  isFaceDownAvailable,
  isIntentionalOverplay,
} from './gameLogic';
import {
  checkRoundEnd,
  createSetupState,
  endTurn,
  flipFaceDown,
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
  readyToContinue: boolean;
};

function displayName(player: Player) {
  return player.id === 'player-0' ? 'You' : player.name;
}

function displayPossessive(player: Player) {
  return player.id === 'player-0' ? 'Your' : `${player.name}'s`;
}

function normalizeMessage(message: string) {
  return message.replaceAll('Player 1', 'You').replaceAll("You's", 'Your');
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
}: {
  player: Player;
  display: Seat;
  revealCards?: boolean;
}) {
  const layout = useLayout();
  const count = player.hand.length;
  if (count === 0) return null;

  const isVertical = display === 'left' || display === 'right';
  const cardW = layout.opponentCardWidth;
  const cardH = layout.opponentCardHeight;
  const step = isVertical ? layout.rightHandStep : layout.opponentHandStep;
  const maxSize = 300;
  const actualStep =
    count > 1
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
}) {
  const layout = useLayout();
  const w = isBottom ? layout.cardWidth : layout.opponentCardWidth;
  const h = isBottom ? layout.cardHeight : layout.opponentCardHeight;
  const overlap = 10;
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
        gap: isVertical ? 2 : 12,
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

        return (
          <div
            key={i}
            style={{
              position: 'relative',
              width: hasFaceUp && hasFaceDown ? containerWidth : w,
              height: hasFaceUp && hasFaceDown ? containerHeight : h,
            }}
          >
            {hasFaceDown && (
              <div
                style={{
                  position: 'absolute',
                  ...faceDownOffset,
                  zIndex: 1,
                }}
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
                style={{
                  position: 'absolute',
                  ...faceUpOffset,
                  zIndex: 2,
                }}
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
        border: '1px solid rgba(255,255,255,0.15)',
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
  children,
}: {
  player: Player | undefined;
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
      <div
        style={{
          fontWeight: 700,
          fontSize: 14,
          lineHeight: 1,
        }}
      >
        {displayName(player)}
      </div>
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
  const [pileBanner, setPileBanner] = useState<string | null>(null);
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
    flyingCards.length > 0 || pendingState !== null || roundReveal !== null;

  const getSeatRef = useCallback((seat: Seat) => {
    if (seat === 'bottom') return bottomAreaRef;
    if (seat === 'top') return topAreaRef;
    if (seat === 'left') return leftAreaRef;
    return rightAreaRef;
  }, []);

  const showPileBanner = useCallback((text: string, duration = 1500) => {
    setPileBanner(text);
    window.setTimeout(() => {
      setPileBanner((current) => (current === text ? null : current));
    }, duration);
  }, []);

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
          showPileBanner(actor === 'YOU' ? 'YOU PICK UP' : `${actor} PICKS UP`);
          return;
        }
      }

      if (upper.includes('WON THE ROUND')) {
        const match = normalized.match(/^(.+?) won the round/i);
        if (match?.[1]) {
          showPileBanner(`${match[1].toUpperCase()} WINS ROUND`, 2200);
          return;
        }
      }

      if (upper.includes('CLEAR')) {
        showPileBanner('CLEAR!', 1300);
        return;
      }

      if (upper.includes('BAD FLIP')) {
        showPileBanner('BAD FLIP!', 1300);
      }
    },
    [showPileBanner]
  );

  const startRoundRevealSequence = useCallback(
    (roundState: GameState, roundMessage: string) => {
      const winner =
        roundState.players.find(
          (p) =>
            p.hand.length === 0 &&
            p.faceUp.every((c) => !c) &&
            p.faceDown.every((c) => !c)
        ) ?? null;

      const initial: RoundRevealState = {
        pendingFinalState: roundState,
        roundMessage: normalizeMessage(roundMessage),
        winnerId: winner?.id ?? null,
        players: roundState.players.map((p) => ({
          playerId: p.id,
          revealedHand: p.id === winner?.id,
          revealedFaceDown: p.id === winner?.id,
          showPointsBanner: p.id === winner?.id,
          points: p.id === winner?.id ? 0 : roundPenaltyPoints(p),
        })),
        readyToContinue: false,
      };

      setRoundReveal(initial);
      setSelectedKeys(new Set());
      setPendingState(null);
      setMessage(normalizeMessage(roundMessage));

      roundRevealTimersRef.current.forEach((t) => window.clearTimeout(t));
      roundRevealTimersRef.current = [];

      const losers = roundState.players.filter((p) => p.id !== winner?.id);

      losers.forEach((player, index) => {
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
        }, 500 + index * 850);

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
        }, 980 + index * 850);

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
        }, 1420 + index * 850);

        roundRevealTimersRef.current.push(handTimer, faceDownTimer, bannerTimer);
      });

      const readyTimer = window.setTimeout(() => {
        setRoundReveal((current) =>
          current ? { ...current, readyToContinue: true } : current
        );
      }, 1700 + losers.length * 850);

      roundRevealTimersRef.current.push(readyTimer);
    },
    []
  );

  const finalizeResolvedResult = useCallback(
    (result: PlayLikeResult) => {
      const round = checkRoundEnd(result.state);

      if (round) {
        startRoundRevealSequence(round.state, round.message);
        return;
      }

      const finalState = result.state;
      const finalMessage = normalizeMessage(result.message);

      setState(finalState);
      setMessage(finalMessage);
      setSelectedKeys(new Set());
      setPendingState(null);

      if (result.badFlip) {
        showPileBanner('BAD FLIP!', 1300);
      } else if (result.cleared) {
        showPileBanner('CLEAR!', 1300);
      } else {
        showEventBannerFromMessage(result.message);
      }
    },
    [showPileBanner, showEventBannerFromMessage, startRoundRevealSequence]
  );

  const applyResult = useCallback(
    (result: PlayLikeResult | null) => {
      if (!result) return;
      finalizeResolvedResult(result);
    },
    [finalizeResolvedResult]
  );

  const animateResolvedResult = useCallback(
    (cards: Card[], fromSeat: Seat, result: PlayLikeResult) => {
      const boardRect = boardRef.current?.getBoundingClientRect();
      const pileRect = pileAreaRef.current?.getBoundingClientRect();
      const fromRect = getSeatRef(fromSeat).current?.getBoundingClientRect();

      if (!boardRect || !pileRect || !fromRect || cards.length === 0) {
        finalizeResolvedResult(result);
        return;
      }

      const startCenterX = fromRect.left - boardRect.left + fromRect.width / 2;
      const startCenterY = fromRect.top - boardRect.top + fromRect.height / 2;
      const pileCenterX = pileRect.left - boardRect.left + pileRect.width / 2;
      const pileCenterY = pileRect.top - boardRect.top + pileRect.height / 2;

      const count = cards.length;
      const fanSpacing = 10;
      const staggerMs = 40;
      const durationMs = 360;
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

      setPendingState(result.state);
      setSelectedKeys(new Set());
      setFlyingCards(overlayCards);

      const totalMs = durationMs + (count - 1) * staggerMs + 30;

      if (animationTimerRef.current) {
        window.clearTimeout(animationTimerRef.current);
      }

      animationTimerRef.current = window.setTimeout(() => {
        setFlyingCards([]);
        finalizeResolvedResult(result);
      }, totalMs);
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
    setState(online.gameState);
    if (online.message) setMessage(normalizeMessage(online.message));
    setSelectedKeys(new Set());
    setFlyingCards([]);
    setPendingState(null);
    setRoundReveal(null);
    setShowOnlineLobby(false);
  }, [online.gameState, online.message, setupMode]);

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

      if (mode === 'online') {
        online.sendPlay(picks);
        setSelectedKeys(new Set());
        return;
      }

      const actor = state.players.find((p) => p.id === localPlayer.id);
      if (!actor) return;

      const playedCards = resolveCardsFromPicks(actor, picks);
      const result = playCards(state, localPlayer.id, picks);
      if (!result) return;

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

      const singleResult = playCards(state, localPlayer.id, nextPicks);
      if (!singleResult) {
        if (!alreadySelected) {
          toggleSelect(pick, card);
        }
        return;
      }

      const forceAddOnClearRanks = new Set<Rank>([
        'A',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        '8',
        '9',
        '10',
        'Q',
        'K',
      ]);

      const shouldForceAddOnClear = forceAddOnClearRanks.has(card.rank);

      const totalMatchingCardsAvailable = (() => {
        const selectedKeySet = new Set(next);
        const rankToMatch = state.turnRank ?? card.rank;
        let total = nextPicks.length;

        for (let i = 0; i < localPlayer.hand.length; i++) {
          const candidate = localPlayer.hand[i];
          const candidatePick: CardPick = { zone: 'hand', index: i };
          const candidateKey = pickKey(candidatePick);

          if (selectedKeySet.has(candidateKey)) continue;
          if (!candidate) continue;
          if (candidate.rank !== rankToMatch) continue;

          const testResult = playCards(state, localPlayer.id, [
            ...nextPicks,
            candidatePick,
          ]);
          if (testResult) {
            total += 1;
          }
        }

        for (let i = 0; i < localPlayer.faceUp.length; i++) {
          const candidate = localPlayer.faceUp[i];
          if (!candidate) continue;

          const candidatePick: CardPick = { zone: 'faceUp', index: i };
          const candidateKey = pickKey(candidatePick);

          if (selectedKeySet.has(candidateKey)) continue;
          if (candidate.rank !== rankToMatch) continue;

          const testResult = playCards(state, localPlayer.id, [
            ...nextPicks,
            candidatePick,
          ]);
          if (testResult) {
            total += 1;
          }
        }

        return total;
      })();

      if (
        shouldForceAddOnClear &&
        singleResult.cleared &&
        totalMatchingCardsAvailable >= 4
      ) {
        setMessage(
          'Clear available — select any extra matching cards first, then double-click to play.'
        );
        setSelectedKeys(next);
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
    if (!roundReveal?.readyToContinue) return;
    setState(roundReveal.pendingFinalState);
    setMessage(roundReveal.roundMessage);
    setRoundReveal(null);
  };

  const tiedAtEnd =
    state.phase === 'finished' &&
    new Set(state.players.map((p) => p.score)).size > 1 &&
    state.players.filter(
      (p) => p.score === Math.min(...state.players.map((x) => x.score))
    ).length > 1;

  const showLeft = state.playerCount >= 3;
  const showRight = state.playerCount === 4;
  const top = playerAtDisplay(
    state.players,
    'top',
    viewSeat,
    state.playerCount
  );
  const left = playerAtDisplay(
    state.players,
    'left',
    viewSeat,
    state.playerCount
  );
  const right = playerAtDisplay(
    state.players,
    'right',
    viewSeat,
    state.playerCount
  );
  const bottom =
    playerAtDisplay(state.players, 'bottom', viewSeat, state.playerCount) ??
    state.players[0]
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

  return (
    <div
      style={{
        minHeight: '100dvh',
        background:
          'radial-gradient(circle at center, #14532d 0%, #0f3d22 65%, #0b2a18 100%)',
        color: 'white',
        padding:
          'max(4px, env(safe-area-inset-top)) max(4px, env(safe-area-inset-right)) max(4px, env(safe-area-inset-bottom)) max(4px, env(safe-area-inset-left))',
        fontFamily: 'Inter, system-ui, sans-serif',
        overflowX: 'hidden',
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
            marginBottom: 6,
            gap: 6,
          }}
        >
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>J&amp;J</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
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
            disabled={isAnimating && !roundReveal?.readyToContinue}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.18)',
              background:
                isAnimating && !roundReveal?.readyToContinue
                  ? 'rgba(255,255,255,0.05)'
                  : 'rgba(255,255,255,0.08)',
              color:
                isAnimating && !roundReveal?.readyToContinue
                  ? 'rgba(255,255,255,0.45)'
                  : 'white',
              fontWeight: 700,
              cursor:
                isAnimating && !roundReveal?.readyToContinue
                  ? 'default'
                  : 'pointer',
            }}
          >
            NEW GAME
          </button>
        </div>

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

              <SeatBlock player={top}>
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
                    />
                    <TableCards
                      player={top}
                      display="top"
                      isBottom={false}
                      selectedKeys={new Set()}
                      turnRank={state.turnRank}
                      isPlayerTurn={false}
                      revealFaceDown={topReveal.revealFaceDown}
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
            </div>

            {showRight && <div />}

            {showLeft && (
              <div ref={leftAreaRef} style={{ position: 'relative' }}>
                <SeatBlock player={left}>
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
                      />
                      <TableCards
                        player={left}
                        display="left"
                        isBottom={false}
                        selectedKeys={new Set()}
                        turnRank={state.turnRank}
                        isPlayerTurn={false}
                        revealFaceDown={leftReveal.revealFaceDown}
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
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      padding: '12px 22px',
                      borderRadius: 12,
                      background: 'rgba(0, 0, 0, 0.82)',
                      border: '1px solid rgba(255,255,255,0.16)',
                      color: 'white',
                      fontWeight: 900,
                      fontSize: 24,
                      letterSpacing: 0.6,
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                      zIndex: 30,
                      pointerEvents: 'none',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
                    }}
                  >
                    {pileBanner}
                  </div>
                )}
              </div>

              <div style={{ fontSize: 13, textAlign: 'center', maxWidth: 360 }}>
                {roundReveal
                  ? roundReveal.roundMessage
                  : normalizeMessage(message)}
              </div>

              {roundReveal && (
                <button
                  type="button"
                  disabled={!roundReveal.readyToContinue}
                  onClick={handleContinueAfterRoundReveal}
                  style={{
                    ...btnStyle(roundReveal.readyToContinue),
                    minWidth: 150,
                    marginTop: 8,
                  }}
                >
                  CONTINUE
                </button>
              )}
            </div>

            {showRight && (
              <div ref={rightAreaRef} style={{ position: 'relative' }}>
                <SeatBlock player={right}>
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
                      />
                      <OpponentHand
                        player={right}
                        display="right"
                        revealCards={rightReveal.revealHand}
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
              <SeatBlock player={bottom}>
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
                      applyResult(flipFaceDown(state, bottom.id, idx));
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
                        disabled={!isLocalTurn || state.turnRank === null || isAnimating}
                        onClick={() => {
                          if (mode === 'online') {
                            online.sendEndTurn();
                            setSelectedKeys(new Set());
                            return;
                          }
                          setState(endTurn(state, bottom.id));
                          setMessage('Turn ended.');
                          setSelectedKeys(new Set());
                        }}
                        style={{
                          ...btnStyle(
                            isLocalTurn && state.turnRank !== null && !isAnimating
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
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              zIndex: 60,
              pointerEvents: 'none',
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
    padding: '10px 16px',
    borderRadius: 9,
    border: '1px solid rgba(255,255,255,0.2)',
    background: enabled ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
    color: enabled ? 'white' : 'rgba(255,255,255,0.25)',
    fontWeight: 600,
    cursor: enabled ? 'pointer' : 'default',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  };
}