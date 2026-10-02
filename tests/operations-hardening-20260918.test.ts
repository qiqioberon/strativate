import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read=(path:string)=>readFileSync(path,'utf8')

test('managed Zoom rooms replace API provisioning in mentoring operations',()=>{
 const source=read('lib/zoom-rooms/server.ts')
 const migration=read('supabase/migrations/202610020002_admin_managed_zoom_rooms.sql')
 assert.match(source,/admin_get_mentoring_zoom_room_pool/)
 assert.match(source,/reconcileManagedZoomRoomCalendars/)
 assert.match(migration,/create table public\.mentoring_zoom_rooms/)
 assert.match(migration,/mentoring_zoom_room_allocations_no_overlap/)
})

test('Google Calendar creates events without conferencing and preserves the Zoom provider URL',()=>{
 const sync=read('lib/google-calendar/sync.ts')
 const server=read('lib/google-calendar/server.ts')
 assert.match(sync,/createEvent:\s*!input\.eventId/)
 assert.doesNotMatch(sync,/createConference|conferenceData/)
 assert.match(server,/if \(input\.createEvent\)/)
 assert.doesNotMatch(server,/createConference|conferenceData|hangoutLink|hangoutsMeet/)
 assert.match(server,/const persistedProviderMeetingUrl = context\.providerMeetingUrl/)
 assert.match(server,/Meeting:/)
})

test('checkout pending UI and payment bounded reconciliation are implemented',()=>{
 const cart=read('components/commerce/cart-view.tsx')
 const payment=read('components/commerce/midtrans-embed.tsx')
 assert.match(cart,/useFormStatus/)
 assert.match(cart,/Menyiapkan checkout…/)
 assert.match(cart,/disabled=\{pending\}/)
 assert.match(payment,/visibilitychange/)
 assert.match(payment,/2500,\s*4000,\s*6500,\s*10000,\s*15000,\s*20000/)
 assert.match(payment,/Sinkronkan status/)
 assert.match(payment,/reconciling\.current/)
})

test('notification UI is database-backed while realtime transport is centralized',()=>{
 const source=read('components/dashboard/dashboard-topbar-actions.tsx')
 const provider=read('components/realtime/operational-realtime-provider.tsx')
 assert.match(source,/from\('notifications'\)/)
 assert.doesNotMatch(source,/postgres_changes|\.channel\(/)
 assert.match(source,/mark_notification_read/)
 assert.match(source,/mark_all_notifications_read/)
 assert.match(source,/strativate:notifications-changed/)
 assert.match(provider,/postgres_changes/)
 assert.match(provider,/table:\s*["']notifications["']/)
 assert.match(provider,/strativate:notifications-changed/)
 assert.doesNotMatch(source,/notificationTemplates/)
})

test('migration enforces competition, owned digital products, reversible completion, notification RLS, and stable colors',()=>{
 const sql=read('supabase/migrations/202609180001_checkout_notifications_zoom_operations.sql').toLowerCase()
 for(const token of [
  'competition_name',
  'private_mentoring_competition_schedule_guard',
  'guard_owned_digital_product_cart_link_item',
  'private_mentoring_session_status_events',
  "p_status not in ('completed','scheduled')",
  'notifications_read_own',
  'notifications_dedupe_idx',
  'supabase_realtime',
  'calendar_color',
  'meeting_provider',
  'provider_meeting_id',
  'recording_status',
 ]) assert.ok(sql.includes(token.toLowerCase()),token+' must exist')
 assert.equal(sql.includes('alter table public.profiles alter column calendar_color set default'),false)
})

test('Cart Link UI is one autocomplete and ownership-aware categorized picker',()=>{
 const source=read('components/admin/commerce-cart-link-management.tsx')
 assert.match(source,/role="combobox"/)
 assert.match(source,/ArrowDown/)
 assert.match(source,/ArrowUp/)
 assert.match(source,/list_admin_cart_link_items/)
 assert.match(source,/Sudah dimiliki/)
 assert.match(source,/Produk Digital/)
 assert.match(source,/Private Mentoring/)
 assert.match(source,/Intensive Mentoring/)
})

test('mentoring operations require confirmation and expose undo without alternate meeting storage',()=>{
 const admin=read('components/admin/private-mentoring-session-operations.tsx')
 const user=read('components/dashboard/private-mentoring-sessions.tsx')
 assert.match(admin,/Konfirmasi selesai/)
 assert.match(admin,/Batalkan tanda selesai/)
 assert.match(admin,/providerMeetingId/)
 assert.match(admin,/manualMeetingUrl/)
 assert.match(admin,/recordingStatus/)
 assert.match(user,/Mentoring Saya/)
 assert.match(user,/Competition \/ bidang lomba/)
 assert.match(user,/Join Zoom/)
})

test('first-time Calendar onboarding is optional and preserves dashboard reconnect path',()=>{
 const onboarding=read('app/onboarding/calendar/page.tsx')
 const experience=read('components/onboarding/experience.tsx')
 const callback=read('app/api/google-calendar/callback/route.ts')
 assert.match(experience,/\/onboarding\/calendar/)
 assert.match(onboarding,/Lewati, lanjut ke ringkasan/)
 assert.match(onboarding,/Hubungkan Google Calendar/)
 assert.match(onboarding,/href="\/onboarding\/review"/)
 assert.match(callback,/googleCalendarOAuthReturnPath/)
})
