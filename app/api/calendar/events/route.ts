import { NextResponse } from 'next/server'
import { requireAccount } from '@/lib/auth/server'
import { loadCalendarEvents } from '@/lib/calendar/server'
export async function GET(request:Request){
  const account=await requireAccount(); const url=new URL(request.url)
  const start=url.searchParams.get('start')||new Date(Date.now()-31*86400000).toISOString(); const end=url.searchParams.get('end')||new Date(Date.now()+62*86400000).toISOString()
  if(!Number.isFinite(new Date(start).getTime())||!Number.isFinite(new Date(end).getTime())||new Date(end)<=new Date(start)) return NextResponse.json({error:'Rentang kalender tidak valid.'},{status:400})
  try{return NextResponse.json(await loadCalendarEvents(account,start,end))}catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Kalender belum dapat dimuat.'},{status:503})}
}
