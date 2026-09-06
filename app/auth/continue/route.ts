import { redirect } from 'next/navigation'
import { requireAccount } from '@/lib/auth/server'
export async function GET() {
  const account = await requireAccount()
  redirect(account.destination)
}
