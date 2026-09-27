'use client'

import { useEffect, useRef, useState } from 'react'

import { WHO_WE_ARE_PHOTO_TARGETS } from '@/lib/marketing/who-we-are-photo-config'
import type { HomepageWhoWeArePhotoView } from '@/lib/marketing/who-we-are-photos'

export function WhoWeArePhoto({ photo }: { photo: HomepageWhoWeArePhotoView }) {
  const [failed, setFailed] = useState(false)
  const imageRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const image = imageRef.current
    if (image?.complete && image.naturalWidth === 0) setFailed(true)
  }, [])

  if (failed) return null

  const target = WHO_WE_ARE_PHOTO_TARGETS[photo.role]
  return (
    <figure className={`homepage-who__frame homepage-who__${photo.role}`} data-role={photo.role}>
      {/* Supabase owns these admin-uploaded public assets, so native images accept the configured project hostname. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imageRef}
        src={photo.imageUrl}
        alt={photo.alt_text}
        width={target.width}
        height={target.height}
        loading="lazy"
        onError={() => setFailed(true)}
      />
      {photo.badge_text ? <figcaption>{photo.badge_text}</figcaption> : null}
    </figure>
  )
}
