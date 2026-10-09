export type OperationalProvider='calendar'|'meeting'

export function humanizeProviderError(provider:OperationalProvider,error:unknown,language:'id'|'en'='id'){
  const raw=typeof error==='string'?error:error instanceof Error?error.message:''
  const value=raw.toLowerCase()

  if(provider==='calendar'){
    if(language==='en')return /token|refresh|unauthor|invalid_grant|disconnect|credential/.test(value)?'Google Calendar connection is no longer valid. Reconnect and sync again.':'Google Calendar could not be synced. Please try again shortly.'
    if(/token|refresh|unauthor|invalid_grant|disconnect|credential/.test(value))return'Koneksi Google Calendar sudah tidak valid. Hubungkan ulang kalender lalu coba sinkronkan lagi.'
    return'Google Calendar belum berhasil disinkronkan. Coba sinkronkan ulang beberapa saat lagi.'
  }

  return language==='en'?'The meeting could not be processed. Please try again shortly.':'Meeting belum berhasil diproses. Coba lagi beberapa saat kemudian.'
}

export function humanizeSyncStatus(value:string,language:'id'|'en'='id'){
  if(language==='en')return value==='ready'||value==='synced'?'Ready':value==='creating'||value==='processing'?'Processing':value==='cancelled'?'Cancelled':value==='failed'?'Needs attention':value==='unavailable'?'Unavailable':'Awaiting sync'
  if(value==='ready'||value==='synced')return'Siap'
  if(value==='creating'||value==='processing')return'Sedang diproses'
  if(value==='cancelled')return'Dibatalkan'
  if(value==='failed')return'Perlu perhatian'
  if(value==='unavailable')return'Tidak tersedia'
  return'Menunggu sinkronisasi'
}
