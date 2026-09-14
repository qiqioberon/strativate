'use server'

import { redirect } from 'next/navigation'

import { requireAccount } from '@/lib/auth/server'
import { createOrderFromCart, getActiveCart } from '@/lib/commerce/server'
import { isDigitalProductsEnabled } from '@/lib/features'

export async function checkoutActiveCart() {
  if (!isDigitalProductsEnabled()) redirect('/dashboard')

  await requireAccount('/dashboard')
  const cart = await getActiveCart()
  if (!cart.canCheckout) redirect('/cart')

  const order = await createOrderFromCart(cart.id)
  redirect(`/checkout?order=${encodeURIComponent(order.id)}`)
}
