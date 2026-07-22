import type { CSSProperties } from 'react'
import { sharpText } from '../display'

export function actionButtonStyle(enabled: boolean): CSSProperties {
  return {
    padding: '8px 14px',
    borderRadius: 8,
    border: enabled
      ? '0.5px solid rgba(255,255,255,0.28)'
      : '0.5px solid rgba(255,255,255,0.12)',
    background: enabled
      ? 'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.08) 100%)'
      : 'rgba(255,255,255,0.05)',
    color: enabled ? 'white' : 'rgba(255,255,255,0.25)',
    fontWeight: 700,
    fontSize: 12,
    cursor: enabled ? 'pointer' : 'default',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    boxShadow: enabled
      ? '0 1px 0 rgba(255,255,255,0.12) inset, 0 4px 14px rgba(0,0,0,0.18)'
      : 'none',
    ...sharpText,
  }
}
