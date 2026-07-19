import { useCallback, useEffect, useRef, useState } from 'react'
import type { CardPick, GameState } from '../types'
import {
  getWsUrl,
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
  myPlayerId: string | null
  gameState: GameState | null
  message: string
  isHost: boolean
  wsReady: boolean
  createRoom: (playerCount: number, name: string) => void
  joinRoom: (code: string, name: string) => void
  startGame: () => void
  sendPlay: (picks: CardPick[]) => void
  sendFlip: (index: number) => void
  sendEndTurn: () => void
  sendOverplay: (pick: CardPick) => void
  sendTiebreaker: () => void
  sendNewGame: () => void
  leaveRoom: () => void
}

function getRoomFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search)
  const room = params.get('room')
  return room ? room.toUpperCase() : null
}

export function useOnlineGame(): OnlineSession {
  const wsRef = useRef<WebSocket | null>(null)
  const [status, setStatus] = useState<OnlineStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [roomCode, setRoomCode] = useState<string | null>(getRoomFromUrl())
  const [players, setPlayers] = useState<LobbyPlayer[]>([])
  const [hostId, setHostId] = useState<string | null>(null)
  const [maxPlayers, setMaxPlayers] = useState(4)
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [message, setMessage] = useState('')
  const [wsReady, setWsReady] = useState(false)

  const isHost = !!myPlayerId && myPlayerId === hostId

  const ensureSocket = useCallback(() => {
    const url = getWsUrl()
    if (!url) {
      setStatus('error')
      setError(
        'Online play server is not configured. Set VITE_WS_URL when building, or run the local server with npm run dev:server.'
      )
      return null
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return wsRef.current
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) {
      return wsRef.current
    }

    setStatus('connecting')
    setError(null)

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setWsReady(true)
      setStatus((prev) => (prev === 'connecting' ? 'idle' : prev))
    }

    ws.onmessage = (event) => {
      let msg: ServerMessage | null = null
      try {
        msg = JSON.parse(event.data as string) as ServerMessage
      } catch {
        return
      }

      if (!msg?.type) return

      if (msg.type === 'error') {
        setError(msg.message)
        return
      }

      if (msg.type === 'lobby') {
        setRoomCode(msg.code)
        setPlayers(msg.players)
        setHostId(msg.hostId)
        setMaxPlayers(msg.maxPlayers)
        setMyPlayerId(msg.yourPlayerId)
        setGameState(null)
        setStatus('lobby')
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
        setStatus(msg.state.phase === 'finished' ? 'finished' : 'playing')
        setError(null)
      }
    }

    ws.onclose = () => {
      setWsReady(false)
      wsRef.current = null
    }

    ws.onerror = () => {
      setStatus('error')
      setError('Could not connect to the game server.')
    }

    return ws
  }, [])

  const send = useCallback((msg: ClientMessage) => {
    const ws = ensureSocket()
    if (!ws) return

    const post = () => ws.send(JSON.stringify(msg))

    if (ws.readyState === WebSocket.OPEN) {
      post()
      return
    }

    ws.addEventListener(
      'open',
      () => {
        post()
      },
      { once: true }
    )
  }, [ensureSocket])

  const createRoom = useCallback(
    (playerCount: number, name: string) => {
      send({ type: 'create', playerCount, name })
    },
    [send]
  )

  const joinRoom = useCallback(
    (code: string, name: string) => {
      send({ type: 'join', code: code.toUpperCase(), name })
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

  const leaveRoom = useCallback(() => {
    wsRef.current?.close()
    wsRef.current = null
    setStatus('idle')
    setRoomCode(null)
    setPlayers([])
    setHostId(null)
    setMyPlayerId(null)
    setGameState(null)
    setMessage('')
    setWsReady(false)

    const params = new URLSearchParams(window.location.search)
    params.delete('room')
    const qs = params.toString()
    const next = qs
      ? `${window.location.pathname}?${qs}`
      : window.location.pathname
    window.history.replaceState({}, '', next)
  }, [])

  useEffect(() => {
    return () => {
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
    myPlayerId,
    gameState,
    message,
    isHost,
    wsReady,
    createRoom,
    joinRoom,
    startGame,
    sendPlay,
    sendFlip,
    sendEndTurn,
    sendOverplay,
    sendTiebreaker,
    sendNewGame,
    leaveRoom,
  }
}
