import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sharpText } from './display';
import { FlyingCardsOverlay } from './gameTable/FlyingCardsOverlay';
import { RoundScoreRecap } from './gameTable/RoundScoreRecap';
import {
  ActivePile,
  OpponentHand,
  OpponentStrip,
  ScorePanel,
  SeatBlock,
  SeatPointsBanner,
  TableCards,
} from './gameTable/TableComponents';
import { TurnTimer } from './gameTable/TurnTimer';
import type {
  FlyingCard,
  PlayLikeResult,
  RoundRevealState,
} from './gameTable/types';
import {
  cardsAddedToPile,
  flipFlyDurationMs,
  requiredContinuePlayerIds,
  resolveCardsFromPicks,
  roundPenaltyPoints,
  seatRotation,
} from './gameTable/utils';
import {
  MessageBar,
  PileBannerOverlay,
  TurnChip,
  actionHintForTurn,
  continueRoundLabel,
  displayName,
  displayPossessive,
  normalizeMessage,
  pileBannerVariant,
  reviewingCardsLabel,
  reviewingLeftoverCardsHint,
  tiebreakerMessage,
  turnHandoffMessage,
  turnStartMessage,
  type PileBannerVariant,
} from './gameUi';
import { runAiStep } from './ai';
import { CardFace, cardFaceRotation } from './cardUi';
import { isSoundMuted, playSound, setSoundMuted } from './sounds';
import {
  FLIP_FLY_JACK_MS,
  FLIP_FLY_MS,
  MAX_LOCAL_PLAYERS,
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
import { getStoredPlayerName, setStoredPlayerName } from './playerStorage';
import {
  canPlay,
  isFaceDownAvailable,
  isIntentionalOverplay,
} from './gameLogic';
import {
  checkRoundEnd,
  canEndTurn,
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
  Seat,
} from './types';


export default function GameTable() {
  const layout = useLayout();
  const online = useOnlineGame();
  const [showOnlineLobby, setShowOnlineLobby] = useState(
    () => !!new URLSearchParams(window.location.search).get('room')
  );
  const [setupCount, setSetupCount] = useState(4);
  const [setupMode, setSetupMode] = useState<GameMode>('ai');
  const [setupNames, setSetupNames] = useState(() => {
    const names = defaultPlayerNames(4);
    const stored = getStoredPlayerName();
    if (stored) names[0] = stored;
    return names;
  });
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
  const [soundMuted, setSoundMutedState] = useState(() => isSoundMuted());
  const prevTurnPlayerRef = useRef<string | null>(null);

  const boardRef = useRef<HTMLDivElement | null>(null);
  const pileAreaRef = useRef<HTMLDivElement | null>(null);
  const bottomAreaRef = useRef<HTMLDivElement | null>(null);
  const topAreaRef = useRef<HTMLDivElement | null>(null);
  const leftAreaRef = useRef<HTMLDivElement | null>(null);
  const rightAreaRef = useRef<HTMLDivElement | null>(null);
  const animationTimerRef = useRef<number | null>(null);
  const roundRevealTimersRef = useRef<number[]>([]);

  const mode: GameMode = state.gameMode ?? setupMode;
  const disconnectedIds =
    mode === 'online' ? online.disconnectedPlayerIds : [];
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

  useEffect(() => {
    if (state.phase !== 'playing' || roundReveal) return;
    const id = state.currentPlayerId;
    if (prevTurnPlayerRef.current === id) return;
    prevTurnPlayerRef.current = id;
    if (localPlayer && id === localPlayer.id) playSound('turn');
  }, [state.currentPlayerId, state.phase, localPlayer, roundReveal]);

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
        playSound('pickup');
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
        playSound('roundEnd');
        const match = normalized.match(/^(.+?) won the round/i);
        if (match?.[1]) {
          showPileBanner(`${match[1].toUpperCase()} WINS ROUND`, 2200, 'win');
          return;
        }
      }

      if (upper.includes('CLEAR')) {
        playSound('clear');
        showPileBanner('CLEAR!', 1300, 'clear');
        return;
      }

      if (upper.includes('BAD FLIP')) {
        showPileBanner('BAD FLIP!', 1300, 'bad');
        return;
      }

      if (upper.includes('FLIPPED')) {
        playSound('flip');
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
        playSound('pickup');
      } else if (result.cleared) {
        showPileBanner('CLEAR!', 1300, 'clear');
        playSound('clear');
      } else if (/Flipped Joker/i.test(result.message)) {
        showPileBanner('JOKER!', 1300, 'flip');
        playSound('flip');
      } else if (/Flipped J\b/i.test(result.message)) {
        showPileBanner('JACK!', 1300, 'flip');
        playSound('flip');
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
      const durationMs = isFlipPlay
        ? flipFlyDurationMs(flipCard, FLIP_FLY_MS, FLIP_FLY_JACK_MS)
        : 360;

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
        const startRotation = seatRotation(fromSeat, cardFaceRotation);

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
    setMessage(turnStartMessage(first));
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

  const mobileBottomSpan =
    layout.isMobile && showLeft
      ? ({
          gridColumn: '1 / -1',
          width: '100%',
          justifySelf: 'center',
        } as const)
      : undefined

  const bottomHandRows = bottom
    ? (() => {
        const perRow = layout.handCardsPerRow
        const entries = bottom.hand.map((card, i) => ({ card, handIndex: i }))
        const rows: (typeof entries)[] = []
        for (let i = 0; i < entries.length; i += perRow) {
          rows.push(entries.slice(i, i + perRow))
        }
        const minRows = 2
        while (rows.length < minRows) {
          rows.push([])
        }
        return rows
      })()
    : Array.from({ length: 2 }, () => [] as { card: Card; handIndex: number }[])

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
    ? reviewingCardsLabel()
    : mode === 'online'
      ? localHasContinued
        ? `Waiting ${roundContinueCount}/${roundContinueRequired}`
        : 'CONTINUE'
      : nextContinuePlayer
        ? continueRoundLabel(
            nextContinuePlayer,
            roundContinueCount,
            roundContinueRequired
          )
        : 'CONTINUE';

  const actionHint = actionHintForTurn(state, isLocalTurn, !!roundReveal);
  const turnChipLabel =
    currentPlayer && isLocalTurn
      ? 'Your turn'
      : currentPlayer
        ? `${displayName(currentPlayer)}'s turn`
        : '';

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
        overflowY: layout.isMobile ? 'auto' : undefined,
        WebkitOverflowScrolling: layout.isMobile ? 'touch' : undefined,
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
            if (index === 0) setStoredPlayerName(name);
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
            setMessage(tiebreakerMessage());
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
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => {
                const next = !soundMuted;
                setSoundMutedState(next);
                setSoundMuted(next);
              }}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.18)',
                background: 'rgba(255,255,255,0.08)',
                color: 'white',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: 12,
              }}
              aria-label={soundMuted ? 'Unmute sounds' : 'Mute sounds'}
            >
              {soundMuted ? '🔇' : '🔊'}
            </button>
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
        </div>

        {state.phase === 'playing' && !roundReveal && currentPlayer && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 10,
              marginBottom: 8,
            }}
          >
            <TurnChip label={turnChipLabel} isYours={isLocalTurn} />
            {mode === 'online' && (
              <TurnTimer
                deadlineMs={online.turnDeadline}
                active={!isAnimating}
              />
            )}
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
                ? 'auto auto auto'
                : '1fr',
              gridTemplateRows: 'auto auto auto auto',
              rowGap: layout.isMobile ? 4 : 8,
              columnGap: showLeft ? (layout.isMobile ? 6 : 10) : 0,
              alignItems: 'center',
              justifyItems: 'center',
              justifyContent: 'center',
              width: '100%',
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
                currentId={localPlayer?.id ?? state.currentPlayerId}
                disconnectedIds={disconnectedIds}
              />
              {state.lastRoundDeltas && !roundReveal && (
                <RoundScoreRecap
                  players={state.players}
                  deltas={state.lastRoundDeltas}
                />
              )}

              {useExpandedTable ? (
                <OpponentStrip
                  opponents={opponents}
                  turnRank={state.turnRank}
                  currentPlayerId={state.currentPlayerId}
                  getRevealFlags={getRevealFlags}
                  spreadCards={spreadRoundCards}
                  disconnectedIds={disconnectedIds}
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
                        gap: layout.isMobile ? 6 : 10,
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
                      ? reviewingLeftoverCardsHint()
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
                        gap: layout.isMobile ? 6 : 10,
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
            <div ref={bottomAreaRef} style={{ position: 'relative', ...mobileBottomSpan }}>
              <SeatBlock
                player={bottom}
                isActiveTurn={bottom?.id === state.currentPlayerId && !roundReveal}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: layout.isMobile ? 8 : 20,
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
                                width={layout.handCardWidth}
                                height={layout.handCardHeight}
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

        <FlyingCardsOverlay cards={flyingCards} />
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
