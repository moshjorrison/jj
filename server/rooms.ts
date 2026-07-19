import { randomBytes } from 'node:crypto'
import type { WebSocket } from 'ws'
import {
  checkRoundEnd,
  endTurn,
  flipFaceDown,
  playCards,
  playIntentionalOverplay,
  startGame,
  startTiebreakerRound,
  createSetupState,
} from '../src/gameState.js'
import type { CardPick, GameState } from '../src/types.js'
import { MAX_ONLINE_PLAYERS, MIN_PLAYERS } from '../src/constants.js'
import {
  filterGameStateForPlayer,
  filterGameStateForRoundEnd,
  sendJson,
  type ClientMessage,
  type LobbyPlayer,
  type ServerMessage,
} from '../src/multiplayer/protocol.js'

type Connection = {
  id: string
  ws: WebSocket
  playerId: string | null
  name: string
}

type RoundEndPending = {
  displayState: GameState
  pendingState: GameState
  message: string
  continued: Set<string>
}

type Room = {
  code: string
  hostConnectionId: string
  maxPlayers: number
  connections: Map<string, Connection>
  gameState: GameState | null
  roundEndPending: RoundEndPending | null
}

const rooms = new Map<string, Room>()
const connectionRooms = new Map<string, string>()

function makeCode() {
  return randomBytes(3).toString('hex').toUpperCase()
}

function makeConnectionId() {
  return randomBytes(8).toString('hex')
}

function lobbyPlayers(room: Room): LobbyPlayer[] {
  const ordered = [...room.connections.values()].sort((a, b) => {
    const ai = a.playerId ? Number(a.playerId.split('-')[1]) : 99
    const bi = b.playerId ? Number(b.playerId.split('-')[1]) : 99
    return ai - bi
  })

  return ordered
    .filter((c) => c.playerId)
    .map((c) => ({
      id: c.playerId!,
      name: c.name,
      connected: c.ws.readyState === c.ws.OPEN,
    }))
}

function broadcastLobby(room: Room) {
  for (const conn of room.connections.values()) {
    if (!conn.playerId) continue
    const msg: ServerMessage = {
      type: 'lobby',
      code: room.code,
      players: lobbyPlayers(room),
      hostId: room.connections.get(room.hostConnectionId)?.playerId ?? 'player-0',
      maxPlayers: room.maxPlayers,
      yourPlayerId: conn.playerId,
    }
    sendJson(conn.ws, msg)
  }
}

function broadcastGame(room: Room, message: string) {
  if (!room.gameState) return
  for (const conn of room.connections.values()) {
    if (!conn.playerId) continue
    const msg: ServerMessage = {
      type: 'game',
      state: filterGameStateForPlayer(room.gameState, conn.playerId),
      message,
    }
    sendJson(conn.ws, msg)
  }
}

function sendError(ws: WebSocket, message: string) {
  sendJson(ws, { type: 'error', message })
}

function assignPlayerId(room: Room): string | null {
  const used = new Set(
    [...room.connections.values()]
      .map((c) => c.playerId)
      .filter((id): id is string => !!id)
  )

  for (let i = 0; i < room.maxPlayers; i++) {
    const id = `player-${i}`
    if (!used.has(id)) return id
  }
  return null
}

function seatedPlayerIds(room: Room): string[] {
  return lobbyPlayers(room).map((p) => p.id)
}

function broadcastRoundEnd(room: Room) {
  const pending = room.roundEndPending
  if (!pending) return

  const continuedIds = [...pending.continued]
  for (const conn of room.connections.values()) {
    if (!conn.playerId) continue
    const msg: ServerMessage = {
      type: 'roundEnd',
      displayState: filterGameStateForRoundEnd(
        pending.displayState,
        conn.playerId
      ),
      pendingState: filterGameStateForPlayer(pending.pendingState, conn.playerId),
      message: pending.message,
      continuedIds,
    }
    sendJson(conn.ws, msg)
  }
}

function applyRoundEnd(room: Room, message: string) {
  if (!room.gameState) return
  const round = checkRoundEnd(room.gameState)
  if (!round) {
    broadcastGame(room, message)
    return
  }

  room.roundEndPending = {
    displayState: room.gameState,
    pendingState: round.state,
    message: round.message,
    continued: new Set(),
  }
  room.gameState = room.roundEndPending.displayState
  broadcastRoundEnd(room)
}

function handleContinueRound(room: Room, playerId: string) {
  const pending = room.roundEndPending
  if (!pending) return

  pending.continued.add(playerId)
  const required = seatedPlayerIds(room)
  const allReady = required.every((id) => pending.continued.has(id))

  if (allReady) {
    room.gameState = pending.pendingState
    room.roundEndPending = null
    broadcastGame(room, pending.message)
    return
  }

  broadcastRoundEnd(room)
}

function handlePlayAction(
  room: Room,
  playerId: string,
  picks: CardPick[]
) {
  if (!room.gameState) return
  const result = playCards(room.gameState, playerId, picks)
  if (!result) {
    return
  }
  room.gameState = result.state
  applyRoundEnd(room, result.message)
}

export function handleClientMessage(
  connectionId: string,
  ws: WebSocket,
  message: ClientMessage
) {
  if (message.type === 'create') {
    const count = Math.min(
      MAX_ONLINE_PLAYERS,
      Math.max(MIN_PLAYERS, message.playerCount)
    )
    const name = message.name.trim() || 'Host'
    const code = makeCode()

    const room: Room = {
      code,
      hostConnectionId: connectionId,
      maxPlayers: count,
      connections: new Map(),
      gameState: createSetupState(count, 'online'),
      roundEndPending: null,
    }

    const conn: Connection = {
      id: connectionId,
      ws,
      playerId: 'player-0',
      name,
    }

    room.connections.set(connectionId, conn)
    rooms.set(code, room)
    connectionRooms.set(connectionId, code)
    broadcastLobby(room)
    return
  }

  const roomCode = connectionRooms.get(connectionId)
  if (!roomCode) {
    sendError(ws, 'Join or create a room first.')
    return
  }

  const room = rooms.get(roomCode)
  if (!room) {
    sendError(ws, 'Room not found.')
    return
  }

  const conn = room.connections.get(connectionId)
  if (!conn?.playerId) {
    sendError(ws, 'You are not seated in this room.')
    return
  }

  if (message.type === 'join') {
    sendError(ws, 'Already in a room.')
    return
  }

  if (message.type === 'start') {
    if (connectionId !== room.hostConnectionId) {
      sendError(ws, 'Only the host can start the game.')
      return
    }

    const seated = lobbyPlayers(room)
    if (seated.length < 2) {
      sendError(ws, 'Need at least 2 players to start.')
      return
    }

    const names = seated.map((p) => p.name)
    room.gameState = startGame(seated.length, 'online', names)
    broadcastGame(room, 'Game started!')
    return
  }

  if (room.roundEndPending) {
    if (message.type === 'continueRound') {
      handleContinueRound(room, conn.playerId)
      return
    }
    sendError(ws, 'Finish reviewing the round before continuing.')
    return
  }

  if (!room.gameState || room.gameState.phase !== 'playing') {
    if (message.type === 'newGame') {
      room.gameState = null
      room.roundEndPending = null
      broadcastLobby(room)
      return
    }
    if (message.type === 'tiebreaker' && room.gameState?.phase === 'finished') {
      room.gameState = startTiebreakerRound(room.gameState)
      broadcastGame(room, 'Tiebreaker round started.')
      return
    }
    sendError(ws, 'Game is not in progress.')
    return
  }

  const playerId = conn.playerId

  if (message.type === 'play') {
    handlePlayAction(room, playerId, message.picks)
    return
  }

  if (message.type === 'flip') {
    const result = flipFaceDown(room.gameState, playerId, message.index)
    if (!result) return
    room.gameState = result.state
    applyRoundEnd(room, result.message)
    return
  }

  if (message.type === 'endTurn') {
    room.gameState = endTurn(room.gameState, playerId)
    broadcastGame(room, 'Turn ended.')
    return
  }

  if (message.type === 'overplay') {
    const result = playIntentionalOverplay(
      room.gameState,
      playerId,
      message.pick
    )
    if (!result) return
    room.gameState = result.state
    applyRoundEnd(room, result.message)
    return
  }

  if (message.type === 'tiebreaker') {
    room.gameState = startTiebreakerRound(room.gameState)
    broadcastGame(room, 'Tiebreaker round started.')
    return
  }

  if (message.type === 'newGame') {
    room.gameState = null
    room.roundEndPending = null
    broadcastLobby(room)
  }
}

export function handleJoinRoom(
  connectionId: string,
  ws: WebSocket,
  code: string,
  name: string
) {
  const room = rooms.get(code.toUpperCase())
  if (!room) {
    sendError(ws, 'Room not found. Check the code.')
    return
  }

  if (room.gameState?.phase === 'playing') {
    sendError(ws, 'This game already started.')
    return
  }

  const playerId = assignPlayerId(room)
  if (!playerId) {
    sendError(ws, 'Room is full.')
    return
  }

  const conn: Connection = {
    id: connectionId,
    ws,
    playerId,
    name: name.trim() || `Player ${playerId.split('-')[1]}`,
  }

  room.connections.set(connectionId, conn)
  connectionRooms.set(connectionId, room.code)
  broadcastLobby(room)
}

export function handleDisconnect(connectionId: string) {
  const roomCode = connectionRooms.get(connectionId)
  if (!roomCode) return

  const room = rooms.get(roomCode)
  if (!room) return

  room.connections.delete(connectionId)
  connectionRooms.delete(connectionId)

  if (room.connections.size === 0) {
    rooms.delete(roomCode)
    return
  }

  if (connectionId === room.hostConnectionId) {
    const next = room.connections.keys().next().value
    if (next) room.hostConnectionId = next
  }

  if (room.gameState) {
    broadcastGame(room, 'A player disconnected.')
  } else {
    broadcastLobby(room)
  }
}

export function handleConnection(ws: WebSocket) {
  const connectionId = makeConnectionId()

  ws.on('message', (data) => {
    let parsed: ClientMessage | null = null
    try {
      parsed = JSON.parse(data.toString()) as ClientMessage
    } catch {
      sendError(ws, 'Invalid message.')
      return
    }

    if (!parsed?.type) {
      sendError(ws, 'Invalid message.')
      return
    }

    if (parsed.type === 'join') {
      handleJoinRoom(connectionId, ws, parsed.code, parsed.name)
      return
    }

    handleClientMessage(connectionId, ws, parsed)
  })

  ws.on('close', () => handleDisconnect(connectionId))
}
