export function formError(error: unknown, fallback = 'Permintaan gagal. Periksa koneksi dan coba lagi.'): string {
  if (!error || typeof error !== 'object') return fallback
  const code = 'code' in error ? String(error.code) : ''
  const message = 'message' in error ? String(error.message) : ''
  if (code === '23505') return "Data sudah digunakan. Untuk nama pengguna, coba nama lain."
  if (code === "weak_password") return "Kata sandi belum memenuhi kebijakan keamanan. Gunakan kata sandi yang lebih kuat."
  if (code === "same_password") return "Kata sandi ini sudah digunakan. Masukkan kata sandi yang berbeda."
  if (code === 'invalid_credentials') return "Email atau kata sandi tidak sesuai."
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') return 'Terlalu banyak percobaan. Tunggu beberapa saat sebelum mencoba lagi.'
  if (code === '42501' || code === 'PGRST301') return 'Sesi atau izin tidak sesuai. Silakan masuk kembali.'
  if (code === '22023') {
    const messages: Record<string, string> = {
      'Enter a valid name and username': "Periksa nama dan format nama pengguna.",
      'Set your account password first': "Tetapkan kata sandi akun terlebih dahulu.",
      'Complete preceding steps first': 'Lengkapi langkah sebelumnya terlebih dahulu.',
      'Select an available institution': 'Pilih institusi yang tersedia atau ajukan institusi baru.',
      'Enter a valid cohort year': 'Masukkan tahun angkatan yang valid.',
      'Choose exactly one referral response': "Pilih satu sumber informasi atau isi Lainnya.",
      'Select an active referral source': "Opsi informasi sudah tidak aktif. Pilih opsi lain.",
      'Select active interests': 'Salah satu minat sudah tidak aktif. Pilih kembali minatmu.',
      'Select at least one interest': 'Pilih minimal satu minat dari daftar.',
      'Custom interests are not supported': 'Pilih minat dari daftar yang tersedia.',
      'Invitation is still being processed': 'Undangan masih diproses. Tunggu hingga pengiriman selesai.',
      'Invitation not found': 'Undangan sudah dihapus. Muat ulang daftar.',
      'Active accounts cannot be deleted through invitations': 'Akun sudah aktif. Akun tersebut tidak dapat dihapus melalui undangan.',
    }
    return messages[message] || 'Data belum valid. Periksa isian dan pilihanmu, lalu coba lagi.'
  }
  if (code === 'P0001' && message.startsWith('VALIDATION:')) return message.slice(11).trim()
  return fallback
}
