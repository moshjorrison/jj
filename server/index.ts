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
  handleConnection(ws)
})

server.listen(port, () => {
  console.log(`J&J multiplayer server listening on port ${port}`)
})
