import { useCallback, useEffect, useRef, useState } from 'react'
import {
  clearStoredRejoin,
  getStoredRejoin,
  setStoredRejoin,
} from '../playerStorage'
import { DEFAULT_WIN_SCORE } from '../winScore'
import { getWsUrl } from './wsUrl'
import {
  type ClientMessage,
  type LobbyPlayer,
  type ServerMessage,
} from './protocol'

export type OnlineStatus =
  | 'idle'
  | 'connecting'
  | 'lobby'
  | 'playing'
  | 'finished'
  | 'error'

export type OnlineSession = {
  status: OnlineStatus
  error: string | null
  roomCode: string | null
  players: LobbyPlayer[]
  hostId: string | null
  maxPlayers: number
  winScore: number
  myPlayerId: string | null
  rejoinToken: string | null
  gameState: GameState | null
  message: string
  isHost: boolean
  wsReady: boolean
  turnDeadline: number | null
  disconnectedPlayerIds: string[]
  createRoom: (playerCount: number, name: string, winScore: number) => void
  joinRoom: (code: string, name: string) => void
  startGame: () => void
  sendPlay: (picks: CardPick[]) => void
  sendFlip: (index: number) => void
  sendEndTurn: () => void
  sendPickUp: () => void
  sendOverplay: (pick: CardPick) => void
  sendTiebreaker: () => void
  sendNewGame: () => void
  sendContinueRound: () => void
  kickPlayer: (playerId: string) => void
  leaveRoom: () => void
  roundEnd: {
    displayState: GameState
    pendingState: GameState
    message: string
    continuedIds: string[]
  } | null
}

const CONNECT_ATTEMPTS = 15
const CONNECT_TIMEOUT_MS = 12000
const CONNECT_RETRY_MS = 4000

function getRoomFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search)
  const room = params.get('room')
  return room ? room.toUpperCase() : null
}

function attachSocketHandlers(
  ws: WebSocket,
  handlers: {
    onMessage: (msg: ServerMessage) => void
    onError: (message: string) => void
    onOpen: () => void
    onClose: () => void
  }
) {
  ws.onopen = () => handlers.onOpen()

  ws.onmessage = (event) => {
    let msg: ServerMessage | null = null
    try {
      msg = JSON.parse(event.data as string) as ServerMessage
    } catch {
      return
    }
    if (!msg?.type) return
    handlers.onMessage(msg)
  }

  ws.onclose = () => handlers.onClose()
  ws.onerror = () => {
    // Browsers fire error before close; retry logic handles failure.
  }
}

export function useOnlineGame(): OnlineSession {
  const wsRef = useRef<WebSocket | null>(null)
  const connectGenRef = useRef(0)
  const pendingMessagesRef = useRef<ClientMessage[]>([])
  const rejoinTokenRef = useRef<string | null>(null)
  const autoRejoinAttemptedRef = useRef(false)
  const [status, setStatus] = useState<OnlineStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [roomCode, setRoomCode] = useState<string | null>(getRoomFromUrl())
  const [players, setPlayers] = useState<LobbyPlayer[]>([])
  const [hostId, setHostId] = useState<string | null>(null)
  const [maxPlayers, setMaxPlayers] = useState(4)
  const [winScore, setWinScore] = useState(DEFAULT_WIN_SCORE)
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null)
  const [rejoinToken, setRejoinToken] = useState<string | null>(null)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [message, setMessage] = useState('')
  const [wsReady, setWsReady] = useState(false)
  const [turnDeadline, setTurnDeadline] = useState<number | null>(null)
  const [disconnectedPlayerIds, setDisconnectedPlayerIds] = useState<string[]>(
    []
  )
  const [roundEnd, setRoundEnd] = useState<OnlineSession['roundEnd']>(null)

  const isHost = !!myPlayerId && myPlayerId === hostId

  const handleServerMessage = useCallback((msg: ServerMessage) => {
    if (msg.type === 'error') {
      setError(msg.message)
      return
    }

    if (msg.type === 'lobby') {
      setRoomCode(msg.code)
      setPlayers(msg.players)
      setHostId(msg.hostId)
      setMaxPlayers(msg.maxPlayers)
      setWinScore(msg.winScore)
      setMyPlayerId(msg.yourPlayerId)
      setRejoinToken(msg.rejoinToken)
      rejoinTokenRef.current = msg.rejoinToken
      setStoredRejoin(msg.code, {
        token: msg.rejoinToken,
        playerId: msg.yourPlayerId,
      })
      setGameState(null)
      setStatus('lobby')
      setTurnDeadline(null)
      setDisconnectedPlayerIds([])
      setError(null)

      const params = new URLSearchParams(window.location.search)
      params.set('room', msg.code)
      const next = `${window.location.pathname}?${params.toString()}`
      window.history.replaceState({}, '', next)
      return
    }

    if (msg.type === 'game') {
      setGameState(msg.state)
      setMessage(msg.message)
      setRoundEnd(null)
      setTurnDeadline(msg.turnDeadline ?? null)
      setDisconnectedPlayerIds(msg.disconnectedPlayerIds ?? [])
      setStatus(msg.state.phase === 'finished' ? 'finished' : 'playing')
      setError(null)
      return
    }

    if (msg.type === 'roundEnd') {
      setRoundEnd({
        displayState: msg.displayState,
        pendingState: msg.pendingState,
        message: msg.message,
        continuedIds: msg.continuedIds,
      })
      setGameState(msg.displayState)
      setMessage(msg.message)
      setTurnDeadline(msg.turnDeadline ?? null)
      setDisconnectedPlayerIds(msg.disconnectedPlayerIds ?? [])
      setStatus('playing')
      setError(null)
    }
  }, [])

  const flushPendingMessages = useCallback((ws: WebSocket) => {
    if (ws.readyState !== WebSocket.OPEN) return
    const queue = [...pendingMessagesRef.current]
    pendingMessagesRef.current = []
    for (const msg of queue) {
      ws.send(JSON.stringify(msg))
    }
  }, [])

  const connectSocket = useCallback(async (): Promise<WebSocket | null> => {
    const url = getWsUrl()
    if (!url) {
      setStatus('error')
      setError(
        'Online play server is not configured. Set VITE_WS_URL when building, or run the local server with npm run dev:server.'
      )
      return null
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return wsRef.current
    }

    if (wsRef.current?.readyState === WebSocket.CONNECTING) {
      return wsRef.current
    }

    const generation = ++connectGenRef.current
    setStatus('connecting')
    setError(null)

    for (let attempt = 1; attempt <= CONNECT_ATTEMPTS; attempt++) {
      if (generation !== connectGenRef.current) return null

      setError(
        attempt === 1
          ? 'Connecting to game server… (free tier may take up to a minute if idle)'
          : `Still connecting… attempt ${attempt} of ${CONNECT_ATTEMPTS}`
      )

      const connected = await new Promise<WebSocket | null>((resolve) => {
        const ws = new WebSocket(url)
        let settled = false

        const timer = window.setTimeout(() => {
          if (settled) return
          settled = true
          ws.close()
          resolve(null)
        }, CONNECT_TIMEOUT_MS)

        ws.onopen = () => {
          if (settled) return
          settled = true
          window.clearTimeout(timer)
          resolve(ws)
        }

        ws.onclose = () => {
          if (settled) return
          settled = true
          window.clearTimeout(timer)
          resolve(null)
        }

        ws.onerror = () => {}
      })

      if (connected) {
        wsRef.current = connected
        setWsReady(true)
        setError(null)
        setStatus((prev) =>
          prev === 'connecting' || prev === 'error' ? 'idle' : prev
        )

        attachSocketHandlers(connected, {
          onOpen: () => {},
          onMessage: handleServerMessage,
          onError: () => {},
          onClose: () => {
            setWsReady(false)
            wsRef.current = null
          },
        })

        flushPendingMessages(connected)
        return connected
      }

      if (attempt < CONNECT_ATTEMPTS) {
        await new Promise((r) => window.setTimeout(r, CONNECT_RETRY_MS))
      }
    }

    setStatus('error')
    setError(
      'Could not connect to the game server. Wait a minute and try again — the free server sleeps when idle.'
    )
    return null
  }, [flushPendingMessages, handleServerMessage])

  const send = useCallback(
    (msg: ClientMessage) => {
      const post = (ws: WebSocket) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(msg))
        } else {
          pendingMessagesRef.current.push(msg)
        }
      }

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        post(wsRef.current)
        return
      }

      pendingMessagesRef.current.push(msg)
      void connectSocket().then((ws) => {
        if (ws) flushPendingMessages(ws)
      })
    },
    [connectSocket, flushPendingMessages]
  )

  const createRoom = useCallback(
    (playerCount: number, name: string, targetWinScore: number) => {
      send({ type: 'create', playerCount, name, winScore: targetWinScore })
    },
    [send]
  )

  const joinRoom = useCallback(
    (code: string, name: string) => {
      const stored = getStoredRejoin(code.toUpperCase())
      send({
        type: 'join',
        code: code.toUpperCase(),
        name,
        rejoinToken: stored?.token,
      })
    },
    [send]
  )

  const startGame = useCallback(() => {
    send({ type: 'start' })
  }, [send])

  const sendPlay = useCallback(
    (picks: CardPick[]) => {
      send({ type: 'play', picks })
    },
    [send]
  )

  const sendFlip = useCallback(
    (index: number) => {
      send({ type: 'flip', index })
    },
    [send]
  )

  const sendEndTurn = useCallback(() => {
    send({ type: 'endTurn' })
  }, [send])

  const sendPickUp = useCallback(() => {
    send({ type: 'pickUp' })
  }, [send])

  const sendOverplay = useCallback(
    (pick: CardPick) => {
      send({ type: 'overplay', pick })
    },
    [send]
  )

  const sendTiebreaker = useCallback(() => {
    send({ type: 'tiebreaker' })
  }, [send])

  const sendNewGame = useCallback(() => {
    send({ type: 'newGame' })
    setGameState(null)
    setStatus('lobby')
  }, [send])

  const sendContinueRound = useCallback(() => {
    send({ type: 'continueRound' })
  }, [send])

  const kickPlayer = useCallback(
    (playerId: string) => {
      send({ type: 'kick', playerId })
    },
    [send]
  )

  const leaveRoom = useCallback(() => {
    if (roomCode) clearStoredRejoin(roomCode)
    connectGenRef.current += 1
    wsRef.current?.close()
    wsRef.current = null
    pendingMessagesRef.current = []
    rejoinTokenRef.current = null
    autoRejoinAttemptedRef.current = false
    setStatus('idle')
    setRoomCode(null)
    setPlayers([])
    setHostId(null)
    setMyPlayerId(null)
    setRejoinToken(null)
    setGameState(null)
    setMessage('')
    setWsReady(false)
    setError(null)
    setRoundEnd(null)
    setTurnDeadline(null)
    setDisconnectedPlayerIds([])

    const params = new URLSearchParams(window.location.search)
    params.delete('room')
    const qs = params.toString()
    const next = qs
      ? `${window.location.pathname}?${qs}`
      : window.location.pathname
    window.history.replaceState({}, '', next)
  }, [roomCode])

  useEffect(() => {
    const code = getRoomFromUrl()
    if (!code || autoRejoinAttemptedRef.current) return

    const stored = getStoredRejoin(code)
    if (!stored?.token) return

    autoRejoinAttemptedRef.current = true
    rejoinTokenRef.current = stored.token

    void connectSocket().then((ws) => {
      if (!ws) return
      send({ type: 'rejoin', code, token: stored.token })
    })
  }, [connectSocket, send])

  useEffect(() => {
    return () => {
      connectGenRef.current += 1
      wsRef.current?.close()
    }
  }, [])

  return {
    status,
    error,
    roomCode,
    players,
    hostId,
    maxPlayers,
    winScore,
    myPlayerId,
    rejoinToken,
    gameState,
    message,
    isHost,
    wsReady,
    turnDeadline,
    disconnectedPlayerIds,
    createRoom,
    joinRoom,
    startGame,
    sendPlay,
    sendFlip,
    sendEndTurn,
    sendPickUp,
    sendOverplay,
    sendTiebreaker,
    sendNewGame,
    sendContinueRound,
    kickPlayer,
    leaveRoom,
    roundEnd,
  }
}
