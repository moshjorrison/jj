import type { CSSProperties } from 'react'
import { WIN_SCORE_OPTIONS } from './winScore'

type WinScoreFieldProps = {
  value: number
  onChange: (value: number) => void
  style?: CSSProperties
}

export function WinScoreField({ value, onChange, style }: WinScoreFieldProps) {
  return (
    <>
      <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>
        Play to
      </label>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={style}
      >
        {WIN_SCORE_OPTIONS.map((score) => (
          <option key={score} value={score}>
            {score} points
          </option>
        ))}
      </select>
    </>
  )
}
