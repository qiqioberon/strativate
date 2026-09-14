'use client'

import { ShoppingCart } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { buttonVariants } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

export function AddToCartButton({
  commerceItemId,
  purchaseMode,
}: {
  commerceItemId: string
  purchaseMode: 'anonymous' | 'mentee' | 'unavailable'
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  if (purchaseMode === 'anonymous') {
    return (
      <div className="digital-product-purchase-action">
        <Link className={buttonVariants({ variant: 'primary', size: 'marketing' })} href="/auth">
          Masuk untuk membeli
        </Link>
        <p>Masuk sebagai Mentee yang sudah menyelesaikan pendaftaran untuk menambahkan produk ke keranjang.</p>
      </div>
    )
  }

  if (purchaseMode === 'unavailable') {
    return (
      <div className="digital-product-purchase-action">
        <button className={cn(buttonVariants({ variant: 'outline', size: 'marketing' }))} type="button" disabled>
          Pembelian hanya untuk Mentee
        </button>
      </div>
    )
  }

  async function addToCart() {
    if (pending) return
    setPending(true)
    setMessage(null)

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
    setPending(false)
    router.refresh()
  }

  return (
    <div className="digital-product-purchase-action" aria-live="polite">
      <button
        className={buttonVariants({ variant: 'primary', size: 'marketing' })}
        type="button"
        disabled={pending}
        onClick={addToCart}
      >
        <ShoppingCart aria-hidden="true" size={17} />
        {pending ? 'Menambahkan…' : 'Tambahkan ke Keranjang'}
      </button>
      {message ? <p role="status">{message}</p> : null}
    </div>
  )
}
