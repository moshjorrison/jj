import WebSocket from 'ws'

const WS_URL = process.env.WS_URL ?? 'ws://localhost:3001'
const IS_PRODUCTION = WS_URL.includes('onrender.com')
const DISCONNECT_TIMEOUT_MS = IS_PRODUCTION ? 35000 : 10000
const results = []

function pass(name) {
  results.push({ name, ok: true })
  console.log(`✓ ${name}`)
}

function fail(name, err) {
  results.push({ name, ok: false, err: String(err) })
  console.error(`✗ ${name}: ${err}`)
}

function waitFor(ws, type, timeoutMs = 5000, predicate = null) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(`timeout waiting for ${type}`))
    }, timeoutMs)

    function onMessage(data) {
      const msg = JSON.parse(data.toString())
      if (msg.type === type && (!predicate || predicate(msg))) {
        cleanup()
        resolve(msg)
      } else if (msg.type === 'error') {
        cleanup()
        reject(new Error(msg.message))
      }
    }

    function cleanup() {
      clearTimeout(timer)
      ws.off('message', onMessage)
    }

    ws.on('message', onMessage)
  })
}

function connect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL)
    ws.on('open', () => resolve(ws))
    ws.on('error', reject)
  })
}

async function main() {
  console.log(`Testing online server at ${WS_URL}\n`)

  const host = await connect()
  host.send(JSON.stringify({ type: 'create', playerCount: 4, name: 'Host' }))
  const lobby = await waitFor(host, 'lobby')
  const roomCode = lobby.code
  const hostToken = lobby.rejoinToken
  const hostId = lobby.yourPlayerId

  if (lobby.players.length === 1 && lobby.players[0].connected) {
    pass('create room + connection status')
  } else {
    fail('create room + connection status', JSON.stringify(lobby.players))
  }

  if (hostToken && hostId) pass('rejoin token issued')
  else fail('rejoin token issued', 'missing token or id')

  const p2 = await connect()
  p2.send(JSON.stringify({ type: 'join', code: roomCode, name: 'P2' }))
  const lobby2 = await waitFor(p2, 'lobby')
  if (lobby2.players.length === 2) pass('second player joins')
  else fail('second player joins', `count=${lobby2.players.length}`)

  const p2Token = lobby2.rejoinToken
  const p2Id = lobby2.yourPlayerId

  const p3 = await connect()
  p3.send(JSON.stringify({ type: 'join', code: roomCode, name: 'P3' }))
  await waitFor(p3, 'lobby')

  const p4 = await connect()
  p4.send(JSON.stringify({ type: 'join', code: roomCode, name: 'P4' }))
  const lobby4 = await waitFor(p4, 'lobby')
  if (lobby4.players.length === 4) pass('four players seated')
  else fail('four players seated', `count=${lobby4.players.length}`)

  host.send(JSON.stringify({ type: 'kick', playerId: lobby4.yourPlayerId }))
  const lobbyAfterKick = await waitFor(
    host,
    'lobby',
    8000,
    (msg) => msg.players.length === 3
  )
  if (lobbyAfterKick.players.length === 3) pass('host kick removes player')
  else fail('host kick removes player', `count=${lobbyAfterKick.players.length}`)

  await new Promise((r) => setTimeout(r, 200))

  const p4b = await connect()
  p4b.send(JSON.stringify({ type: 'join', code: roomCode, name: 'P4b' }))
  await waitFor(p4b, 'lobby')

  host.send(JSON.stringify({ type: 'start' }))
  const game = await waitFor(host, 'game')
  if (game.state?.phase === 'playing') pass('game starts with 4 players')
  else fail('game starts with 4 players', game.state?.phase)

  if (typeof game.turnDeadline === 'number' && game.turnDeadline > Date.now()) {
    pass('turn deadline sent')
  } else {
    fail('turn deadline sent', String(game.turnDeadline))
  }

  if (Array.isArray(game.disconnectedPlayerIds)) pass('disconnected list present')
  else fail('disconnected list present', 'missing')

  const disconnectPromise = waitFor(
    host,
    'game',
    DISCONNECT_TIMEOUT_MS,
    (msg) => msg.disconnectedPlayerIds?.includes(p2Id)
  )
  p2.close()
  const gameAfterDisconnect = await disconnectPromise
  if (gameAfterDisconnect.disconnectedPlayerIds?.includes(p2Id)) {
    pass('disconnect tracked in game state')
  } else {
    fail('disconnect tracked in game state', JSON.stringify(gameAfterDisconnect.disconnectedPlayerIds))
  }

  const rejoin = await connect()
  const rejoinPromise = waitFor(
    rejoin,
    'game',
    10000,
    (msg) => msg.message?.includes('rejoined')
  )
  rejoin.send(
    JSON.stringify({ type: 'rejoin', code: roomCode, token: p2Token })
  )
  const gameRejoin = await rejoinPromise
  if (gameRejoin.message?.includes('rejoined')) pass('rejoin mid-game')
  else fail('rejoin mid-game', gameRejoin.message)

  if (gameRejoin.disconnectedPlayerIds && !gameRejoin.disconnectedPlayerIds.includes(p2Id)) {
    pass('rejoin clears disconnected status')
  } else {
    fail('rejoin clears disconnected status', JSON.stringify(gameRejoin.disconnectedPlayerIds))
  }

  host.close()
  p3.close()
  p4b.close()
  rejoin.close()

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  if (failed.length) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
