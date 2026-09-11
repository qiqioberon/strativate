import Image from 'next/image'

import { getAsset, type AssetKey } from '@/lib/content/asset-registry'
import { cn } from '@/lib/utils'

type AssetMediaProps = {
  assetKey: AssetKey
  className?: string
  sizes?: string
  priority?: boolean
  decorative?: boolean
}

export function AssetMedia({ assetKey, className, sizes = '100vw', priority = false, decorative = false }: AssetMediaProps) {
  const asset = getAsset(assetKey)

  return (
    <figure className={cn('asset-media', className)} data-asset-status={asset.status}>
      <Image
        src={asset.src}
        alt={decorative ? '' : asset.alt}
        fill
        sizes={sizes}
        priority={priority}
      />
      {asset.placeholder && !decorative && <figcaption>{asset.status === 'missing' ? 'Foto belum tersedia' : 'Aset belum tersedia'}</figcaption>}
    </figure>
  )
}
