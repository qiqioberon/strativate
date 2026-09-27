import type { CompetitionRecognition } from '@/lib/supabase/database.types'

const allowedLogoTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maximumLogoSize = 5 * 1024 * 1024

export type CompetitionRecognitionFile = Pick<File, 'size' | 'type'>
export type CompetitionRecognitionDraftErrors = Partial<Record<'competitionName' | 'file' | 'position', string>>

export function validateCompetitionRecognitionDraft({
  competitionName,
  position,
  recognitionCount,
  file,
  hasStoredLogo,
}: {
  competitionName: string
  position?: string
  recognitionCount?: number
  file: CompetitionRecognitionFile | null
  hasStoredLogo: boolean
}): CompetitionRecognitionDraftErrors {
  const errors: CompetitionRecognitionDraftErrors = {}
  const name = competitionName.trim()
  if (!name) errors.competitionName = 'Competition name is required.'
  else if (name.length > 180) errors.competitionName = 'Competition name must be 180 characters or fewer.'

  if (!file && !hasStoredLogo) errors.file = 'Choose a logo for the new recognition.'
  if (file && !allowedLogoTypes.has(file.type)) errors.file = 'Use a JPG, PNG, or WebP image.'
  else if (file && file.size > maximumLogoSize) errors.file = 'Logo size must be 5 MB or smaller.'

  if (position !== undefined) {
    const parsed = Number(position.trim())
    const maximum = recognitionCount ?? 0
    if (!position.trim() || !Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
      errors.position = `Position must be a whole number from 1 to ${maximum}.`
    }
  }
  return errors
}

export function buildCompetitionRecognitionPayload({
  competitionName,
  logoPath,
  storedLogoPath,
  isActive,
}: {
  competitionName: string
  logoPath: string | null
  storedLogoPath: string | null
  isActive: boolean
}) {
  return {
    competition_name: competitionName.trim(),
    logo_path: logoPath ?? storedLogoPath!,
    is_active: isActive,
  }
}

export function getNextCompetitionRecognitionOrder(records: CompetitionRecognition[]) {
  return records.length ? Math.max(...records.map(record => record.display_order)) + 1 : 1
}

export function moveCompetitionRecognitionIdToPosition(records: CompetitionRecognition[], recognitionId: string, position: number) {
  const ids = records.map(record => record.id)
  const currentIndex = ids.indexOf(recognitionId)
  const destination = position - 1
  if (currentIndex < 0 || destination < 0 || destination >= ids.length || destination === currentIndex) return ids
  const [id] = ids.splice(currentIndex, 1)
  ids.splice(destination, 0, id)
  return ids
}

export function reorderCompetitionRecognitionIds(records: CompetitionRecognition[], index: number, direction: -1 | 1) {
  const ids = records.map(record => record.id)
  const destination = index + direction
  if (index < 0 || index >= ids.length || destination < 0 || destination >= ids.length) return ids
  ;[ids[index], ids[destination]] = [ids[destination], ids[index]]
  return ids
}

export function safeCompetitionLogoFileName(name: string, contentType?: string) {
  const normalized = name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  const safeName = normalized || 'logo'
  if (/\.(jpe?g|png|webp)$/i.test(safeName) || !contentType) return safeName
  const extension = contentType === 'image/jpeg' ? 'jpg' : contentType === 'image/png' ? 'png' : 'webp'
  return `${safeName}.${extension}`
}

export function isCompetitionRecognitionSetupRequired(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: unknown; message?: unknown }
  const code = typeof candidate.code === 'string' ? candidate.code.toUpperCase() : ''
  const message = typeof candidate.message === 'string' ? candidate.message.toLowerCase() : ''
  return code === 'PGRST205'
    || code === '42P01'
    || (message.includes('competition_recognitions') && (
      message.includes('does not exist')
      || message.includes('could not find')
      || message.includes('schema cache')
    ))
}
