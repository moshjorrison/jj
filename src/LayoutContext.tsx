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

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [width, setWidth] = useState(
    () => window.innerWidth
  )
  const [isTouch, setIsTouch] = useState(
    () => window.matchMedia('(pointer: coarse)').matches
  )

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)')
    const onChange = () => setIsTouch(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const layout = useMemo(
    () => computeLayout(width, isTouch),
    [width, isTouch]
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
      false
    )
  }
  return layout
}
