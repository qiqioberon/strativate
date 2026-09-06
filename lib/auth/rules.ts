export function destinationFor(profile: { role: string; mentor_setup_completed_at?: string | null }, mentee: { onboarding_completed_at: string | null } | null): string {
  if (profile.role === 'admin') return '/admin'
  if (profile.role === 'mentor') return profile.mentor_setup_completed_at ? '/mentor' : '/auth/setup'
  if (profile.role === 'mentee') return mentee?.onboarding_completed_at ? '/dashboard' : '/onboarding'
  return '/auth/error'
}
export function passwordError(password: string, confirmation: string, required: boolean): string | null {
  if (!password) return required ? 'Password wajib diisi.' : confirmation ? 'Isi password terlebih dahulu.' : null
  if (password.length < 8) return 'Gunakan password minimal 8 karakter.'
  if (password.length > 128) return 'Password maksimal 128 karakter.'
  if (password !== confirmation) return 'Konfirmasi password tidak sama.'
  return null
}
export function usernameError(username: string): string | null {
  return /^[a-zA-Z0-9_]{3,30}$/.test(username) ? null : 'Username harus 3–30 karakter, menggunakan huruf, angka, atau underscore.'
}
export function displayName(profile: { first_name: string | null; last_name: string | null; username: string | null }) {
  return [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.username || 'Akun Strativate'
}
