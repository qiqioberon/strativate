const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// PostgreSQL accepts the full UUID textual space; the authoritative active-row
// lookup decides whether this identifier is a real assignable tier.
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseMentorInvitationInput(emailInput: unknown, tierIdInput: unknown):
  | { email: string; tierId: string }
  | { error: string } {
  const email = typeof emailInput === 'string' ? emailInput.trim().toLowerCase() : ''
  if (email.length > 254 || !emailPattern.test(email)) {
    return { error: 'Enter a valid mentor email.' }
  }
  const tierId = typeof tierIdInput === 'string' ? tierIdInput.trim() : ''
  if (!uuidPattern.test(tierId)) {
    return { error: 'Select an active mentor tier.' }
  }
  return { email, tierId }
}
