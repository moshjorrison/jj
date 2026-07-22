import { displayName } from '../gameUi'
import type { Player, RoundScoreDelta } from '../types'

type RoundScoreRecapProps = {
  players: Player[]
  deltas: RoundScoreDelta[]
}

export function RoundScoreRecap({ players, deltas }: RoundScoreRecapProps) {
  if (!deltas.length) return null

  const losers = deltas.filter((d) => d.delta > 0)
  if (losers.length === 0) return null

  return (
    <div
      style={{
        marginTop: 8,
        padding: '8px 12px',
        borderRadius: 10,
        background: 'rgba(0,0,0,0.22)',
        border: '1px solid rgba(255,255,255,0.12)',
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 4, opacity: 0.7 }}>
        Last round
      </div>
      {losers.map((d) => {
        const player = players.find((p) => p.id === d.playerId)
        if (!player) return null
        return (
          <div
            key={d.playerId}
            style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}
          >
            <span>{displayName(player)}</span>
            <span style={{ fontWeight: 700, color: '#fca5a5' }}>+{d.delta}</span>
          </div>
        )
      })}
    </div>
  )
}
