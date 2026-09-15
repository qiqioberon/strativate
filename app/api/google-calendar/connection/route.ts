import { NextResponse } from 'next/server'
import { requireAccount } from '@/lib/auth/server'
import { disconnectGoogleCalendar,getGoogleConnectionStatus } from '@/lib/google-calendar/server'
export async function GET(){const account=await requireAccount();return NextResponse.json(await getGoogleConnectionStatus(account.user.id))}
export async function DELETE(){const account=await requireAccount();await disconnectGoogleCalendar(account.user.id);return NextResponse.json({ok:true})}
