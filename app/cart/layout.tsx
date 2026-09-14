import './cart.css'

import { requireAccount } from '@/lib/auth/server'

export default async function CartLayout({ children }: { children: React.ReactNode }) {
  await requireAccount('/dashboard')
  return children
}
