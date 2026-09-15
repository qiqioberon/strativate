import { NextResponse } from 'next/server'
import { requireAccount } from '@/lib/auth/server'
import { beginGoogleCalendarOAuth } from '@/lib/google-calendar/server'
export async function GET(request:Request){const account=await requireAccount();try{const url=new URL(request.url);return NextResponse.redirect(await beginGoogleCalendarOAuth(account.user.id,account.profile.role,url.searchParams.get('returnTo')))}catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Google Calendar belum dapat dihubungkan.'},{status:503})}}
