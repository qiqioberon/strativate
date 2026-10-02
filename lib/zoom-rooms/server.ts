import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { syncPrivateMentoringSession } from '@/lib/google-calendar/server'
import { syncIntensiveMentoringSession } from '@/lib/intensive-mentoring/calendar-server'

export type ManagedZoomRoomOption = {
  id: string
  name: string
  meetingUrl: string
  sortOrder: number
}

export type ManagedZoomRoomPoolEntry = ManagedZoomRoomOption & {
  busy: Array<{ start: string; end: string }>
}

type RpcClient = {
  rpc<T = unknown>(name: string, args?: Record<string, unknown>): Promise<{ data: T | null; error: { message: string } | null }>
}

export async function getManagedZoomRoomPool({
  from,
  to,
  sessionId,
  mentoringKind,
}: {
  from: string
  to: string
  sessionId: string
  mentoringKind: 'private' | 'intensive'
}) {
  const supabase = await createClient()
  const rpc = supabase as unknown as RpcClient
  const { data, error } = await rpc.rpc<ManagedZoomRoomPoolEntry[]>('admin_get_mentoring_zoom_room_pool', {
    p_from: from,
    p_to: to,
    p_private_session_id: mentoringKind === 'private' ? sessionId : null,
    p_intensive_session_id: mentoringKind === 'intensive' ? sessionId : null,
  })
  if (error) throw new Error(error.message)
  return data ?? []
}

export function availableManagedZoomRooms(
  rooms: readonly ManagedZoomRoomPoolEntry[],
  start: string,
  end: string,
): ManagedZoomRoomOption[] {
  const startMs = new Date(start).getTime()
  const endMs = new Date(end).getTime()
  return rooms
    .filter(room => !room.busy.some(interval => startMs < new Date(interval.end).getTime() && endMs > new Date(interval.start).getTime()))
    .map(({ id, name, meetingUrl, sortOrder }) => ({ id, name, meetingUrl, sortOrder }))
}

export async function reconcileManagedZoomRoomCalendars(roomId: string, adminId: string) {
  const admin = createAdminClient() as any
  const { data, error } = await admin
    .from('mentoring_zoom_room_allocations')
    .select('private_session_id,intensive_session_id')
    .eq('zoom_room_id', roomId)
    .is('released_at', null)
    .gt('ends_at', new Date().toISOString())
  if (error) throw new Error('Sesi yang menggunakan Zoom room belum dapat dimuat.')

  const results = await Promise.allSettled((data ?? []).map((allocation: { private_session_id: string | null; intensive_session_id: string | null }) => {
    if (allocation.private_session_id) return syncPrivateMentoringSession(allocation.private_session_id, adminId)
    if (allocation.intensive_session_id) return syncIntensiveMentoringSession(allocation.intensive_session_id, adminId)
    return Promise.resolve(null)
  }))
  return results.filter(result => result.status === 'rejected' || result.value?.status === 'failed').length
}
