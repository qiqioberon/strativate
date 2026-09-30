import type { CSSProperties } from 'react'

type FloatingMarkStyle = CSSProperties & {
  '--item-rot': string
  '--item-dur': string
  '--item-delay': string
}

interface FloatingMark {
  mark: '📝' | '💼' | '✍️' | '🔬' | '📣' | '📊' | '🎤' | '🏛️'
  top: string
  left?: string
  right?: string
  size: number
  opacity: number
  rotation: number
  motion: 1 | 2 | 3 | 4
  duration: number
  delay: number
  blur?: number
  tier: 'all' | 'tablet-up' | 'desktop-only'
}

const floatingMarks: readonly FloatingMark[] = [
  { mark: '🔬', top: '5%', left: '4%', size: 52, opacity: 0.12, rotation: -12, motion: 1, duration: 18, delay: -3, tier: 'all' },
  { mark: '📝', top: '13%', left: '17%', size: 32, opacity: 0.10, rotation: 8, motion: 2, duration: 22, delay: -7, tier: 'tablet-up' },
  { mark: '🏛️', top: '10%', right: '16%', size: 42, opacity: 0.11, rotation: -7, motion: 3, duration: 20, delay: -12, tier: 'tablet-up' },
  { mark: '📣', top: '4%', right: '5%', size: 70, opacity: 0.07, rotation: 15, motion: 4, duration: 24, delay: -5, blur: 0.5, tier: 'all' },
  { mark: '💼', top: '35%', left: '2.5%', size: 46, opacity: 0.12, rotation: -10, motion: 2, duration: 21, delay: -9, tier: 'tablet-up' },
  { mark: '✍️', top: '25%', left: '30%', size: 26, opacity: 0.08, rotation: 14, motion: 1, duration: 19, delay: -14, tier: 'desktop-only' },
  { mark: '📊', top: '23%', right: '28%', size: 34, opacity: 0.09, rotation: -8, motion: 3, duration: 23, delay: -4, tier: 'desktop-only' },
  { mark: '🎤', top: '38%', right: '2.5%', size: 48, opacity: 0.12, rotation: 11, motion: 4, duration: 17, delay: -11, tier: 'tablet-up' },
  { mark: '🔬', top: '58%', left: '49%', size: 78, opacity: 0.05, rotation: -15, motion: 1, duration: 26, delay: -8, blur: 1, tier: 'desktop-only' },
  { mark: '📣', top: '72%', left: '3.5%', size: 36, opacity: 0.11, rotation: 9, motion: 3, duration: 18, delay: -15, tier: 'all' },
  { mark: '📝', top: '89%', left: '11%', size: 54, opacity: 0.11, rotation: -9, motion: 2, duration: 25, delay: -2, tier: 'tablet-up' },
  { mark: '💼', top: '74%', right: '3.5%', size: 38, opacity: 0.11, rotation: -11, motion: 4, duration: 20, delay: -16, tier: 'all' },
  { mark: '📊', top: '88%', right: '9%', size: 66, opacity: 0.07, rotation: 13, motion: 1, duration: 22, delay: -10, blur: 0.5, tier: 'all' },
]

export function ExpertiseFloatingBackdrop() {
  return (
    <div className="homepage-expertise__ambient" aria-hidden="true">
      {floatingMarks.map((item, index) => {
        const style: FloatingMarkStyle = {
          top: item.top,
          ...(item.left ? { left: item.left } : { right: item.right }),
          fontSize: `${item.size}px`,
          opacity: item.opacity,
          transform: `rotate(${item.rotation}deg)`,
          ['--item-rot']: `${item.rotation}deg`,
          ['--item-dur']: `${item.duration}s`,
          ['--item-delay']: `${item.delay}s`,
          ...(item.blur ? { filter: `saturate(.75) blur(${item.blur}px)` } : { filter: 'saturate(.75)' }),
        }

        return (
          <span
            key={index}
            className={`homepage-expertise__ambient-item homepage-expertise__ambient-item--${item.tier}`}
            data-motion={item.motion}
            style={style}
          >
            {item.mark}
          </span>
        )
      })}
    </div>
  )
}
