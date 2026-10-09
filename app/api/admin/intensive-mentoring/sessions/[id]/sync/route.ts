import { adminFormError } from '@/lib/auth/errors'
import {NextResponse} from 'next/server'
import {requireAccount} from '@/lib/auth/server'
import {syncIntensiveMentoringSession} from '@/lib/intensive-mentoring/calendar-server'
export async function POST(_request:Request,{params}:{params:Promise<{id:string}>}){const account=await requireAccount();if(account.profile.role!=='admin')return NextResponse.json({error:'Forbidden'},{status:403});const{id}=await params;try{const calendar=await syncIntensiveMentoringSession(id,account.user.id);return NextResponse.json({...calendar,...('error' in calendar&&calendar.error?{error:adminFormError({message:calendar.error},'Google Calendar could not be synced. Reconnect and try again.')}: {})},{status:calendar.status==='failed'?409:200})}catch(error){return NextResponse.json({error:adminFormError(error,'Unable to sync Google Calendar.')},{status:400})}}
