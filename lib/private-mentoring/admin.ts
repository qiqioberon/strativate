export type PrivateMentoringPackageDraft = {
  priceAmount: number
  referencePriceAmount: number | null
  durationMinutes: number
  maxParticipants: number
  sortOrder: number
}

export function validatePrivateMentoringPackageDraft(draft: PrivateMentoringPackageDraft, language: 'id' | 'en' = 'id') {
  const english = language === 'en'
  if (!Number.isSafeInteger(draft.priceAmount) || draft.priceAmount <= 0) return english ? 'Package price must be a positive whole number.' : 'Harga paket harus bilangan bulat positif.'
  if (draft.referencePriceAmount !== null && (!Number.isSafeInteger(draft.referencePriceAmount) || draft.referencePriceAmount < draft.priceAmount)) return english ? 'Reference price must be empty or at least the active price.' : 'Harga referensi harus kosong atau setidaknya sebesar harga aktif.'
  if (!Number.isInteger(draft.durationMinutes) || draft.durationMinutes < 1 || draft.durationMinutes > 480) return english ? 'Session duration must be 1–480 minutes.' : 'Durasi sesi harus 1–480 menit.'
  if (!Number.isInteger(draft.maxParticipants) || draft.maxParticipants < 1 || draft.maxParticipants > 100) return english ? 'Participant count must be 1–100.' : 'Jumlah peserta harus 1–100.'
  if (!Number.isInteger(draft.sortOrder) || draft.sortOrder < 0) return english ? 'Display order must be a non-negative whole number.' : 'Urutan harus bilangan bulat non-negatif.'
  return null
}
