import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read=(path:string)=>readFileSync(path,'utf8')
const migrationPath='supabase/migrations/202610020002_admin_managed_zoom_rooms.sql'

test('managed Zoom rooms define reusable inventory with overlap-safe allocations',()=>{
 const sql=read(migrationPath)
 assert.match(sql,/create table public\.mentoring_zoom_rooms/)
 assert.match(sql,/create table public\.mentoring_zoom_room_allocations/)
 assert.match(sql,/mentoring_zoom_room_allocations_no_overlap/)
 assert.match(sql,/exclude using gist/)
 assert.match(sql,/reserve_mentoring_zoom_room/)
})

test('private and intensive scheduling share the managed Zoom room pool',()=>{
 const rooms=read('lib/zoom-rooms/server.ts')
 const privateScheduling=read('lib/private-mentoring/scheduling-server.ts')
 const intensiveScheduling=read('lib/intensive-mentoring/scheduling-server.ts')
 assert.match(rooms,/admin_get_mentoring_zoom_room_pool/)
 assert.match(privateScheduling,/getManagedZoomRoomPool/)
 assert.match(privateScheduling,/availableManagedZoomRooms/)
 assert.match(intensiveScheduling,/getManagedZoomRoomPool/)
 assert.match(intensiveScheduling,/availableManagedZoomRooms/)
})

test('admin manages fixed Zoom links and calendar reconciliation without Zoom API credentials',()=>{
 const route=read('app/api/admin/zoom-rooms/route.ts')
 const env=read('.env.example')
 assert.match(route,/admin_list_mentoring_zoom_rooms/)
 assert.match(route,/admin_upsert_mentoring_zoom_room/)
 assert.match(route,/reconcileManagedZoomRoomCalendars/)
 assert.doesNotMatch(env,/ZOOM_ACCOUNT_ID|ZOOM_CLIENT_ID|ZOOM_CLIENT_SECRET|ZOOM_WEBHOOK_SECRET_TOKEN/)
})
