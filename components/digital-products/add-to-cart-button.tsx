'use client'

import { ArrowRight, ShoppingCart } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { buttonVariants } from '@/components/ui/button'
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
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [added, setAdded] = useState(false)
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
    setMessage(null)
    setAdded(false)

    const supabase = createClient()
    const { error } = await supabase.rpc('add_cart_item', { p_commerce_item_id: commerceItemId })

    if (error) {
      const raw = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase()
      if (raw.includes('already owned')) setMessage('Produk Digital ini sudah kamu miliki.')
      else if (raw.includes('unavailable')) setMessage('Produk ini sedang tidak tersedia untuk dibeli.')
      else if (raw.includes('completed mentee')) setMessage('Selesaikan pendaftaran Mentee sebelum melakukan pembelian.')
      else setMessage('Produk belum dapat ditambahkan ke keranjang. Coba lagi.')
      setPending(false)
      return
    }

    setMessage('Produk ditambahkan ke keranjang.')
    setAdded(true)
    setPending(false)
    router.refresh()
  }

  return (
    <div
      className={cn('digital-product-purchase-action', compact && 'digital-product-purchase-action--compact')}
      aria-live="polite"
    >
      <button
        className={buttonVariants({ variant: 'primary', size })}
        type="button"
        disabled={pending}
        onClick={addToCart}
      >
        <ShoppingCart aria-hidden="true" size={17} />
        {pending ? 'Menambahkan…' : 'Tambahkan ke Keranjang'}
      </button>
      {message ? <p role="status" className={added ? 'is-success' : undefined}>{message}</p> : null}
      {added ? (
        <Link className="digital-product-inline-cart-link" href="/cart">
          Lihat keranjang <ArrowRight aria-hidden="true" size={14} />
        </Link>
      ) : null}
    </div>
  )
}
