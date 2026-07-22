import { gpuLayer } from '../display'
import { CardFace } from '../cardUi'
import type { FlyingCard } from './types'

export function FlyingCardsOverlay({ cards }: { cards: FlyingCard[] }) {
  if (cards.length === 0) return null

  return (
    <>
      {cards.map((fc) => (
        <div
          key={fc.id}
          className="card-surface"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            zIndex: 60,
            pointerEvents: 'none',
            willChange: 'transform, opacity',
            ['--from-x' as string]: `${fc.fromX - fc.width / 2}px`,
            ['--from-y' as string]: `${fc.fromY - fc.height / 2}px`,
            ['--to-x' as string]: `${fc.toX - fc.width / 2}px`,
            ['--to-y' as string]: `${fc.toY - fc.height / 2}px`,
            ['--from-rot' as string]: `${fc.startRotation}deg`,
            ['--to-rot' as string]: `${fc.endRotation}deg`,
            animationName: 'flying-card-to-pile',
            animationDuration: `${fc.durationMs}ms`,
            animationTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
            animationDelay: `${fc.delayMs}ms`,
            animationFillMode: 'forwards',
            ...gpuLayer,
          }}
        >
          <CardFace
            card={fc.card}
            width={fc.width}
            height={fc.height}
            rotation={fc.startRotation}
          />
        </div>
      ))}
    </>
  )
}
