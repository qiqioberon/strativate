/* eslint-disable @next/next/no-img-element */

import { getAsset } from '@/lib/content/asset-registry'
import type { PublicMentor } from '@/lib/mentor/public-profile-types'
import { cn } from '@/lib/utils'

import { AssetMedia } from './asset-media'

type MentorPortraitMediaProps = {
  mentor: PublicMentor
  className?: string
  sizes?: string
  priority?: boolean
}

export function MentorPortraitMedia({ mentor, className, sizes, priority = false }: MentorPortraitMediaProps) {
  if (mentor.portraitUrl) {
    return (
      <figure className={cn('asset-media', className)} data-asset-status="ready">
        <img
          src={mentor.portraitUrl}
          alt={mentor.name}
          loading={priority ? 'eager' : 'lazy'}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </figure>
    )
  }

  if (mentor.portrait) {
    return <AssetMedia assetKey={mentor.portrait} className={className} sizes={sizes} priority={priority} />
  }

  const fallback = getAsset('brand.logo.mark')
  return (
    <figure className={cn('asset-media', className)} data-asset-status="missing">
      <img
        src={fallback.src}
        alt={`Foto ${mentor.name} belum tersedia`}
        style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '18%' }}
      />
      <figcaption>Foto belum tersedia</figcaption>
    </figure>
  )
}
