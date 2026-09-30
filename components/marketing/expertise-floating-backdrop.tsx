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
  tier: 'all' | 'tablet-up' | 'desktop-only'
}

const floatingMarks: readonly FloatingMark[] = [
  { mark: '🔬', top: '5%', left: '4%', size: 58, opacity: 0.24, rotation: -12, motion: 1, duration: 12, delay: -3, tier: 'all' },
  { mark: '📝', top: '13%', left: '17%', size: 38, opacity: 0.20, rotation: 8, motion: 2, duration: 14, delay: -7, tier: 'tablet-up' },
  { mark: '🏛️', top: '10%', right: '16%', size: 48, opacity: 0.22, rotation: -7, motion: 3, duration: 13, delay: -6, tier: 'tablet-up' },
  { mark: '📣', top: '4%', right: '5%', size: 76, opacity: 0.18, rotation: 15, motion: 4, duration: 15, delay: -5, tier: 'all' },
  { mark: '💼', top: '35%', left: '2.5%', size: 52, opacity: 0.22, rotation: -10, motion: 2, duration: 13, delay: -9, tier: 'tablet-up' },
  { mark: '✍️', top: '25%', left: '30%', size: 32, opacity: 0.18, rotation: 14, motion: 1, duration: 12, delay: -4, tier: 'desktop-only' },
  { mark: '📊', top: '23%', right: '28%', size: 40, opacity: 0.19, rotation: -8, motion: 3, duration: 14, delay: -4, tier: 'desktop-only' },
  { mark: '🎤', top: '38%', right: '2.5%', size: 54, opacity: 0.23, rotation: 11, motion: 4, duration: 11, delay: -7, tier: 'tablet-up' },
  { mark: '🔬', top: '58%', left: '49%', size: 86, opacity: 0.14, rotation: -15, motion: 1, duration: 16, delay: -8, tier: 'desktop-only' },
  { mark: '📣', top: '72%', left: '3.5%', size: 44, opacity: 0.20, rotation: 9, motion: 3, duration: 12, delay: -5, tier: 'all' },
  { mark: '📝', top: '89%', left: '11%', size: 60, opacity: 0.21, rotation: -9, motion: 2, duration: 15, delay: -2, tier: 'tablet-up' },
  { mark: '💼', top: '74%', right: '3.5%', size: 44, opacity: 0.22, rotation: -11, motion: 4, duration: 13, delay: -6, tier: 'all' },
  { mark: '📊', top: '88%', right: '9%', size: 74, opacity: 0.17, rotation: 13, motion: 1, duration: 14, delay: -10, tier: 'all' },
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
          filter: 'saturate(1.05)',
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
