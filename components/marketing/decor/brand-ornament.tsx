import Image from 'next/image'
import type { CSSProperties } from 'react'

import { getAsset } from '@/lib/content/asset-registry'
import { cn } from '@/lib/utils'

// Strativate's own 3D ornaments (coils, torus, cone, pyramid, cylinders), trimmed from the strativate.id
// production artwork. Purely decorative: sections position and size them through their own classes.
export const brandOrnaments = {
  'coil-amber': { asset: 'brand.ornament.coil-amber', width: 265, height: 281 },
  'coil-orange': { asset: 'brand.ornament.coil-orange', width: 128, height: 134 },
  'coil-coral': { asset: 'brand.ornament.coil-coral', width: 203, height: 262 },
  'coil-white': { asset: 'brand.ornament.coil-white', width: 128, height: 134 },
  'torus-orange': { asset: 'brand.ornament.torus-orange', width: 250, height: 231 },
  'pyramid-orange': { asset: 'brand.ornament.pyramid-orange', width: 137, height: 150 },
  'cone-white': { asset: 'brand.ornament.cone-white', width: 141, height: 165 },
  'cylinder-amber': { asset: 'brand.ornament.cylinder-amber', width: 286, height: 312 },
  'cylinder-white': { asset: 'brand.ornament.cylinder-white', width: 286, height: 312 },
} as const

export type BrandOrnamentName = keyof typeof brandOrnaments

/** Idle motion: float (rise + tilt), bob (rise only), drift (lazy figure-eight), spin (slow turn),
 *  twinkle (sparkles: shrink + turn), none. */
export type DecorMotion = 'float' | 'bob' | 'drift' | 'spin' | 'twinkle' | 'none'

type OrnamentStyle = CSSProperties & {
  '--orn-depth'?: string
  '--orn-delay'?: string
  '--orn-duration'?: string
  '--orn-rotate'?: string
}

export function BrandOrnament({
  name,
  className,
  motion = 'float',
  depth = 0.5,
  delay = 0,
  duration = 6,
  rotate = 0,
  far = false,
  eager = false,
  style,
}: {
  name: BrandOrnamentName
  /** Positions and sizes the ornament (`--orn-size`, top/left/right/bottom) from the section stylesheet. */
  className?: string
  motion?: DecorMotion
  /** Pointer-parallax strength inside a ParallaxLayer, 0 (static) to ~1.4 (close to the viewer). */
  depth?: number
  /** Seconds; use negative values so neighbouring ornaments never move in sync. */
  delay?: number
  duration?: number
  rotate?: number
  /** Background plane: softer, slightly blurred and smaller in feel. */
  far?: boolean
  /** Above-the-fold ornaments load eagerly at low priority so they never compete with the headline. */
  eager?: boolean
  style?: CSSProperties
}) {
  const ornament = brandOrnaments[name]
  const ornamentStyle: OrnamentStyle = {
    '--orn-depth': String(depth),
    '--orn-delay': `${delay}s`,
    '--orn-duration': `${duration}s`,
    '--orn-rotate': `${rotate}deg`,
    ...style,
  }

  return (
    <span
      className={cn('brand-ornament', className)}
      data-motion={motion}
      data-depth={far ? 'far' : undefined}
      aria-hidden="true"
      style={ornamentStyle}
    >
      <Image
        src={getAsset(ornament.asset).src}
        alt=""
        width={ornament.width}
        height={ornament.height}
        draggable={false}
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority="low"
      />
    </span>
  )
}
