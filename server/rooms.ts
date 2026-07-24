import { randomBytes } from 'node:crypto'
import type { WebSocket } from 'ws'
import { runAutoPlayForPlayer } from '../src/ai.js'
import { normalizePlayerCount } from '../src/playerCount.js'
import { DEFAULT_WIN_SCORE, normalizeWinScore } from '../src/winScore.js'
import {
  DISCONNECT_AUTO_PLAY_MS,
  MIN_ONLINE_PLAYERS,
  ONLINE_TURN_TIMER_MS,
} from '../src/constants.js'
import {
  checkRoundEnd,
  endTurn,
  flipFaceDown,
  pickUpPile,
  playCards,
  playIntentionalOverplay,
  startGame,
  startTiebreakerRound,
  createSetupState,
} from '../src/gameState.js'
import type { CardPick, GameState } from '../src/types.js'
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
  playerId: string
}

type PlayerSeat = {
  playerId: string
  name: string
  token: string
  connectionId: string | null
  disconnectTimer: ReturnType<typeof setTimeout> | null
}

type RoundEndPending = {
  displayState: GameState
  pendingState: GameState
  message: string
  continued: Set<string>
}

type Room = {
  code: string
  hostPlayerId: string
  maxPlayers: number
  winScore: number
  seats: PlayerSeat[]
  connections: Map<string, Connection>
  gameState: GameState | null
  roundEndPending: RoundEndPending | null
  turnDeadline: number | null
  turnTimerHandle: ReturnType<typeof setTimeout> | null
}

const rooms = new Map<string, Room>()
const connectionRooms = new Map<string, string>()

function makeCode() {
  return randomBytes(3).toString('hex').toUpperCase()
}

function makeConnectionId() {
  return randomBytes(8).toString('hex')
}

function makeToken() {
  return randomBytes(16).toString('hex')
}

function findSeat(room: Room, playerId: string) {
  return room.seats.find((s) => s.playerId === playerId)
}

function disconnectedPlayerIds(room: Room): string[] {
  return room.seats
    .filter((s) => !s.connectionId)
    .map((s) => s.playerId)
}

function lobbyPlayers(room: Room): LobbyPlayer[] {
  return room.seats.map((s) => ({
    id: s.playerId,
    name: s.name,
    connected: !!s.connectionId && room.connections.has(s.connectionId),
  }))
}

function seatedPlayerIds(room: Room): string[] {
  return room.seats.map((s) => s.playerId)
}

function clearDisconnectTimer(seat: PlayerSeat) {
  if (seat.disconnectTimer) {
    clearTimeout(seat.disconnectTimer)
    seat.disconnectTimer = null
  }
}

function clearTurnTimer(room: Room) {
  if (room.turnTimerHandle) {
    clearTimeout(room.turnTimerHandle)
    room.turnTimerHandle = null
  }
  room.turnDeadline = null
}

function scheduleTurnTimer(room: Room) {
  clearTurnTimer(room)
  if (
    !room.gameState ||
    room.gameState.phase !== 'playing' ||
    room.roundEndPending
  ) {
    return
  }

  room.turnDeadline = Date.now() + ONLINE_TURN_TIMER_MS
  room.turnTimerHandle = setTimeout(() => {
    handleAutoPlay(room, 'time')
  }, ONLINE_TURN_TIMER_MS)
}

function handleAutoPlay(room: Room, reason: 'time' | 'disconnect') {
  if (!room.gameState || room.gameState.phase !== 'playing') return

  const playerId = room.gameState.currentPlayerId
  const seat = findSeat(room, playerId)
  if (!seat) return

  if (reason === 'disconnect' && seat.connectionId) return

  const step = runAutoPlayForPlayer(room.gameState, playerId)
  if (!step) return

  room.gameState = step.state
  const suffix = reason === 'time' ? ' (time)' : ' (away)'
  applyRoundEnd(room, step.message.replace(/\.$/, '') + suffix + '.')
  scheduleTurnTimer(room)
}

function scheduleDisconnectAutoPlay(room: Room, playerId: string) {
  const seat = findSeat(room, playerId)
  if (!seat) return
  clearDisconnectTimer(seat)

  seat.disconnectTimer = setTimeout(() => {
    if (!room.gameState || room.gameState.currentPlayerId !== playerId) return
    handleAutoPlay(room, 'disconnect')
  }, DISCONNECT_AUTO_PLAY_MS)
}

function lobbyMessage(room: Room, conn: Connection): ServerMessage | null {
  const seat = findSeat(room, conn.playerId)
  if (!seat) return null
  return {
    type: 'lobby',
    code: room.code,
    players: lobbyPlayers(room),
    hostId: room.hostPlayerId,
    maxPlayers: room.maxPlayers,
    winScore: room.winScore,
    yourPlayerId: conn.playerId,
    rejoinToken: seat.token,
  }
}

function broadcastLobby(room: Room) {
  for (const conn of room.connections.values()) {
    const msg = lobbyMessage(room, conn)
    if (msg) sendJson(conn.ws, msg)
  }
}

function broadcastGame(room: Room, message: string) {
  if (!room.gameState) return
  scheduleTurnTimer(room)
  const disconnected = disconnectedPlayerIds(room)

  for (const conn of room.connections.values()) {
    const msg: ServerMessage = {
      type: 'game',
      state: filterGameStateForPlayer(room.gameState, conn.playerId),
      message,
      turnDeadline: room.turnDeadline ?? undefined,
      disconnectedPlayerIds: disconnected,
    }
    sendJson(conn.ws, msg)
  }
}

function broadcastRoundEnd(room: Room) {
  const pending = room.roundEndPending
  if (!pending) return

  clearTurnTimer(room)
  const continuedIds = [...pending.continued]
  const disconnected = disconnectedPlayerIds(room)

  for (const conn of room.connections.values()) {
    const msg: ServerMessage = {
      type: 'roundEnd',
      displayState: filterGameStateForRoundEnd(
        pending.displayState,
        conn.playerId
      ),
      pendingState: filterGameStateForPlayer(pending.pendingState, conn.playerId),
      message: pending.message,
      continuedIds,
      disconnectedPlayerIds: disconnected,
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
  picks: CardPick[],
  ws: WebSocket
) {
  if (!room.gameState) return
  const result = playCards(room.gameState, playerId, picks)
  if (!result) return
  if (result.blocked) {
    sendError(ws, result.message)
    return
  }
  room.gameState = result.state
  applyRoundEnd(room, result.message)
}

function assignPlayerId(room: Room): string | null {
  const used = new Set(room.seats.map((s) => s.playerId))
  for (let i = 0; i < room.maxPlayers; i++) {
    const id = `player-${i}`
    if (!used.has(id)) return id
  }
  return null
}

function attachConnection(
  room: Room,
  connectionId: string,
  ws: WebSocket,
  seat: PlayerSeat
) {
  clearDisconnectTimer(seat)
  seat.connectionId = connectionId
  room.connections.set(connectionId, {
    id: connectionId,
    ws,
    playerId: seat.playerId,
  })
  connectionRooms.set(connectionId, room.code)
}

function sendError(ws: WebSocket, message: string) {
  sendJson(ws, { type: 'error', message })
}

function handleKick(room: Room, hostConn: Connection, targetPlayerId: string) {
  if (hostConn.playerId !== room.hostPlayerId) {
    sendError(hostConn.ws, 'Only the host can kick players.')
    return
  }

  if (targetPlayerId === room.hostPlayerId) {
    sendError(hostConn.ws, 'You cannot kick yourself.')
    return
  }

  const seatIndex = room.seats.findIndex((s) => s.playerId === targetPlayerId)
  if (seatIndex < 0) {
    sendError(hostConn.ws, 'Player not found.')
    return
  }

  const seat = room.seats[seatIndex]!
  if (seat.connectionId) {
    const conn = room.connections.get(seat.connectionId)
    room.connections.delete(seat.connectionId)
    connectionRooms.delete(seat.connectionId)
    conn?.ws.close()
  }

  room.seats.splice(seatIndex, 1)

  if (room.gameState?.phase === 'playing') {
    broadcastGame(room, `${seat.name} was removed from the game.`)
  } else {
    broadcastLobby(room)
  }
}

export function handleClientMessage(
  connectionId: string,
  ws: WebSocket,
  message: ClientMessage
) {
  if (message.type === 'create') {
    const count = normalizePlayerCount(message.playerCount)
    const winScore = normalizeWinScore(message.winScore ?? DEFAULT_WIN_SCORE)
    const name = message.name.trim() || 'Host'
    const code = makeCode()
    const hostSeat: PlayerSeat = {
      playerId: 'player-0',
      name,
      token: makeToken(),
      connectionId: null,
      disconnectTimer: null,
    }

    const room: Room = {
      code,
      hostPlayerId: 'player-0',
      maxPlayers: count,
      winScore,
      seats: [hostSeat],
      connections: new Map(),
      gameState: createSetupState(count, 'online', undefined, winScore),
      roundEndPending: null,
      turnDeadline: null,
      turnTimerHandle: null,
    }

    rooms.set(code, room)
    attachConnection(room, connectionId, ws, hostSeat)
    broadcastLobby(room)
    return
  }

  if (message.type === 'rejoin') {
    handleRejoin(connectionId, ws, message.code, message.token)
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
  if (!conn) {
    sendError(ws, 'You are not seated in this room.')
    return
  }

  if (message.type === 'join') {
    sendError(ws, 'Already in a room.')
    return
  }

  if (message.type === 'kick') {
    handleKick(room, conn, message.playerId)
    return
  }

  if (message.type === 'start') {
    if (conn.playerId !== room.hostPlayerId) {
      sendError(ws, 'Only the host can start the game.')
      return
    }

    const seated = lobbyPlayers(room)
    if (seated.length < MIN_ONLINE_PLAYERS) {
      sendError(ws, `Need at least ${MIN_ONLINE_PLAYERS} players to start.`)
      return
    }

    if (seated.some((p) => !p.connected)) {
      sendError(ws, 'All players must be connected to start.')
      return
    }

    const names = seated.map((p) => p.name)
    room.gameState = startGame(seated.length, 'online', names, room.winScore)
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
      clearTurnTimer(room)
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
    handlePlayAction(room, playerId, message.picks, ws)
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
    const previous = room.gameState
    const next = endTurn(room.gameState, playerId)
    if (next === previous) {
      sendError(ws, 'You must play, flip, or overplay before ending your turn.')
      return
    }
    room.gameState = next
    broadcastGame(room, 'Turn ended.')
    return
  }

  if (message.type === 'pickUp') {
    const previous = room.gameState
    const player = room.gameState.players.find((p) => p.id === playerId)
    const next = pickUpPile(room.gameState, playerId)
    if (next === previous) {
      sendError(ws, 'You cannot pick up the pile right now.')
      return
    }
    room.gameState = next
    const name = player?.name ?? 'Player'
    applyRoundEnd(room, `${name} picked up the pile.`)
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
    clearTurnTimer(room)
    broadcastLobby(room)
  }
}

function handleRejoin(
  connectionId: string,
  ws: WebSocket,
  code: string,
  token: string
) {
  const room = rooms.get(code.toUpperCase())
  if (!room) {
    sendError(ws, 'Room not found. Check the code.')
    return
  }

  const seat = room.seats.find((s) => s.token === token)
  if (!seat) {
    sendError(ws, 'Invalid rejoin token.')
    return
  }

  if (seat.connectionId) {
    const existing = room.connections.get(seat.connectionId)
    if (existing?.ws.readyState === existing.ws.OPEN) {
      sendError(ws, 'This seat is already connected.')
      return
    }
    room.connections.delete(seat.connectionId)
    connectionRooms.delete(seat.connectionId)
  }

  attachConnection(room, connectionId, ws, seat)

  if (room.gameState?.phase === 'playing' || room.roundEndPending) {
    if (room.roundEndPending) {
      broadcastRoundEnd(room)
    } else if (room.gameState) {
      broadcastGame(room, `${seat.name} rejoined.`)
    }
    return
  }

  broadcastLobby(room)
}

export function handleJoinRoom(
  connectionId: string,
  ws: WebSocket,
  code: string,
  name: string,
  rejoinToken?: string
) {
  const room = rooms.get(code.toUpperCase())
  if (!room) {
    sendError(ws, 'Room not found. Check the code.')
    return
  }

  if (rejoinToken) {
    handleRejoin(connectionId, ws, code, rejoinToken)
    return
  }

  if (room.gameState?.phase === 'playing') {
    sendError(ws, 'This game already started. Use your invite link to rejoin.')
    return
  }

  const playerId = assignPlayerId(room)
  if (!playerId) {
    sendError(ws, 'Room is full.')
    return
  }

  const seat: PlayerSeat = {
    playerId,
    name: name.trim() || `Player ${playerId.split('-')[1]}`,
    token: makeToken(),
    connectionId: null,
    disconnectTimer: null,
  }

  room.seats.push(seat)
  attachConnection(room, connectionId, ws, seat)
  broadcastLobby(room)
}

export function handleDisconnect(connectionId: string) {
  const roomCode = connectionRooms.get(connectionId)
  if (!roomCode) return

  const room = rooms.get(roomCode)
  if (!room) return

  const conn = room.connections.get(connectionId)
  const playerId = conn?.playerId
  room.connections.delete(connectionId)
  connectionRooms.delete(connectionId)

  if (playerId) {
    const seat = findSeat(room, playerId)
    if (seat) {
      seat.connectionId = null
      if (room.gameState?.phase === 'playing') {
        scheduleDisconnectAutoPlay(room, playerId)
      }
    }
  }

  if (room.connections.size === 0) {
    clearTurnTimer(room)
    for (const s of room.seats) clearDisconnectTimer(s)
    rooms.delete(roomCode)
    return
  }

  if (conn && conn.playerId === room.hostPlayerId) {
    const nextConn = room.connections.values().next().value
    if (nextConn) room.hostPlayerId = nextConn.playerId
  }

  if (room.gameState?.phase === 'playing') {
    const name = playerId ? findSeat(room, playerId)?.name ?? 'A player' : 'A player'
    if (room.roundEndPending) {
      broadcastRoundEnd(room)
    } else {
      broadcastGame(room, `${name} disconnected.`)
    }
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
      handleJoinRoom(
        connectionId,
        ws,
        parsed.code,
        parsed.name,
        parsed.rejoinToken
      )
      return
    }

    if (parsed.type === 'rejoin') {
      handleRejoin(connectionId, ws, parsed.code, parsed.token)
      return
    }

    handleClientMessage(connectionId, ws, parsed)
  })

  ws.on('close', () => handleDisconnect(connectionId))
}
