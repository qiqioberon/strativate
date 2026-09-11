import Image from 'next/image'

import { getAsset } from '@/lib/content/asset-registry'
import { cn } from '@/lib/utils'

type BrandLogoProps = { variant?: 'wordmark' | 'mark'; className?: string; priority?: boolean }

export function BrandLogo({ variant = 'wordmark', className, priority = false }: BrandLogoProps) {
  const asset = getAsset(variant === 'mark' ? 'brand.logo.mark' : 'brand.logo.primary')
  const dimensions = variant === 'mark' ? { width: 471, height: 512 } : { width: 720, height: 132 }
  return <Image className={cn('brand-logo', className)} src={asset.src} alt={asset.alt} priority={priority} {...dimensions} />
}
