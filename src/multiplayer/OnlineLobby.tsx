import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import type { OnlineSession } from './useOnlineGame'
import { getWsUrl } from './protocol'
import { MAX_ONLINE_PLAYERS, MIN_ONLINE_PLAYERS } from '../constants'

type OnlineLobbyProps = {
  session: OnlineSession
  onBack: () => void
}

const fieldStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  marginBottom: 10,
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.25)',
  background: 'rgba(0,0,0,0.2)',
  color: 'white',
  fontSize: 16,
}

const btnStyle: CSSProperties = {
  flex: 1,
  padding: '12px 0',
  borderRadius: 10,
  border: 'none',
  background: '#16a34a',
  color: 'white',
  fontWeight: 800,
  fontSize: 15,
  cursor: 'pointer',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
}

export function OnlineLobby({ session, onBack }: OnlineLobbyProps) {
  const [name, setName] = useState('')
  const [joinCode, setJoinCode] = useState(session.roomCode ?? '')
  const [playerCount, setPlayerCount] = useState(4)
  const [mode, setMode] = useState<'create' | 'join'>(
    session.roomCode ? 'join' : 'create'
  )

  const wsUrl = getWsUrl()
  const inLobby = session.status === 'lobby'

  useEffect(() => {
    if (session.roomCode) setJoinCode(session.roomCode)
  }, [session.roomCode])

  const shareUrl = session.roomCode
    ? `${window.location.origin}${window.location.pathname}?room=${session.roomCode}`
    : ''

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 110,
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
          maxWidth: 440,
          width: '100%',
          color: 'white',
          boxShadow:
            '0 24px 48px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)',
          WebkitFontSmoothing: 'antialiased',
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.7)',
            cursor: 'pointer',
            padding: 0,
            marginBottom: 12,
            minHeight: 0,
          }}
        >
          ← Back
        </button>

        <h2 style={{ margin: '0 0 8px', fontSize: 24 }}>Play online</h2>
        <p style={{ margin: '0 0 16px', opacity: 0.85, lineHeight: 1.5 }}>
          Create a room and share the link, or join with a room code.
        </p>

        {!wsUrl && (
          <div
            style={{
              background: 'rgba(220,38,38,0.15)',
              border: '1px solid rgba(248,113,113,0.4)',
              borderRadius: 10,
              padding: 12,
              marginBottom: 16,
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            Online server is not configured for this build. The host needs to
            deploy the WebSocket server and set <code>VITE_WS_URL</code>.
          </div>
        )}

        {(session.error || session.status === 'connecting') && (
          <div
            style={{
              background:
                session.status === 'connecting'
                  ? 'rgba(37,99,235,0.15)'
                  : 'rgba(220,38,38,0.15)',
              border:
                session.status === 'connecting'
                  ? '1px solid rgba(96,165,250,0.4)'
                  : '1px solid rgba(248,113,113,0.4)',
              borderRadius: 10,
              padding: 12,
              marginBottom: 16,
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            {session.error ??
              'Connecting to game server… (free tier may take up to a minute if idle)'}
          </div>
        )}

        {!inLobby ? (
          <>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>
              Your name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              style={fieldStyle}
              maxLength={20}
            />

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button
                type="button"
                onClick={() => setMode('create')}
                style={{
                  ...btnStyle,
                  flex: 1,
                  background: mode === 'create' ? '#2563eb' : 'rgba(255,255,255,0.1)',
                }}
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setMode('join')}
                style={{
                  ...btnStyle,
                  flex: 1,
                  background: mode === 'join' ? '#2563eb' : 'rgba(255,255,255,0.1)',
                }}
              >
                Join
              </button>
            </div>

            {mode === 'create' ? (
              <>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>
                  Max players ({MIN_ONLINE_PLAYERS}–{MAX_ONLINE_PLAYERS})
                </label>
                <input
                  type="number"
                  min={MIN_ONLINE_PLAYERS}
                  max={MAX_ONLINE_PLAYERS}
                  value={playerCount}
                  onChange={(e) => {
                    const next = Number(e.target.value)
                    if (Number.isNaN(next)) return
                    setPlayerCount(
                      Math.min(
                        MAX_ONLINE_PLAYERS,
                        Math.max(MIN_ONLINE_PLAYERS, next)
                      )
                    )
                  }}
                  style={fieldStyle}
                />
                <p style={{ margin: '0 0 16px', fontSize: 12, opacity: 0.75 }}>
                  Decks scale automatically for larger tables.
                </p>
                <button
                  type="button"
                  disabled={!name.trim() || !wsUrl}
                  onClick={() => session.createRoom(playerCount, name.trim())}
                  style={{
                    ...btnStyle,
                    width: '100%',
                    opacity: !name.trim() || !wsUrl ? 0.5 : 1,
                  }}
                >
                  Create room
                </button>
              </>
            ) : (
              <>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>
                  Room code
                </label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="ABC123"
                  style={{ ...fieldStyle, letterSpacing: 2, fontWeight: 700 }}
                  maxLength={6}
                />
                <button
                  type="button"
                  disabled={!name.trim() || joinCode.trim().length < 4 || !wsUrl}
                  onClick={() => session.joinRoom(joinCode.trim(), name.trim())}
                  style={{
                    ...btnStyle,
                    width: '100%',
                    opacity:
                      !name.trim() || joinCode.trim().length < 4 || !wsUrl
                        ? 0.5
                        : 1,
                  }}
                >
                  Join room
                </button>
              </>
            )}
          </>
        ) : (
          <>
            <div
              style={{
                textAlign: 'center',
                marginBottom: 16,
                padding: 16,
                borderRadius: 12,
                background: 'rgba(0,0,0,0.2)',
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
                Room code
              </div>
              <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: 4 }}>
                {session.roomCode}
              </div>
              {shareUrl && (
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(shareUrl)}
                  style={{
                    marginTop: 12,
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(255,255,255,0.08)',
                    color: 'white',
                    fontWeight: 700,
                    cursor: 'pointer',
                    minHeight: 0,
                  }}
                >
                  Copy invite link
                </button>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>
                Players ({session.players.length}/{session.maxPlayers})
              </div>
              {session.players.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <span>
                    {p.name}
                    {p.id === session.hostId ? ' (host)' : ''}
                  </span>
                  <span style={{ opacity: 0.7 }}>
                    {p.connected ? '●' : '○'}
                  </span>
                </div>
              ))}
            </div>

            {session.isHost ? (
              <button
                type="button"
                disabled={session.players.length < MIN_ONLINE_PLAYERS}
                onClick={() => session.startGame()}
                style={{
                  ...btnStyle,
                  width: '100%',
                  opacity:
                    session.players.length < MIN_ONLINE_PLAYERS ? 0.5 : 1,
                }}
              >
                Start game
              </button>
            ) : (
              <p style={{ textAlign: 'center', opacity: 0.8, margin: 0 }}>
                Waiting for host to start…
              </p>
            )}

            <button
              type="button"
              onClick={() => session.leaveRoom()}
              style={{
                ...btnStyle,
                width: '100%',
                marginTop: 10,
                background: 'rgba(255,255,255,0.1)',
              }}
            >
              Leave room
            </button>
          </>
        )}
      </div>
    </div>
  )
}
