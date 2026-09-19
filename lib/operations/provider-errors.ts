export type OperationalProvider='zoom'|'calendar'|'recording'|'meeting'

export function humanizeProviderError(provider:OperationalProvider,error:unknown){
  const raw=typeof error==='string'?error:error instanceof Error?error.message:''
  const value=raw.toLowerCase()

  if(provider==='zoom'){
    if(/not configured|missing:|account_id|client secret|oauth/.test(value))return'Konfigurasi Zoom belum tersedia atau belum lengkap. Periksa konfigurasi server sebelum mencoba lagi.'
    if(/record|cloud/.test(value))return'Cloud recording Zoom tidak tersedia untuk host/account ini. Meeting tetap dapat digunakan bila pembuatan Zoom berhasil.'
    if(/404|3001|does not exist|not found/.test(value))return'Zoom meeting sudah tidak ditemukan. Sinkronkan ulang sesi untuk memperbarui status.'
    if(/license|licensed|user does not exist|host/.test(value))return'Host Zoom belum memenuhi capability account yang dibutuhkan. Periksa user host dan lisensi Zoom.'
    return'Zoom meeting belum berhasil diproses. Coba sinkronkan ulang beberapa saat lagi.'
  }

  if(provider==='calendar'){
    if(/token|refresh|unauthor|invalid_grant|disconnect|credential/.test(value))return'Koneksi Google Calendar sudah tidak valid. Hubungkan ulang kalender lalu coba sinkronkan lagi.'
    return'Google Calendar belum berhasil disinkronkan. Coba sinkronkan ulang beberapa saat lagi.'
  }

  if(provider==='recording'){
    if(/record|cloud|license|disabled|unavailable/.test(value))return'Automatic cloud recording Zoom tidak tersedia untuk host/account ini.'
    return'Status recording Zoom memerlukan perhatian. Periksa kembali setelah meeting diproses.'
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
