import type { CSSProperties } from 'react'
import { PLAYER_COUNT_OPTIONS } from './playerCount'

type PlayerCountFieldProps = {
  value: number
  onChange: (value: number) => void
  style?: CSSProperties
  label?: string
}

export function PlayerCountField({
  value,
  onChange,
  style,
  label = 'Players',
}: PlayerCountFieldProps) {
  return (
    <>
      <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={style}
      >
        {PLAYER_COUNT_OPTIONS.map((count) => (
          <option key={count} value={count}>
            {count} {count === 1 ? 'player' : 'players'}
          </option>
        ))}
      </select>
    </>
  )
}
