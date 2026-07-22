export function getWsUrl(): string {
  const configured = import.meta.env.VITE_WS_URL as string | undefined
  let url = configured?.trim() ?? ''
  if (!url && import.meta.env.DEV) url = 'ws://localhost:3001'
  if (!url) return ''
  if (url.startsWith('https://')) url = `wss://${url.slice('https://'.length)}`
  if (url.startsWith('http://')) url = `ws://${url.slice('http://'.length)}`
  return url.replace(/\/$/, '')
}
