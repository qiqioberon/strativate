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
          Sign in to purchase
        </Link>
        <p>{compact ? 'Sign in as a Mentee to purchase.' : 'Sign in as a Mentee with completed registration to add this product to your cart.'}</p>
      </div>
    )
  }

  if (purchaseMode === 'unavailable') {
    return (
      <div className={cn('digital-product-purchase-action', compact && 'digital-product-purchase-action--compact')}>
        <button className={buttonVariants({ variant: 'outline', size })} type="button" disabled>
          Purchases are available to Mentees only
        </button>
        {compact ? <p>This account is not eligible to purchase Digital Products.</p> : null}
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
      if (raw.includes('already in cart')) show({ variant: 'warning', message: 'This product is already in your cart.' })
      else if (raw.includes('already owned')) show({ variant: 'warning', message: 'You already own this product.' })
      else if (raw.includes('unavailable')) show({ variant: 'error', message: 'This product is currently unavailable for purchase.' })
      else if (raw.includes('completed mentee')) show({ variant: 'error', message: 'Complete your Mentee registration before purchasing.' })
      else show({ variant: 'error', message: 'The product could not be added to your cart. Please try again.' })
      setPending(false)
      return
    }

    show({ variant: 'success', message: 'Product added to your cart.' })
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
        {pending ? 'Adding…' : 'Add to cart'}
      </button>
    </div>
  )
}
