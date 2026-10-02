export type OperationalProvider='calendar'|'meeting'

export function humanizeProviderError(provider:OperationalProvider,error:unknown){
  const raw=typeof error==='string'?error:error instanceof Error?error.message:''
  const value=raw.toLowerCase()

  if(provider==='calendar'){
    if(/token|refresh|unauthor|invalid_grant|disconnect|credential/.test(value))return'Koneksi Google Calendar sudah tidak valid. Hubungkan ulang kalender lalu coba sinkronkan lagi.'
    return'Google Calendar belum berhasil disinkronkan. Coba sinkronkan ulang beberapa saat lagi.'
  }

  return'Meeting belum berhasil diproses. Coba lagi beberapa saat kemudian.'
}

export function humanizeSyncStatus(value:string){
  if(value==='ready'||value==='synced')return'Siap'
  if(value==='creating'||value==='processing')return'Sedang diproses'
  if(value==='cancelled')return'Dibatalkan'
  if(value==='failed')return'Perlu perhatian'
  if(value==='unavailable')return'Tidak tersedia'
  return'Menunggu sinkronisasi'
}
