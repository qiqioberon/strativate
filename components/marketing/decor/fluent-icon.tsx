import Image from 'next/image'

import { getAsset } from '@/lib/content/asset-registry'
import { cn } from '@/lib/utils'

// Microsoft Fluent Emoji 3D (MIT, see THIRD_PARTY_NOTICES.md). Used instead of OS emoji so badges look the
// same on every platform and share the soft 3D language of the brand ornaments.
export const fluentIcons = [
  'trophy',
  'medal-1st',
  'medal-2nd',
  'medal-3rd',
  'medal-sports',
  'graduation-cap',
  'briefcase',
  'page',
  'bookmark-tabs',
  'clapper',
  'puzzle',
  'speech',
  'question',
  'bullseye',
  'rocket',
  'sparkles',
  'light-bulb',
  'books',
  'calendar',
  'chart',
] as const

export type FluentIconName = (typeof fluentIcons)[number]

export function FluentIcon({
  name,
  size = 24,
  className,
  label,
}: {
  name: FluentIconName
  /** Rendered CSS pixel size; the source files are 160px so anything up to 80px stays crisp on 2x screens. */
  size?: number
  className?: string
  /** Leave empty for decorative use next to visible text (the default). */
  label?: string
}) {
  return (
    <Image
      className={cn('fluent-icon', className)}
      src={getAsset(`decor.icon.${name}`).src}
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      width={size}
      height={size}
      draggable={false}
      loading="lazy"
    />
  )
}
