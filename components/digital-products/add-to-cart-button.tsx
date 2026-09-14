'use client'

import { ShoppingCart } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { buttonVariants } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast-provider'
import type { DigitalPurchaseMode } from '@/lib/commerce/purchase-mode'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

export function AddToCartButton({
  commerceItemId,
  purchaseMode,
  compact = false,
}: {
  commerceItemId: string
  purchaseMode: DigitalPurchaseMode
  compact?: boolean
}) {
  const router = useRouter()
  const { show } = useToast()
  const [pending, setPending] = useState(false)
  const size = compact ? 'sm' as const : 'marketing' as const

  if (purchaseMode === 'anonymous') {
    return (
      <div className={cn('digital-product-purchase-action', compact && 'digital-product-purchase-action--compact')}>
        <Link className={buttonVariants({ variant: 'primary', size })} href="/auth">
          Masuk untuk membeli
        </Link>
        <p>{compact ? 'Masuk sebagai Mentee untuk membeli.' : 'Masuk sebagai Mentee yang sudah menyelesaikan pendaftaran untuk menambahkan produk ke keranjang.'}</p>
      </div>
    )
  }

  if (purchaseMode === 'unavailable') {
    return (
      <div className={cn('digital-product-purchase-action', compact && 'digital-product-purchase-action--compact')}>
        <button className={buttonVariants({ variant: 'outline', size })} type="button" disabled>
          Pembelian hanya untuk Mentee
        </button>
        {compact ? <p>Akun ini tidak memenuhi syarat pembelian Produk Digital.</p> : null}
      </div>
    )
  }

  async function addToCart() {
    if (pending) return
    setPending(true)

    const supabase = createClient()
    const { error } = await supabase.rpc('add_cart_item', { p_commerce_item_id: commerceItemId })

    if (error) {
      const raw = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase()
      if (raw.includes('already in cart')) show({ variant: 'warning', message: 'Produk ini sudah ada di keranjang Anda.' })
      else if (raw.includes('already owned')) show({ variant: 'warning', message: 'Anda sudah memiliki produk ini.' })
      else if (raw.includes('unavailable')) show({ variant: 'error', message: 'Produk ini sedang tidak tersedia untuk dibeli.' })
      else if (raw.includes('completed mentee')) show({ variant: 'error', message: 'Selesaikan pendaftaran Mentee sebelum melakukan pembelian.' })
      else show({ variant: 'error', message: 'Produk belum dapat ditambahkan ke keranjang. Coba lagi.' })
      setPending(false)
      return
    }

    show({ variant: 'success', message: 'Produk berhasil ditambahkan ke keranjang.' })
    setPending(false)
    router.refresh()
  }

  return (
    <div className={cn('digital-product-purchase-action', compact && 'digital-product-purchase-action--compact')}>
      <button
        className={buttonVariants({ variant: 'primary', size })}
        type="button"
        disabled={pending}
        onClick={addToCart}
      >
        <ShoppingCart aria-hidden="true" size={17} />
        {pending ? 'Menambahkan…' : 'Tambahkan ke Keranjang'}
      </button>
    </div>
  )
}
