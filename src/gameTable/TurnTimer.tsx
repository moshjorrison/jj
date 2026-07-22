import { useEffect, useState } from 'react'

type TurnTimerProps = {
  deadlineMs: number | null
  active: boolean
}

export function TurnTimer({ deadlineMs, active }: TurnTimerProps) {
  const [remainingSec, setRemainingSec] = useState<number | null>(null)

  useEffect(() => {
    if (!active || !deadlineMs) {
      setRemainingSec(null)
      return
    }

    const tick = () => {
      const left = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000))
      setRemainingSec(left)
    }

    tick()
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [active, deadlineMs])

  if (!active || remainingSec === null) return null

  const urgent = remainingSec <= 15

  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: 0.4,
        padding: '4px 10px',
        borderRadius: 999,
        background: urgent ? 'rgba(220,38,38,0.25)' : 'rgba(255,255,255,0.08)',
        border: urgent
          ? '1px solid rgba(248,113,113,0.5)'
          : '1px solid rgba(255,255,255,0.15)',
        color: urgent ? '#fecaca' : 'rgba(255,255,255,0.85)',
      }}
    >
      {remainingSec}s
    </div>
  )
}
