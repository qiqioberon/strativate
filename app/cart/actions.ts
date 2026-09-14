'use server'

import { revalidatePath } from 'next/cache'
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

  // create_order_from_cart converts the authoritative cart in PostgreSQL. Invalidate
  // both entry points before redirecting so a browser Back/navigation does not reuse
  // the pre-conversion RSC payload.
  revalidatePath('/cart')
  revalidatePath('/dashboard')
  redirect(`/checkout?order=${encodeURIComponent(order.id)}`)
}
