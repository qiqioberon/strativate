import { DashboardClient } from './dashboard-client'

import { listOwnedDigitalProducts } from '@/lib/commerce/server'
import { isDigitalProductsEnabled } from '@/lib/features'

export default async function MenteeDashboard() {
  const digitalProductsEnabled = isDigitalProductsEnabled()
  const ownedDigitalProducts = digitalProductsEnabled ? await listOwnedDigitalProducts() : []
  return (
    <DashboardClient
      digitalProductsEnabled={digitalProductsEnabled}
      ownedDigitalProducts={ownedDigitalProducts}
    />
  )
}
