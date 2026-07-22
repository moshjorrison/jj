import { useLayoutEffect, useState, type RefObject } from 'react'

export function useMobileBoardScale(
  containerRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  deps: unknown[]
) {
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    if (!enabled) {
      setScale(1)
      return
    }

    const measure = () => {
      const container = containerRef.current
      const content = contentRef.current
      if (!container || !content) return

      const availableH = container.clientHeight
      const availableW = container.clientWidth
      const neededH = content.scrollHeight
      const neededW = content.scrollWidth
      if (availableH <= 0 || neededH <= 0) return

      const scaleH = availableH / neededH
      const scaleW = neededW > 0 ? availableW / neededW : 1
      const next = Math.min(1, scaleH, scaleW)
      const clamped = Math.max(0.52, next)
      setScale((prev) => (Math.abs(prev - clamped) < 0.008 ? prev : clamped))
    }

    measure()

    const ro = new ResizeObserver(measure)
    if (containerRef.current) ro.observe(containerRef.current)
    if (contentRef.current) ro.observe(contentRef.current)

    const vv = window.visualViewport
    vv?.addEventListener('resize', measure)
    window.addEventListener('orientationchange', measure)

    return () => {
      ro.disconnect()
      vv?.removeEventListener('resize', measure)
      window.removeEventListener('orientationchange', measure)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, containerRef, contentRef, ...deps])

  return scale
}
