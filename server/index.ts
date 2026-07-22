import { createServer } from 'node:http'
import { WebSocketServer } from 'ws'
import { handleConnection } from './rooms.js'

const port = Number(process.env.PORT) || 3001

const server = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('J&J multiplayer server is running.\n')
})

const wss = new WebSocketServer({ server })

wss.on('connection', (ws) => {
  const socket = ws as typeof ws & { isAlive?: boolean }
  socket.isAlive = true
  socket.on('pong', () => {
    socket.isAlive = true
  })
  handleConnection(ws)
})

const heartbeatMs = 25_000
const heartbeat = setInterval(() => {
  for (const client of wss.clients) {
    const socket = client as typeof client & { isAlive?: boolean }
    if (socket.isAlive === false) {
      socket.terminate()
      continue
    }
    socket.isAlive = false
    socket.ping()
  }
}, heartbeatMs)

wss.on('close', () => clearInterval(heartbeat))

server.listen(port, '0.0.0.0', () => {
  console.log(`J&J multiplayer server listening on port ${port}`)
})
