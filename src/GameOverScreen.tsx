import type { Player } from './types';
import { getLoserIds, getWinnerIds } from './gameLogic';

type GameOverScreenProps = {
  players: Player[];
  tied: boolean;
  onNewGame: () => void;
  onTiebreaker: () => void;
};

export function GameOverScreen({
  players,
  tied,
  onNewGame,
  onTiebreaker,
}: GameOverScreenProps) {
  const winners = getWinnerIds(players);
  const losers = getLoserIds(players);
  const sorted = [...players].sort((a, b) => a.score - b.score);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.78)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        style={{
          background: '#0f3d22',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 16,
          padding: 28,
          maxWidth: 440,
          width: '90%',
          color: 'white',
        }}
      >
        <h2 style={{ margin: '0 0 12px' }}>Game over</h2>

        {tied ? (
          <p style={{ margin: '0 0 16px', lineHeight: 1.5 }}>
            Tie for the lead at {sorted[0]?.score} points. Play a tiebreaker
            round.
          </p>
        ) : (
          <p style={{ margin: '0 0 16px', lineHeight: 1.5 }}>
            Winner:{' '}
            <strong>
              {players
                .filter((p) => winners.includes(p.id))
                .map((p) => p.name)
                .join(', ')}
            </strong>
            {losers.length > 0 && (
              <>
                {' '}
                — reached 200:{' '}
                {players
                  .filter((p) => losers.includes(p.id))
                  .map((p) => p.name)
                  .join(', ')}
              </>
            )}
          </p>
        )}

        <div style={{ marginBottom: 20 }}>
          {sorted.map((p) => (
            <div
              key={p.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '6px 0',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <span>{p.name}</span>
              <span style={{ fontWeight: 700 }}>{p.score}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {tied && (
            <button
              type="button"
              onClick={onTiebreaker}
              style={{
                flex: 1,
                padding: '11px 0',
                borderRadius: 10,
                border: 'none',
                background: '#2563eb',
                color: 'white',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Tiebreaker round
            </button>
          )}
          <button
            type="button"
            onClick={onNewGame}
            style={{
              flex: 1,
              padding: '11px 0',
              borderRadius: 10,
              border: 'none',
              background: '#16a34a',
              color: 'white',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            New game
          </button>
        </div>
      </div>
    </div>
  );
}
