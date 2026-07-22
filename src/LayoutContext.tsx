import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { computeLayout, type LayoutSizes } from './layout'

const LayoutContext = createContext<LayoutSizes | null>(null)

function getViewportSize() {
  const vv = window.visualViewport
  return {
    width: vv?.width ?? window.innerWidth,
    height: vv?.height ?? window.innerHeight,
  }
}

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [viewport, setViewport] = useState(() => getViewportSize())
  const [isTouch, setIsTouch] = useState(
    () => window.matchMedia('(pointer: coarse)').matches
  )

  useEffect(() => {
    const update = () => setViewport(getViewportSize())
    const vv = window.visualViewport
    vv?.addEventListener('resize', update)
    vv?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      vv?.removeEventListener('resize', update)
      vv?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)')
    const onChange = () => setIsTouch(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const layout = useMemo(
    () => computeLayout(viewport.width, viewport.height, isTouch),
    [viewport.width, viewport.height, isTouch]
  )

  return (
    <LayoutContext.Provider value={layout}>{children}</LayoutContext.Provider>
  )
}

export function useLayout(): LayoutSizes {
  const layout = useContext(LayoutContext)
  if (!layout) {
    return computeLayout(
      typeof window !== 'undefined' ? window.innerWidth : 390,
      typeof window !== 'undefined' ? window.innerHeight : 700,
      false
    )
  }
  return layout
}
