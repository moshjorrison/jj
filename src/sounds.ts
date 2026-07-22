const MUTE_KEY = 'jj-sound-muted'

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!Ctx) return null
    audioCtx = new Ctx()
  }
  return audioCtx
}

export function isSoundMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export function setSoundMuted(muted: boolean): void {
  try {
    if (muted) localStorage.setItem(MUTE_KEY, '1')
    else localStorage.removeItem(MUTE_KEY)
  } catch {
    // ignore
  }
}

function playTone(
  frequency: number,
  durationMs: number,
  type: OscillatorType = 'sine',
  gain = 0.08
) {
  if (isSoundMuted()) return
  const ctx = getAudioContext()
  if (!ctx) return

  void ctx.resume()

  const osc = ctx.createOscillator()
  const gainNode = ctx.createGain()
  osc.type = type
  osc.frequency.value = frequency
  gainNode.gain.value = gain
  osc.connect(gainNode)
  gainNode.connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + durationMs / 1000)
}

function haptic(pattern: number | number[]) {
  if (isSoundMuted()) return
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // unsupported
  }
}

export type SoundEvent =
  | 'flip'
  | 'clear'
  | 'swoop'
  | 'turn'
  | 'roundEnd'
  | 'pickup'

export function playSound(event: SoundEvent) {
  switch (event) {
    case 'flip':
      playTone(440, 90, 'triangle', 0.06)
      haptic(12)
      break
    case 'clear':
      playTone(523, 60, 'square', 0.05)
      playTone(784, 120, 'square', 0.05)
      haptic([20, 30, 20])
      break
    case 'swoop':
      playTone(330, 50, 'sawtooth', 0.04)
      playTone(220, 100, 'sawtooth', 0.04)
      haptic(18)
      break
    case 'turn':
      playTone(392, 70, 'sine', 0.05)
      haptic(8)
      break
    case 'roundEnd':
      playTone(262, 100, 'sine', 0.06)
      playTone(330, 100, 'sine', 0.06)
      playTone(392, 140, 'sine', 0.06)
      haptic([15, 40, 15])
      break
    case 'pickup':
      playTone(180, 120, 'triangle', 0.07)
      haptic(25)
      break
  }
}
