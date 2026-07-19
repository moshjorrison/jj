export type RulesSection = {
  title: string
  intro?: string
  bullets?: string[]
}

export const rulesSections: RulesSection[] = [
  {
    title: 'Overview',
    intro:
      'J&J is a shedding card game for 2 to 4 players. The goal of each round is to be the first player to get rid of all cards from your hand and table. The game ends when at least one player reaches 200 or more points, and the player with the fewest points wins.',
  },
  {
    title: 'Players and Deck',
    bullets: [
      '2 to 4 players.',
      'Use two standard 52-card decks.',
      'In 4-player games, add 2 Jokers.',
      'Aces are low.',
    ],
  },
  {
    title: 'Setup',
    bullets: [
      'Each player gets 11 cards in hand.',
      'Each player gets 4 face-down table cards.',
      'Each player gets 4 face-up table cards.',
      'Each table slot has 1 face-down card and 1 face-up card.',
      'Face-up table cards are always visible and playable.',
      'A face-down table card becomes available only after the face-up card in the same slot has been played.',
      'All remaining cards are set aside and are not used again until the next round.',
    ],
  },
  {
    title: 'App Modes',
    bullets: [
      'VS AI: One human player sits at the bottom; all other seats are AI.',
      'HOT-SEAT: All players are human; pass the device between turns, and the table rotates so the active player is always at the bottom.',
    ],
  },
  {
    title: 'Turn Order',
    bullets: [
      'In the first round, Player 1 goes first.',
      'In later rounds, the previous round winner goes first.',
      'Play proceeds clockwise.',
    ],
  },
  {
    title: 'Card Order',
    intro: 'Ace, 2, 3, 4, 5, 6, 7, 8, 9, 10, Jack, Queen, King, Joker.',
    bullets: [
      'Jack is always playable, regardless of the top card of the active pile.',
      'Joker is always playable, regardless of the top card of the active pile.',
    ],
  },
  {
    title: 'The Active Pile',
    bullets: [
      'Cards are played to a single active pile.',
      'If the active pile is empty, any card may be played.',
      'If the active pile is not empty, a non-special card is legal only if it is equal to or lower than the top card of the active pile.',
      'Jack and Joker are always legal.',
    ],
  },
  {
    title: 'On Your Turn',
    intro: 'Start by playing one card or a set of cards of the same rank.',
    bullets: [
      'You may play from your hand.',
      'You may play from any face-up table card.',
      'You may play from any available face-down table card.',
      'Click a card to select it.',
      'Double-click a hand card to try to play it immediately.',
      'Use OVERPLAY for an intentional overplay.',
      'Use END TURN when you are done playing cards for that turn.',
    ],
  },
  {
    title: 'Multi-Card Plays',
    bullets: [
      'You may play multiple cards at once only if they are all the same rank.',
      'A multi-card play may combine hand cards and face-up table cards.',
      'A multi-card play may include a face-down card only if the face-down card is played first.',
      'If a face-down card is played first, flip it onto the pile, reveal it, and then you may add any same-rank cards from your hand or face-up table cards.',
    ],
  },
  {
    title: 'Continuing Your Turn',
    bullets: [
      'After you start a turn with a rank, you may continue playing more cards of that same rank.',
      'While a turn is in progress, you are locked to that rank until you stop, clear the pile, or end your turn.',
      'When you are finished adding cards of that rank, press END TURN.',
      'If the pile clears during your turn, the pile becomes empty and you may start again with any rank.',
    ],
  },
  {
    title: 'Playing a Face-Down Card',
    bullets: [
      'A face-down table card is flipped directly onto the active pile without looking at it first.',
      'If the active pile is empty, the flipped card is treated like any other opening card.',
      'If the active pile is not empty and the flipped face-down card is a non-special card that is higher than the previous top card, you must pick up the entire active pile unless that card is a Jack or Joker.',
      'If a flipped face-down card is a Jack or Joker, it clears the pile normally.',
      'Once the face-up card in a slot has been played, the face-down card in that slot stays available until it is played.',
    ],
  },
  {
    title: 'Intentional Overplay',
    intro:
      'You may intentionally play one higher non-special card from your hand or from a face-up table card, even though it would not normally be a legal play.',
    bullets: [
      'The card is played to the active pile.',
      'You then pick up the entire active pile, including that card.',
      'Your turn ends.',
    ],
  },
  {
    title: 'Clears',
    bullets: [
      'A single Jack clears the pile.',
      'A single Joker clears the pile.',
      '4 or more cards of the same rank appearing consecutively on top of the pile also clear it.',
      'The consecutive same-rank cards may be created by one play or across multiple plays.',
      'The consecutive cards do not need to be played by the same player.',
      'The player who caused the clear continues their turn.',
      'Because the pile is now empty, that player may play any card.',
    ],
  },
  {
    title: 'End of Round',
    intro:
      'A round ends immediately when a player has no cards left in hand, face-up table slots, or face-down table slots. That player wins the round.',
  },
  {
    title: 'Scoring',
    intro:
      'Each losing player scores points equal to the total value of the cards they still hold.',
    bullets: [
      'Ace = 1',
      '2 = 2',
      '3 = 3',
      '4 = 4',
      '5 = 5',
      '6 = 6',
      '7 = 7',
      '8 = 8',
      '9 = 9',
      '10 = 10',
      'Jack = 50',
      'Queen = 10',
      'King = 10',
      'Joker = 50',
    ],
  },
  {
    title: 'End of Game',
    bullets: [
      'The game ends when any player reaches 200 or more points.',
      'The winner is the player with the fewest points.',
      'If players are tied for the fewest points, play another round as a tiebreaker.',
    ],
  },
]