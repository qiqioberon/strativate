import type { FluentIconName } from './fluent-icon'

export type AwardTier = 'gold' | 'silver' | 'bronze' | 'merit'

export type AwardStyle = { tier: AwardTier; icon: FluentIconName }

// Reads the placement text exactly as stored (English or Indonesian) and only chooses an icon and tone for it.
// It never rewrites the placement: the visible label is always the original text.
export function awardStyleFor(placement: string | null | undefined): AwardStyle {
  return findAwardStyle(placement) ?? { tier: 'merit', icon: 'medal-sports' }
}

/**
 * Strict variant for free-text captions (e.g. admin photo badges): returns null unless the text really
 * names a placement or award, so an unrelated caption never gets a medal.
 */
export function findAwardStyle(text: string | null | undefined): AwardStyle | null {
  const value = (text ?? '').toLowerCase()

  if (/\b(2nd|second|runner[\s-]?up|silver)\b|juara\s*(2|ii)\b/.test(value)) return { tier: 'silver', icon: 'medal-2nd' }
  if (/\b(3rd|third|bronze)\b|juara\s*(3|iii)\b/.test(value)) return { tier: 'bronze', icon: 'medal-3rd' }
  if (/\b(1st|first|champion|gold|winners?|grand prize)\b|juara\s*(1|i|umum)\b/.test(value)) return { tier: 'gold', icon: 'trophy' }
  if (/\b(finalists?|semi[\s-]?finalists?|best|awards?|awardee|awarded|medal|medalist|honou?rable|top\s*\d+|place|winner)\b|harapan|terbaik|favorit/.test(value)) return { tier: 'merit', icon: 'medal-sports' }
  return null
}
