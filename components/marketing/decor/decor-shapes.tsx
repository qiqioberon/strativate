import type { CSSProperties, ReactNode } from 'react'

import { cn } from '@/lib/utils'

import type { DecorMotion } from './brand-ornament'

// Flat vector decoration for the homepage: dashed rings, discs and sparkles for quiet accents, and a small
// neobrutalist kit (warm ink outline + hard offset shadow) for labels and framing objects. Colours come
// from the --decor-* tokens in app/home-decor.css; sections position everything through their own classes.

type DecorProps = {
  className?: string
  motion?: DecorMotion
  /** Pointer-parallax strength when placed inside a ParallaxLayer. */
  depth?: number
  /** Seconds, negative to desync neighbours. */
  delay?: number
  style?: CSSProperties
}

function decorStyle(depth: number | undefined, delay: number | undefined, style?: CSSProperties) {
  return {
    ...(depth === undefined ? null : { '--orn-depth': String(depth) }),
    ...(delay === undefined ? null : { '--orn-delay': `${delay}s` }),
    ...style,
  } as CSSProperties
}

/** Thin dashed (or solid) circle outline. Colour = currentColor. */
export function DecorRing({ className, dashed = true, motion = 'none', depth, delay, style }: DecorProps & { dashed?: boolean }) {
  return (
    <svg
      className={cn('decor-shape decor-ring', className)}
      data-motion={motion}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
      style={decorStyle(depth, delay, style)}
    >
      <circle
        cx="50"
        cy="50"
        r="48.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeDasharray={dashed ? '3.5 6.5' : undefined}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

/** Filled circle accent (tinted field behind content). */
export function DecorDisc({ className, motion = 'none', depth, delay, style }: DecorProps) {
  return <span className={cn('decor-shape decor-disc', className)} data-motion={motion} aria-hidden="true" style={decorStyle(depth, delay, style)} />
}

/** Four-point sparkle with an ink outline. */
export function DecorSparkle({ className, motion = 'none', depth, delay, style }: DecorProps) {
  return (
    <svg
      className={cn('decor-shape decor-sparkle', className)}
      data-motion={motion}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      style={decorStyle(depth, delay, style)}
    >
      <path
        d="M12 1.2c.9 6.1 4.6 9.8 10.8 10.8-6.2 1-9.9 4.7-10.8 10.8C11.1 16.7 7.4 13 1.2 12 7.4 11 11.1 7.3 12 1.2Z"
        fill="var(--decor-sparkle-fill, var(--decor-amber))"
        stroke="var(--decor-ink)"
        strokeWidth="1.4"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

/** Hand-drawn wave stroke. Colour = currentColor. */
export function DecorSquiggle({ className, motion = 'none', depth, delay, style }: DecorProps) {
  return (
    <svg
      className={cn('decor-shape decor-squiggle', className)}
      data-motion={motion}
      viewBox="0 0 120 24"
      aria-hidden="true"
      focusable="false"
      style={decorStyle(depth, delay, style)}
    >
      <path
        d="M3 13c8-10 16-10 24 0s16 10 24 0 16-10 24 0 16 10 24 0 12-8 18-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

/**
 * Neobrutalist label: sentence-case text in a pill with a 2px ink outline and a hard offset shadow.
 * Carries real text, so it is not hidden from assistive technology.
 */
export function NeoSticker({
  children,
  icon,
  tone = 'amber',
  className,
  as: Tag = 'span',
  style,
}: {
  children: ReactNode
  icon?: ReactNode
  tone?: 'amber' | 'orange' | 'cream' | 'white' | 'ink'
  className?: string
  as?: 'span' | 'p' | 'div'
  style?: CSSProperties
}) {
  return (
    <Tag className={cn('neo-sticker', className)} data-tone={tone} style={style}>
      {icon ? <span className="neo-sticker__icon">{icon}</span> : null}
      <span className="neo-sticker__label">{children}</span>
    </Tag>
  )
}

/** Mini app window (title bar + content) used as a framing object behind photos or cards. */
export function NeoWindowCard({ className, variant = 'checks', motion = 'none', depth, delay, style }: DecorProps & { variant?: 'checks' | 'chart' | 'lines' }) {
  return (
    <svg
      className={cn('decor-shape neo-window', className)}
      data-motion={motion}
      viewBox="0 0 132 96"
      aria-hidden="true"
      focusable="false"
      style={decorStyle(depth, delay, style)}
    >
      <rect x="7" y="7" width="122" height="86" rx="12" fill="var(--decor-ink)" />
      <rect x="2" y="2" width="122" height="86" rx="12" fill="var(--decor-window-fill, #fff)" stroke="var(--decor-ink)" strokeWidth="2.5" />
      <path d="M2 24h122V14a12 12 0 0 0-12-12H14A12 12 0 0 0 2 14Z" fill="var(--decor-window-bar, var(--decor-amber))" stroke="var(--decor-ink)" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="104" cy="13" r="3.2" fill="var(--decor-ink)" />
      <circle cx="114" cy="13" r="3.2" fill="var(--decor-ink)" />
      <rect x="12" y="10" width="34" height="6" rx="3" fill="var(--decor-ink)" opacity=".85" />
      {variant === 'checks' ? (
        <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5">
          <path d="m16 56 9 9 16-18" stroke="var(--decor-orange)" />
          <path d="m50 56 9 9 16-18" stroke="var(--decor-amber-deep)" />
          <path d="m84 56 9 9 16-18" stroke="var(--decor-ink)" />
        </g>
      ) : null}
      {variant === 'chart' ? (
        <g stroke="var(--decor-ink)" strokeWidth="2.5">
          <rect x="20" y="58" width="18" height="22" rx="4" fill="var(--decor-peach)" />
          <rect x="48" y="46" width="18" height="34" rx="4" fill="var(--decor-amber)" />
          <rect x="76" y="34" width="18" height="46" rx="4" fill="var(--decor-orange)" />
          <path d="M18 81h88" strokeLinecap="round" />
        </g>
      ) : null}
      {variant === 'lines' ? (
        <g strokeLinecap="round" strokeWidth="6">
          <path d="M18 42h64" stroke="var(--decor-orange)" />
          <path d="M18 58h88" stroke="var(--decor-peach-deep)" />
          <path d="M18 74h52" stroke="var(--decor-peach-deep)" />
        </g>
      ) : null}
    </svg>
  )
}

/** Tilted badge card with overlapping discs (brand take on a membership/ID card). */
export function NeoIdCard({ className, motion = 'none', depth, delay, style }: DecorProps) {
  return (
    <svg
      className={cn('decor-shape neo-id-card', className)}
      data-motion={motion}
      viewBox="0 0 228 148"
      aria-hidden="true"
      focusable="false"
      style={decorStyle(depth, delay, style)}
    >
      <rect x="10" y="12" width="214" height="132" rx="22" fill="var(--decor-ink)" />
      <rect x="2" y="2" width="214" height="132" rx="22" fill="var(--decor-orange)" stroke="var(--decor-ink)" strokeWidth="3" />
      <circle cx="58" cy="58" r="25" fill="#fff" stroke="var(--decor-ink)" strokeWidth="3" />
      <circle cx="78" cy="80" r="25" fill="#fff" stroke="var(--decor-ink)" strokeWidth="3" />
      <circle cx="100" cy="58" r="21" fill="var(--decor-amber)" stroke="var(--decor-ink)" strokeWidth="3" />
      <rect x="128" y="96" width="70" height="14" rx="7" fill="var(--decor-cream)" stroke="var(--decor-ink)" strokeWidth="3" />
      <rect x="150" y="34" width="48" height="10" rx="5" fill="var(--decor-orange-deep)" />
    </svg>
  )
}

/** White score card with an amber folder tab and an orange progress pill. */
export function NeoScoreCard({ className, motion = 'none', depth, delay, style }: DecorProps) {
  return (
    <svg
      className={cn('decor-shape neo-score-card', className)}
      data-motion={motion}
      viewBox="0 0 236 140"
      aria-hidden="true"
      focusable="false"
      style={decorStyle(depth, delay, style)}
    >
      <path d="M22 26V18a12 12 0 0 1 12-12h70a12 12 0 0 1 11 8l4 12Z" fill="var(--decor-amber)" stroke="var(--decor-ink)" strokeWidth="3" strokeLinejoin="round" />
      <rect x="10" y="32" width="222" height="104" rx="22" fill="var(--decor-ink)" />
      <rect x="2" y="24" width="222" height="104" rx="22" fill="#fff" stroke="var(--decor-ink)" strokeWidth="3" />
      <circle cx="48" cy="76" r="22" fill="var(--decor-peach)" stroke="var(--decor-ink)" strokeWidth="3" />
      <path d="m38 76 7 7 13-14" fill="none" stroke="var(--decor-ink)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="86" y="58" width="112" height="14" rx="7" fill="var(--decor-peach)" />
      <rect x="86" y="58" width="78" height="14" rx="7" fill="var(--decor-orange)" stroke="var(--decor-ink)" strokeWidth="2.5" />
      <rect x="86" y="84" width="64" height="10" rx="5" fill="var(--decor-peach-deep)" />
    </svg>
  )
}

/** Speech bubble with typing dots. */
export function NeoSpeechBubble({ className, motion = 'none', depth, delay, style }: DecorProps) {
  return (
    <svg
      className={cn('decor-shape neo-speech', className)}
      data-motion={motion}
      viewBox="0 0 120 100"
      aria-hidden="true"
      focusable="false"
      style={decorStyle(depth, delay, style)}
    >
      <path d="M22 8h82a14 14 0 0 1 14 14v40a14 14 0 0 1-14 14H52l-22 18 4-18H22A14 14 0 0 1 8 62V22A14 14 0 0 1 22 8Z" fill="var(--decor-ink)" />
      <path d="M16 2h82a14 14 0 0 1 14 14v40a14 14 0 0 1-14 14H46L24 88l4-18H16A14 14 0 0 1 2 56V16A14 14 0 0 1 16 2Z" fill="var(--decor-speech-fill, #fff)" stroke="var(--decor-ink)" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="36" cy="36" r="6" fill="var(--decor-orange)" />
      <circle cx="57" cy="36" r="6" fill="var(--decor-amber-deep)" />
      <circle cx="78" cy="36" r="6" fill="var(--decor-ink)" />
    </svg>
  )
}

/** Pointer cursor arrow, a playful "click here" accent. */
export function NeoCursor({ className, motion = 'none', depth, delay, style }: DecorProps) {
  return (
    <svg
      className={cn('decor-shape neo-cursor', className)}
      data-motion={motion}
      viewBox="0 0 48 52"
      aria-hidden="true"
      focusable="false"
      style={decorStyle(depth, delay, style)}
    >
      <path d="M8 7 42 21 27 26 20 41Z" fill="var(--decor-ink)" />
      <path d="M4 3 38 17 23 22 16 37Z" fill="var(--decor-cursor-fill, var(--decor-amber))" stroke="var(--decor-ink)" strokeWidth="2.6" strokeLinejoin="round" />
    </svg>
  )
}

const BURST_POINTS = Array.from({ length: 24 }, (_, index) => {
  const angle = (Math.PI * 2 * index) / 24 - Math.PI / 2
  const radius = index % 2 === 0 ? 47 : 40
  return `${(50 + radius * Math.cos(angle)).toFixed(2)},${(50 + radius * Math.sin(angle)).toFixed(2)}`
}).join(' ')

/** Starburst sticker with centred content (an icon or a one-word label). */
export function NeoBurst({ children, className, spin = false, style }: { children?: ReactNode; className?: string; spin?: boolean; style?: CSSProperties }) {
  return (
    <span className={cn('neo-burst', className)} data-spin={spin ? '' : undefined} style={style}>
      <svg className="neo-burst__shape" viewBox="0 0 104 104" aria-hidden="true" focusable="false">
        <polygon points={BURST_POINTS} transform="translate(4 4)" fill="var(--decor-ink)" />
        <polygon points={BURST_POINTS} fill="var(--decor-burst-fill, var(--decor-amber))" stroke="var(--decor-ink)" strokeWidth="2.4" strokeLinejoin="round" />
      </svg>
      {children ? <span className="neo-burst__content">{children}</span> : null}
    </span>
  )
}

/**
 * Text set on a slowly turning circle around a centre mark (React Bits "Circular Text" idea, written for
 * this codebase). Decorative: the same words must exist as real copy elsewhere in the section.
 */
export function CircularTextBadge({
  id,
  text,
  children,
  className,
  style,
}: {
  /** Unique per page; used for the SVG text path. */
  id: string
  text: string
  children?: ReactNode
  className?: string
  style?: CSSProperties
}) {
  const pathId = `circular-text-${id}`
  return (
    <span className={cn('circular-badge', className)} aria-hidden="true" style={style}>
      <svg className="circular-badge__ring" viewBox="0 0 120 120" focusable="false">
        <defs>
          <path id={pathId} d="M60 60m-44 0a44 44 0 1 1 88 0a44 44 0 1 1-88 0" />
        </defs>
        <text>
          <textPath href={`#${pathId}`} textLength="272" lengthAdjust="spacing">
            {text}
          </textPath>
        </text>
      </svg>
      {children ? <span className="circular-badge__center">{children}</span> : null}
    </span>
  )
}
