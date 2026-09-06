import { requireAccount } from '@/lib/auth/server'
export default async function CheckoutLayout({ children }: { children: React.ReactNode }) {
  await requireAccount('/dashboard')
  return children
}
