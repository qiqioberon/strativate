const adminValidationMessages: Record<string, string> = {
  'Enter a valid name and username': 'Check your name and username.',
  'Set your account password first': 'Set your account password first.',
  'Complete preceding steps first': 'Complete the preceding steps first.',
  'Select an available institution': 'Select an available institution or request a new one.',
  'Enter a valid cohort year': 'Enter a valid cohort year.',
  'Choose exactly one referral response': 'Select one referral source or enter another source.',
  'Select an active referral source': 'This referral source is no longer active. Select another one.',
  'Select active interests': 'An interest is no longer active. Select the interests again.',
  'Select at least one interest': 'Select at least one interest.',
  'Custom interests are not supported': 'Select an interest from the available list.',
  'Invitation is still being processed': 'The invitation is still being sent. Wait until it finishes.',
  'Invitation not found': 'The invitation was removed. Refresh the list.',
  'Active accounts cannot be deleted through invitations': 'This account is active and cannot be deleted through invitations.',
  'Session count must be 1-20': 'Choose between 1 and 20 sessions.',
  'No exact active package combination is available for this tier': 'No active package combination is available for this tier and session count.',
  'Mentee not found': 'This mentee is no longer available. Refresh the list.',
  'Invalid Private Mentoring mode': 'Select a valid Private Mentoring purchase type.',
  'Target enrollment does not belong to this mentee': 'Select an enrollment belonging to this mentee.',
  'Complete the enrollment competition names before creating a top-up': 'Add competition names to the enrollment before creating a top-up.',
  'Top-up would exceed the 100-session enrollment limit': 'This top-up would exceed the enrollment limit of 100 sessions.',
  'At least one competition name is required': 'Enter at least one competition name.',
  'Choose at least one Cart Link item': 'Select at least one item for the Cart Link.',
  'Nama, deskripsi, dan urutan wajib valid.': 'Enter a valid name, description, and sort order.',
  'Nama dan urutan wajib valid.': 'Enter a valid name and sort order.',
  'Nama belum menghasilkan identifier yang valid.': 'Use a name that produces a valid identifier.',
  'Nama menghasilkan identifier yang sudah digunakan.': 'This name produces an identifier already in use. Choose another name.',
  'Learning Path tidak ditemukan.': 'The learning path is no longer available. Refresh the list.',
  'Session Topic tidak ditemukan.': 'The session topic is no longer available. Refresh the list.',
  'Competition Category tidak ditemukan.': 'The competition category is no longer available. Refresh the list.',
  'Master table tidak didukung.': 'This catalog is not supported.',
  'Format fitur paket tidak valid.': 'Check the package features.',
  'Format fitur Add-On tidak valid.': 'Check the add-on features.',
  'Format isi bundle tidak valid.': 'Check the bundle items.',
  'Paket Intensive Mentoring tidak ditemukan.': 'The Intensive Mentoring package is no longer available. Refresh the list.',
  'Add-On Intensive Mentoring tidak ditemukan.': 'The Intensive Mentoring add-on is no longer available. Refresh the list.',
  'Bundle Intensive Mentoring tidak ditemukan.': 'The Intensive Mentoring bundle is no longer available. Refresh the list.',
  'Paket bundle tidak ditemukan.': 'A package in this bundle is no longer available.',
  'Add-On bundle tidak ditemukan.': 'An add-on in this bundle is no longer available.',
  'Bundle aktif hanya boleh merujuk paket aktif.': 'Active bundles can include only active packages.',
  'Bundle aktif hanya boleh merujuk Add-On aktif.': 'Active bundles can include only active add-ons.',
  'Benefit teks bundle tidak boleh kosong.': 'Enter text for each bundle benefit.',
  'Jenis item bundle tidak didukung.': 'Select a supported bundle item type.',
  'Competition / bidang lomba wajib diisi (2-300 karakter)': 'Enter a competition or competition field using 2–300 characters.',
  'Competition / bidang lomba must be 2-300 characters': 'Use 2–300 characters for the competition or competition field.',
  'Competition / bidang lomba wajib dilengkapi sebelum scheduling': 'Complete the competition or competition field before scheduling.',
  'Nama Zoom room wajib 2-120 karakter': 'Use 2–120 characters for the Zoom room name.',
  'Zoom URL harus menggunakan HTTPS': 'Use an HTTPS Zoom URL.',
  'Urutan Zoom room tidak valid': 'Enter a valid Zoom room sort order.',
  'Zoom room tidak ditemukan': 'The Zoom room is no longer available. Refresh the list.',
  'Zoom room masih digunakan sesi aktif atau mendatang. Ganti room sesi terkait sebelum menonaktifkan.': 'This Zoom room has active or upcoming sessions. Assign those sessions to another room before deactivating it.',
  'Zoom room memiliki riwayat sesi dan tidak dapat dihapus. Nonaktifkan room ini.': 'This Zoom room has session history and cannot be deleted. Deactivate it instead.',
  'Rentang ketersediaan Zoom room tidak valid': 'Choose a valid Zoom room availability range.',
  'Jadwal sesi tidak valid': 'Choose a valid session schedule.',
  'Zoom room tidak aktif atau tidak ditemukan': 'Select an active, available Zoom room.',
  'Zoom room baru saja dipakai sesi lain. Muat ulang dan pilih room lain.': 'Another session has just reserved this Zoom room. Refresh and select another room.',
  'Semua Zoom room sedang terpakai pada jam ini. Muat ulang pilihan jadwal.': 'All Zoom rooms are reserved at this time. Refresh the schedule options.',
  'Jenis mentoring tidak valid': 'Select a valid mentoring type.',
  'Sesi mentoring tidak ditemukan': 'This mentoring session is no longer available. Refresh the list.',
  'Hanya sesi terjadwal yang dapat mengganti Zoom room': 'Only scheduled sessions can change Zoom rooms.',
  'This slot is no longer available. Refresh the schedule options.': 'This slot is no longer available. Refresh the schedule options.',
  'Private Mentoring session not found': 'This Private Mentoring session is no longer available. Refresh the list.',
  'Intensive session not found': 'This Intensive Mentoring session is no longer available. Refresh the list.',
  'This item is used by a bundle. Deactivate it or update the bundle first.': 'This item is used by a bundle. Deactivate it or update the bundle first.',
}

/** Admin presentation only; authentication codes and other roles retain their behavior. */
export function adminFormError(error: unknown, fallback = 'The request failed. Check your connection and try again.'): string {
  if (!error || typeof error !== 'object') return fallback
  const code = 'code' in error ? String(error.code) : ''
  const message = 'message' in error ? String(error.message) : ''
  const messages: Record<string, string> = {
    '23505': 'This value is already in use. Choose a different value.',
    weak_password: 'Use a stronger password that meets the security requirements.',
    same_password: 'Choose a password different from your current password.',
    invalid_credentials: 'The email or password is incorrect.',
    over_email_send_rate_limit: 'Too many attempts. Wait a moment before trying again.',
    over_request_rate_limit: 'Too many attempts. Wait a moment before trying again.',
    '42501': 'Your session or permissions have changed. Sign in again.',
    PGRST301: 'Your session has expired. Sign in again.',
    email_exists: 'This email address is already in use.',
    email_address_invalid: 'Enter a valid email address.',
    reauth_nonce_invalid: 'The verification code is invalid or has expired. Request a new code.',
    otp_expired: 'The verification code has expired. Request a new code.',
  }
  if (messages[code]) return messages[code]
  const validation = code === 'P0001' && message.startsWith('VALIDATION:') ? message.slice(11).trim() : message
  if (adminValidationMessages[validation]) return adminValidationMessages[validation]
  if (Object.values(adminValidationMessages).includes(validation)) return validation
  if (code === '22023') return 'Check the form fields and selections, then try again.'
  const storageWarnings = [
    ' New files were preserved because database status could not be confirmed. Review Storage before retrying.',
    ' A stored image needs manual Storage cleanup.',
  ]
  // Preserve known storage outcomes without exposing the underlying provider error.
  return fallback + storageWarnings.filter(warning => message.includes(warning)).join('')
}

export function formError(error: unknown, fallback = 'Permintaan gagal. Periksa koneksi dan coba lagi.'): string {
  if (!error || typeof error !== 'object') return fallback
  const code = 'code' in error ? String(error.code) : ''
  const message = 'message' in error ? String(error.message) : ''
  if (code === '23505') return "Data sudah digunakan. Untuk nama pengguna, coba nama lain."
  if (code === "weak_password") return "Kata sandi belum memenuhi kebijakan keamanan. Gunakan kata sandi yang lebih kuat."
  if (code === "same_password") return "Kata sandi baru sama dengan kata sandi akun saat ini. Gunakan kata sandi lain jika ingin mengubahnya."
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
