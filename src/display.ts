import type { CSSProperties } from 'react'

/** Snap layout values to physical device pixels for crisp rendering on Retina. */
export function snapPx(value: number): number {
  if (typeof window === 'undefined') return Math.round(value)
  const dpr = window.devicePixelRatio || 1
  return Math.round(value * dpr) / dpr
}

export const sharpText: CSSProperties = {
  WebkitFontSmoothing: 'antialiased',
  MozOsxFontSmoothing: 'grayscale',
  textRendering: 'optimizeLegibility',
}

export const gpuLayer: CSSProperties = {
  WebkitBackfaceVisibility: 'hidden',
  backfaceVisibility: 'hidden',
}

export const modalOverlay: CSSProperties = {
  WebkitBackdropFilter: 'blur(10px) saturate(1.15)',
  backdropFilter: 'blur(10px) saturate(1.15)',
}

export const modalPanel: CSSProperties = {
  ...sharpText,
  boxShadow:
    '0 24px 48px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)',
}
