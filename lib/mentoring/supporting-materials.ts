export const MAX_SUPPORTING_MATERIALS = 20
export const MAX_SUPPORTING_MATERIAL_LENGTH = 1000

export type SupportingMaterialCategory = 'guidebook' | 'pitch_deck' | 'additional'
export type SupportingMaterialEntry = {
  category: SupportingMaterialCategory
  kind: 'link' | 'note'
  value: string
}

export type MentoringSessionPreference = {
  sessionId: string
  parentId: string
  kind: 'private' | 'intensive'
  status: 'awaiting_focus' | 'awaiting_scheduling' | 'scheduled' | 'completed' | 'cancelled'
  scheduledStartAt: string | null
  topicStatus: 'needs_input' | 'pending_review' | 'confirmed'
  requestedFocusId: string | null
  requestedFocusName: string | null
  requestedCustomFocus: string | null
  requestedTopic: string | null
  focusId: string | null
  focusName: string | null
  customFocus: string | null
  topic: string | null
  supportingMaterials: string[]
  supportingMaterialEntries: SupportingMaterialEntry[] | null
  mentorNotes: string | null
  competitionNames: string[]
}

/** Never turn a note or a non-web protocol into an external link. */
export function isHttpMaterialLink(value: string): boolean {
  if (!/^https?:\/\//i.test(value) || /\s/.test(value)) return false
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname)
  } catch {
    return false
  }
}

/** Null means a historical record; an empty typed array deliberately clears materials. */
export function readSupportingMaterials(
  entries: unknown,
  legacy: readonly string[] = [],
): SupportingMaterialEntry[] {
  if (!Array.isArray(entries)) {
    return legacy.map(value => ({ category: 'additional', kind: isHttpMaterialLink(value) ? 'link' : 'note', value }))
  }
  return entries.filter((entry): entry is SupportingMaterialEntry => {
    if (!entry || typeof entry !== 'object') return false
    const record = entry as Record<string, unknown>
    return ['guidebook', 'pitch_deck', 'additional'].includes(String(record.category))
      && (record.kind === 'link' || record.kind === 'note')
      && typeof record.value === 'string'
  })
}

export function supportingMaterialInput(value: string, category: SupportingMaterialCategory): SupportingMaterialEntry {
  return {
    category,
    kind: category !== 'additional' || /^https?:\/\//i.test(value.trim()) ? 'link' : 'note',
    value,
  }
}

/** Client feedback mirrors the authoritative checks in the preference RPC. */
export function validateSupportingMaterials(entries: readonly SupportingMaterialEntry[]): string | null {
  if (entries.length > MAX_SUPPORTING_MATERIALS) return 'Add up to 20 materials in total.'
  const seen = new Set<string>()
  const categories = new Set<SupportingMaterialCategory>()
  for (const entry of entries) {
    const value = entry.value.trim()
    if (!value) return 'Complete or remove empty additional materials.'
    if (Array.from(value).length > MAX_SUPPORTING_MATERIAL_LENGTH) return 'Each material must be 1,000 characters or fewer.'
    if (entry.kind === 'link' && !isHttpMaterialLink(value)) return 'Use a complete http:// or https:// link.'
    if (entry.kind === 'note' && (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('//'))) {
      return 'Material links must use http:// or https://.'
    }
    if (seen.has(value)) return 'Remove duplicate materials.'
    seen.add(value)
    if (entry.category !== 'additional') {
      if (entry.kind !== 'link') return 'Guidebook and Pitch Deck must be links.'
      if (categories.has(entry.category)) return 'Add one link each for Guidebook and Pitch Deck.'
      categories.add(entry.category)
    }
  }
  return null
}
