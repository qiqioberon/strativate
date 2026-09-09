import { HomeClient } from '@/components/home/home-client'
import { listPublicCatalog } from '@/lib/catalog/public'

export default async function Page() {
  const catalogProducts = await listPublicCatalog()
  return <HomeClient catalogProducts={catalogProducts} />
}
