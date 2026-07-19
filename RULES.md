# J&J Rules

## Overview

J&J is a shedding card game for 2 to 4 players.

The goal of each round is to be the first player to get rid of all cards from your hand and table.

The game ends when at least one player reaches 200 or more points. The player with the fewest points wins.

## Players and Deck

- 2 to 4 players.
- Use two standard 52-card decks.
- In 4-player games, add 2 Jokers.
- Aces are low.

## Setup

Each player receives:

- 11 cards in hand.
- 4 face-down table cards.
- 4 face-up table cards.

Table cards are arranged in 4 slots:

- Each slot contains 1 face-down card and 1 face-up card.
- Face-up table cards are always visible and playable.
- A face-down table card becomes available only after the face-up card in the same slot has been played.

All remaining cards are set aside and are not used again until the next round.

## App Modes

### VS AI

- One human player sits in the bottom seat.
- All other seats are controlled by AI.

### HOT-SEAT

- All players are human.
- The view rotates so the active player appears at the bottom.
- Pass the device between turns.

## Turn Order

- In the first round, Player 1 goes first.
- In later rounds, the winner of the previous round goes first.
- Play proceeds clockwise.

## Card Order

From low to high:

- Ace, 2, 3, 4, 5, 6, 7, 8, 9, 10, Jack, Queen, King, Joker.

Special cards:

- Jack is always playable, regardless of the top card of the active pile.
- Joker is always playable, regardless of the top card of the active pile.

## The Active Pile

- Cards are played to a single active pile.
- If the active pile is empty, any card may be played.
- If the active pile is not empty, a non-special card is legal only if it is equal to or lower than the top card of the active pile.
- Jack and Joker are always legal.

## On Your Turn

On your turn, you begin by playing one card or a set of cards of the same rank.

You may play cards from:

- Your hand.
- Any face-up table card.
- Any available face-down table card.

A face-down table card is available only if the face-up card in the same slot has already been played.

In the app:

- Click a card to select it.
- Double-click a hand card to try to play it immediately.
- Use `OVERPLAY` for an intentional overplay.
- Use `END TURN` when you are done playing cards for that turn.

## Multi-Card Plays

- You may play multiple cards at once only if all played cards are the same rank.
- A multi-card play may combine hand cards and face-up table cards.
- A multi-card play may include a face-down table card only if the face-down card is played first.
- If a face-down card is played first, flip it onto the pile, reveal it, and then you may add any same-rank cards from your hand or face-up table cards.

## Continuing Your Turn

- After you start a turn with a rank, you may continue playing more cards of that same rank.
- While a turn is in progress, you are locked to that rank until you stop, clear the pile, or end your turn.
- When you are finished adding cards of that rank, press `END TURN`.
- If the pile clears during your turn, the pile becomes empty and you may start again with any rank.

## Playing a Face-Down Card

- A face-down table card is played by flipping it directly onto the active pile without looking at it first.
- If the active pile is empty, the flipped face-down card is treated like any other opening card.
- If the active pile is not empty and the flipped face-down card is a non-special card that is higher than the previous top card, you must pick up the entire active pile unless that flipped card is a Jack or Joker.
- If a flipped face-down card is a Jack or Joker, it clears the pile normally.

Once the face-up card in a slot has been played, the face-down card in that slot stays available until it is played.

## Intentional Overplay

A player may intentionally play one higher non-special card from their hand or from a face-up table card, even though it would not normally be a legal play.

If they do:

- The card is played to the active pile.
- The player must then pick up the entire active pile, including the card just played.
- Their turn ends.

This is a legal strategic move. In the app, this is done with the `OVERPLAY` button after selecting one eligible card.

## Clears

The active pile is cleared and removed from play when:

- A single Jack is played.
- A single Joker is played.
- 4 or more cards of the same rank appear consecutively on top of the pile.

The consecutive same-rank cards may be created by one play or across multiple plays.

The consecutive cards do not need to be played by the same player.

After a clear:

- The player who caused the clear continues their turn.
- Because the pile is now empty, that player may play any card.
- If the clearing card was a Jack or Joker, it is discarded as part of the cleared pile.

## End of Round

A round ends immediately when a player has no cards left in:

- Hand.
- Face-up table slots.
- Face-down table slots.

That player wins the round.

## Scoring

At the end of the round, each losing player scores points equal to the total value of the cards they still have.

Card values:

- Ace = 1.
- 2 = 2.
- 3 = 3.
- 4 = 4.
- 5 = 5.
- 6 = 6.
- 7 = 7.
- 8 = 8.
- 9 = 9.
- 10 = 10.
- Jack = 50.
- Queen = 10.
- King = 10.
- Joker = 50.

## End of Game

- The game ends when any player reaches 200 or more points.
- The winner is the player with the fewest points.
- If multiple players are tied for the fewest points, play another round as a tiebreaker.

## Interface Notes

- The setup screen includes a `RULES` button for new players.
- In `HOT-SEAT`, a pass banner appears between turns so players can hand over the device.
- Event banners may appear for things like clears, pile pickups, bad flips, and round wins.

## Implementation Notes

For app logic, model each player's 4 table positions as slots:

- `faceUpCard`
- `faceDownCard`

Suggested terms:

- `faceUpTableCard`
- `availableFaceDownCard`
- `activePile`
- `clear`
- `intentionalOverplay`

Avoid the terms:

- covered face-up
- uncovered face-up

Face-up table cards are never covered.