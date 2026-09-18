import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AuthShell } from '@/components/auth/auth-shell'
import { getAccount } from '@/lib/auth/server'
import { getGoogleConnectionStatus } from '@/lib/google-calendar/server'

export default async function CalendarOnboardingPage({searchParams}:{searchParams:Promise<{calendar?:string;reason?:string}>}){
 const account=await getAccount()
 if(!account)redirect('/auth')
 if(account.profile.role!=='mentee')redirect(account.destination)
 if(!account.mentee?.onboarding_completed_at)redirect('/onboarding')
 const params=await searchParams
 const connection=await getGoogleConnectionStatus(account.user.id)
 return <AuthShell>
  <div className="auth-heading">
   <p className="kicker">Setup opsional</p>
   <h1>Hubungkan Google Calendar<em>.</em></h1>
   <p>Strativate memakai Calendar untuk melihat konflik jadwal dan menampilkan sesi mentoring. Izin ini tidak wajib untuk menyelesaikan pendaftaran.</p>
  </div>
  {params.calendar==='denied'?<p className="form-error" role="status">Izin Calendar tidak diberikan. Akunmu tetap aktif dan kamu bisa menghubungkannya nanti dari dashboard.</p>:null}
  {connection.connected?<p role="status">Google Calendar terhubung sebagai <strong>{connection.accountEmail}</strong>.</p>:null}
  <div className="button-row">
   {connection.connected?<Link className="button button-primary" href="/auth/continue">Lanjut ke Dashboard</Link>:<>
    <a className="button button-primary" href="/api/google-calendar/connect?returnTo=/onboarding/calendar">Hubungkan Google Calendar</a>
    <Link className="button button-outline" href="/auth/continue">Lewati sekarang</Link>
   </>}
  </div>
 </AuthShell>
}
