export const CARD_WIDTH = 52
export const CARD_HEIGHT = 73

export const TABLE_CARD_STEP = 44
export const MIDDLE_CARD_STEP = 12

export const PLAYER_HAND_SPACING = 22

export const OPPONENT_CARD_WIDTH = 28
export const OPPONENT_CARD_HEIGHT = 39
export const OPPONENT_HAND_STEP = 12
export const RIGHT_HAND_STEP = 12

export const AI_STEP_DELAY_MS = 800
export const HAND_END_DELAY_MS = 1800
export const ROUND_END_DELAY_MS = 3000

/** Fly animation duration when a face-down card is flipped onto the pile. */
export const FLIP_FLY_MS = 520
export const FLIP_FLY_JACK_MS = 900

/** Staggered round-end reveal (losers' leftover cards + score banners). */
export const ROUND_REVEAL_START_MS = 900
export const ROUND_REVEAL_PLAYER_STEP_MS = 1600
export const ROUND_REVEAL_HAND_OFFSET_MS = 0
export const ROUND_REVEAL_FACE_DOWN_OFFSET_MS = 700
export const ROUND_REVEAL_BANNER_OFFSET_MS = 1400

export const RANK_ORDER: string[] = [
  'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Q', 'K',
]

export const SUIT_SYMBOL: Record<string, string> = {
  hearts: '\u2665',
  diamonds: '\u2666',
  clubs: '\u2663',
  spades: '\u2660',
}

export const WIN_SCORE = 200
export const HAND_SIZE = 11
export const TABLE_CARDS = 4
export const FACE_DOWN_CARDS = 4

export const CARDS_PER_PLAYER = 19
export const CARDS_PER_DECK = 54
export const MIN_PLAYERS = 2
export const MAX_LOCAL_PLAYERS = 4
export const MIN_ONLINE_PLAYERS = 2
export const MAX_ONLINE_PLAYERS = 10

/** Online turn timer — auto-play when time runs out. */
export const ONLINE_TURN_TIMER_MS = 75_000

/** After disconnect, auto-play if still offline when it's their turn. */
export const DISCONNECT_AUTO_PLAY_MS = 30_000
