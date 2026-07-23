import { useState } from 'react'
import type { CSSProperties } from 'react'
import type { GameMode } from './types'
import { defaultPlayerNames } from './seats'
import { rulesSections } from './rulesContent'

import { WinScoreField } from './WinScoreField'

type SetupScreenProps = {
  playerCount: number
  gameMode: GameMode
  playerNames: string[]
  winScore: number
  onPlayerCountChange: (count: number) => void
  onGameModeChange: (mode: GameMode) => void
  onPlayerNameChange: (index: number, name: string) => void
  onWinScoreChange: (score: number) => void
  onStart: () => void
  onPlayOnline?: () => void
}

const modeBtn = (active: boolean): CSSProperties => ({
  flex: 1,
  padding: '10px 8px',
  borderRadius: 8,
  border: active ? '2px solid #60a5fa' : '1px solid rgba(255,255,255,0.25)',
  background: active ? 'rgba(37,99,235,0.35)' : 'rgba(255,255,255,0.06)',
  color: 'white',
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: 13,
})

const sectionTitleStyle: CSSProperties = {
  margin: '14px 0 8px',
  fontSize: 16,
}

const bulletListStyle: CSSProperties = {
  margin: '0 0 12px 18px',
  padding: 0,
}

export function SetupScreen({
  playerCount,
  gameMode,
  playerNames,
  winScore,
  onPlayerCountChange,
  onGameModeChange,
  onPlayerNameChange,
  onWinScoreChange,
  onStart,
  onPlayOnline,
}: SetupScreenProps) {
  const [showRules, setShowRules] = useState(false)
  const labels = defaultPlayerNames(playerCount)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        overflowY: 'auto',
        WebkitBackdropFilter: 'blur(10px) saturate(1.15)',
        backdropFilter: 'blur(10px) saturate(1.15)',
        padding:
          'max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))',
      }}
    >
      <div
        style={{
          background: '#0f3d22',
          border: '0.5px solid rgba(255,255,255,0.22)',
          borderRadius: 16,
          padding: 24,
          maxWidth: 420,
          width: '100%',
          color: 'white',
          position: 'relative',
          boxShadow:
            '0 24px 48px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)',
          WebkitFontSmoothing: 'antialiased',
        }}
      >
        <h1 style={{ margin: '0 0 8px', fontSize: 28 }}>J&amp;J</h1>
        <p style={{ margin: '0 0 20px', opacity: 0.85, lineHeight: 1.5 }}>
          2–4 players, two decks. Pick how you want to play.
        </p>

        <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
          Mode
        </label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button
            type="button"
            style={modeBtn(gameMode === 'ai')}
            onClick={() => onGameModeChange('ai')}
          >
            VS AI
          </button>
          <button
            type="button"
            style={modeBtn(gameMode === 'hotSeat')}
            onClick={() => onGameModeChange('hotSeat')}
          >
            HOT-SEAT
          </button>
          <button
            type="button"
            style={modeBtn(gameMode === 'online')}
            onClick={() => onGameModeChange('online')}
          >
            ONLINE
          </button>
        </div>

        <p
          style={{
            margin: '0 0 16px',
            fontSize: 13,
            opacity: 0.8,
            lineHeight: 1.45,
          }}
        >
          {gameMode === 'ai'
            ? 'You sit at the bottom; other seats are AI.'
            : gameMode === 'hotSeat'
              ? 'Pass the device each turn. The table rotates so the active player is always at the bottom.'
              : 'Play with friends on separate phones or computers. Create a room and share the invite link.'}
        </p>

        <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
          Players
        </label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onPlayerCountChange(n)}
              style={modeBtn(playerCount === n)}
            >
              {n}
            </button>
          ))}
        </div>

        {gameMode !== 'online' && (
          <div style={{ marginBottom: 16 }}>
            <WinScoreField
              value={winScore}
              onChange={onWinScoreChange}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.25)',
                background: 'rgba(0,0,0,0.2)',
                color: 'white',
                fontSize: 16,
              }}
            />
          </div>
        )}

        {gameMode === 'hotSeat' && (
          <div style={{ marginBottom: 20 }}>
            <label
              style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}
            >
              Names
            </label>
            {labels.map((label, i) => (
              <input
                key={i}
                type="text"
                value={playerNames[i] ?? ''}
                placeholder={label}
                onChange={(e) => onPlayerNameChange(i, e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  marginBottom: 8,
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.25)',
                  background: 'rgba(0,0,0,0.2)',
                  color: 'white',
                }}
              />
            ))}
          </div>
        )}

        {gameMode !== 'online' && (
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button
              type="button"
              onClick={onStart}
              style={{
                flex: 1,
                padding: '12px 0',
                borderRadius: 10,
                border: 'none',
                background: '#16a34a',
                color: 'white',
                fontWeight: 800,
                fontSize: 16,
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: 0.6,
              }}
            >
              START GAME
            </button>

            <button
              type="button"
              onClick={() => setShowRules(true)}
              style={{
                padding: '12px 16px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.08)',
                color: 'white',
                fontWeight: 800,
                fontSize: 14,
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                whiteSpace: 'nowrap',
              }}
            >
              RULES
            </button>
          </div>
        )}

        {gameMode === 'online' && (
          <button
            type="button"
            onClick={onPlayOnline}
            style={{
              width: '100%',
              marginTop: 12,
              padding: '12px 0',
              borderRadius: 10,
              border: 'none',
              background: '#2563eb',
              color: 'white',
              fontWeight: 800,
              fontSize: 16,
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: 0.6,
            }}
          >
            Play online
          </button>
        )}

        {showRules && (
          <div
            onClick={() => setShowRules(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
              zIndex: 1000,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 700,
                maxHeight: '82vh',
                overflowY: 'auto',
                borderRadius: 14,
                background: '#123524',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'white',
                padding: 20,
                boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 14,
                  gap: 12,
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 800 }}>J&amp;J RULES</div>
                <button
                  type="button"
                  onClick={() => setShowRules(false)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(255,255,255,0.08)',
                    color: 'white',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  CLOSE
                </button>
              </div>

              <div style={{ fontSize: 14, lineHeight: 1.6, opacity: 0.96 }}>
                {rulesSections.map((section) => (
                  <section key={section.title}>
                    <h3 style={sectionTitleStyle}>{section.title}</h3>
                    {section.intro && (
                      <p style={{ margin: '0 0 8px' }}>{section.intro}</p>
                    )}
                    {section.bullets && section.bullets.length > 0 && (
                      <ul style={bulletListStyle}>
                        {section.bullets.map((bullet) => (
                          <li key={bullet}>{bullet}</li>
                        ))}
                      </ul>
                    )}
                  </section>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}