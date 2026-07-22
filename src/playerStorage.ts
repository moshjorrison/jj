const NAME_KEY = 'jj-player-name'

export function getStoredPlayerName(): string {
  try {
    return localStorage.getItem(NAME_KEY)?.trim() ?? ''
  } catch {
    return ''
  }
}

export function setStoredPlayerName(name: string): void {
  try {
    const trimmed = name.trim()
    if (trimmed) localStorage.setItem(NAME_KEY, trimmed)
    else localStorage.removeItem(NAME_KEY)
  } catch {
    // ignore quota / private mode
  }
}

const REJOIN_PREFIX = 'jj-rejoin-'

export type StoredRejoin = {
  token: string
  playerId: string
}

export function getStoredRejoin(roomCode: string): StoredRejoin | null {
  try {
    const raw = localStorage.getItem(`${REJOIN_PREFIX}${roomCode}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredRejoin
    if (!parsed?.token || !parsed?.playerId) return null
    return parsed
  } catch {
    return null
  }
}

export function setStoredRejoin(
  roomCode: string,
  rejoin: StoredRejoin
): void {
  try {
    localStorage.setItem(
      `${REJOIN_PREFIX}${roomCode}`,
      JSON.stringify(rejoin)
    )
  } catch {
    // ignore
  }
}

export function clearStoredRejoin(roomCode: string): void {
  try {
    localStorage.removeItem(`${REJOIN_PREFIX}${roomCode}`)
  } catch {
    // ignore
  }
}
