import { DashboardClient } from './dashboard-client'

import { getActiveCart, listOwnedDigitalProducts, listUserOrders } from '@/lib/commerce/server'
import type { ActiveCart } from '@/lib/commerce/types'
import { isDigitalProductsEnabled } from '@/lib/features'

const emptyCart: ActiveCart = {
  id: '',
  items: [],
  totalAmount: 0,
  hasUnavailableItems: false,
  canCheckout: false,
}

export default async function MenteeDashboard() {
  const digitalProductsEnabled = isDigitalProductsEnabled()
  const [ownedDigitalProducts, cart, commerceOrders] = digitalProductsEnabled
    ? await Promise.all([listOwnedDigitalProducts(), getActiveCart(), listUserOrders()])
    : [[], emptyCart, []]

  return (
    <DashboardClient
      digitalProductsEnabled={digitalProductsEnabled}
      ownedDigitalProducts={ownedDigitalProducts}
      cart={cart}
      commerceOrders={commerceOrders}
    />
  )
}
