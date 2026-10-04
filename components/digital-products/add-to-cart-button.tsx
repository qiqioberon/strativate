'use client'

import { CreditCard, ShoppingCart } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

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
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const primaryRef = useRef<HTMLButtonElement>(null)
  const size = compact ? 'sm' as const : 'marketing' as const

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (activeOrderId && !dialog.open) {
      dialog.showModal()
      primaryRef.current?.focus()
    } else if (!activeOrderId && dialog.open) {
      dialog.close()
    }
  }, [activeOrderId])

  useEffect(() => () => {
    const dialog = dialogRef.current
    if (dialog?.open) dialog.close()
  }, [])

  if (purchaseMode === 'anonymous') {
    return (
      <div className={cn('digital-product-purchase-action', compact && 'digital-product-purchase-action--compact')}>
        <Link className={buttonVariants({ variant: 'primary', size })} href="/auth">
          <ShoppingCart aria-hidden="true" size={17} />
          Add to cart
        </Link>
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

  async function lookupActiveOrder() {
    const supabase = createClient()
    const { data } = await supabase.rpc('get_active_digital_product_order', {
      p_commerce_item_id: commerceItemId,
    })
    return data ?? null
  }

  async function addToCart() {
    if (pending) return
    setPending(true)

    const existingOrderId = await lookupActiveOrder()
    if (existingOrderId) {
      setActiveOrderId(existingOrderId)
      setPending(false)
      return
    }

    const supabase = createClient()
    const { error } = await supabase.rpc('add_cart_item', { p_commerce_item_id: commerceItemId })

    if (error) {
      const raw = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase()
      if (raw.includes('active payment')) {
        const racedOrderId = await lookupActiveOrder()
        if (racedOrderId) setActiveOrderId(racedOrderId)
        else show({ variant: 'warning', message: 'This product already has an active payment.' })
      } else if (raw.includes('already in cart')) show({ variant: 'warning', message: 'This product is already in your cart.' })
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

  function returnToPayment() {
    if (!activeOrderId) return
    const orderId = activeOrderId
    setActiveOrderId(null)
    router.push(`/checkout?order=${encodeURIComponent(orderId)}`)
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

      <dialog
        ref={dialogRef}
        className="digital-product-active-payment-dialog"
        aria-modal="true"
        aria-labelledby={`active-payment-title-${commerceItemId}`}
        aria-describedby={`active-payment-description-${commerceItemId}`}
        onCancel={event => {
          event.preventDefault()
          setActiveOrderId(null)
        }}
        onClose={() => setActiveOrderId(null)}
      >
        <div className="digital-product-active-payment-dialog__surface">
          <span className="digital-product-active-payment-dialog__icon" aria-hidden="true">
            <CreditCard size={22} />
          </span>
          <div>
            <h2 id={`active-payment-title-${commerceItemId}`}>Pembayaran masih aktif</h2>
            <p id={`active-payment-description-${commerceItemId}`}>
              Produk ini masih memiliki pembayaran aktif. Apakah Anda ingin kembali ke halaman pembayaran?
            </p>
          </div>
          <div className="digital-product-active-payment-dialog__actions">
            <button
              ref={primaryRef}
              className={buttonVariants({ variant: 'primary', size: 'sm' })}
              type="button"
              onClick={returnToPayment}
            >
              Ya
            </button>
            <button
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
              type="button"
              onClick={() => setActiveOrderId(null)}
            >
              Tidak
            </button>
          </div>
        </div>
      </dialog>
    </div>
  )
}
