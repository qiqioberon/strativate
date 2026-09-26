import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

import {
  buildCompetitionRecognitionPayload,
  getNextCompetitionRecognitionOrder,
  isCompetitionRecognitionSetupRequired,
  moveCompetitionRecognitionIdToPosition,
  reorderCompetitionRecognitionIds,
  safeCompetitionLogoFileName,
  validateCompetitionRecognitionDraft,
} from '../lib/marketing/competition-recognition-admin'
import type { CompetitionRecognition } from '../lib/supabase/database.types'

const root = path.resolve(import.meta.dirname, '..')
const read = (file: string) => readFile(path.join(root, file), 'utf8')
const mb = 1024 * 1024

const recognition = (id: string, displayOrder: number): CompetitionRecognition => ({
  id,
  competition_name: `Competition ${id}`,
  logo_path: `recognition-logos/${id}.webp`,
  display_order: displayOrder,
  is_active: true,
  created_at: '2026-09-27T00:00:00.000Z',
  updated_at: '2026-09-27T00:00:00.000Z',
})

test('recognition draft validation enforces names, logos, image types, size, and edit positions', () => {
  assert.deepEqual(validateCompetitionRecognitionDraft({ competitionName: ' ', file: null, hasStoredLogo: false }), {
    competitionName: 'Competition name is required.',
    file: 'Choose a logo for the new recognition.',
  })
  assert.equal(validateCompetitionRecognitionDraft({ competitionName: 'x'.repeat(181), file: null, hasStoredLogo: true }).competitionName, 'Competition name must be 180 characters or fewer.')
  assert.equal(validateCompetitionRecognitionDraft({ competitionName: 'Finalist', file: { type: 'image/gif', size: 20 }, hasStoredLogo: false }).file, 'Use a JPG, PNG, or WebP image.')
  assert.equal(validateCompetitionRecognitionDraft({ competitionName: 'Finalist', file: { type: 'image/svg+xml', size: 20 }, hasStoredLogo: false }).file, 'Use a JPG, PNG, or WebP image.')
  assert.deepEqual(validateCompetitionRecognitionDraft({ competitionName: 'Finalist', file: { type: 'image/webp', size: 5 * mb }, hasStoredLogo: false }), {})
  assert.equal(validateCompetitionRecognitionDraft({ competitionName: 'Finalist', file: { type: 'image/png', size: 5 * mb + 1 }, hasStoredLogo: false }).file, 'Logo size must be 5 MB or smaller.')
  assert.deepEqual(validateCompetitionRecognitionDraft({ competitionName: ' Finalist ', position: '2', recognitionCount: 3, file: null, hasStoredLogo: true }), {})
  assert.equal(validateCompetitionRecognitionDraft({ competitionName: 'Finalist', position: '0', recognitionCount: 3, file: null, hasStoredLogo: true }).position, 'Position must be a whole number from 1 to 3.')
  assert.equal(validateCompetitionRecognitionDraft({ competitionName: 'Finalist', position: '2.5', recognitionCount: 3, file: null, hasStoredLogo: true }).position, 'Position must be a whole number from 1 to 3.')
})

test('recognition payload trims the name and preserves the stored logo unless replaced', () => {
  assert.deepEqual(buildCompetitionRecognitionPayload({ competitionName: ' Finalist Cup ', logoPath: null, storedLogoPath: 'recognition-logos/stored.webp', isActive: false }), {
    competition_name: 'Finalist Cup',
    logo_path: 'recognition-logos/stored.webp',
    is_active: false,
  })
  assert.equal(buildCompetitionRecognitionPayload({ competitionName: 'Cup', logoPath: 'recognition-logos/new.png', storedLogoPath: 'recognition-logos/old.png', isActive: true }).logo_path, 'recognition-logos/new.png')
})

test('recognition ordering helpers return complete immutable identity lists', () => {
  const records = [recognition('a', 2), recognition('b', 6), recognition('c', 9)]
  assert.equal(getNextCompetitionRecognitionOrder([]), 1)
  assert.equal(getNextCompetitionRecognitionOrder(records), 10)
  assert.deepEqual(moveCompetitionRecognitionIdToPosition(records, 'c', 1), ['c', 'a', 'b'])
  assert.deepEqual(moveCompetitionRecognitionIdToPosition(records, 'missing', 2), ['a', 'b', 'c'])
  assert.deepEqual(reorderCompetitionRecognitionIds(records, 1, -1), ['b', 'a', 'c'])
  assert.deepEqual(reorderCompetitionRecognitionIds(records, 2, 1), ['a', 'b', 'c'])
  assert.deepEqual(records.map(item => item.id), ['a', 'b', 'c'])
})

test('recognition filenames are safe and setup detection is limited to missing-schema failures', () => {
  assert.equal(safeCompetitionLogoFileName('Grand Final LOGO (2026).PNG'), 'grand-final-logo-2026-.png')
  assert.equal(safeCompetitionLogoFileName('🔥'), 'logo')
  assert.equal(isCompetitionRecognitionSetupRequired({ code: '42P01' }), true)
  assert.equal(isCompetitionRecognitionSetupRequired({ code: 'PGRST205' }), true)
  assert.equal(isCompetitionRecognitionSetupRequired({ message: "Could not find 'competition_recognitions' in the schema cache" }), true)
  assert.equal(isCompetitionRecognitionSetupRequired({ message: 'network unavailable' }), false)
  assert.equal(isCompetitionRecognitionSetupRequired({ code: '42501' }), false)
})

test('recognition admin owns safe storage reconciliation and complete CRUD controls', async () => {
  const [component, admin] = await Promise.all([
    read('components/admin/competition-recognition-management.tsx'),
    read('app/admin/page.tsx'),
  ])

  assert.match(component, /storage\.from\('marketing-editorial'\)\.upload\(uploadedPath/)
  assert.match(component, /uploadedPath = `recognition-logos\/\$\{crypto\.randomUUID\(\)\}-/)
  assert.match(component, /alt=\{recognition\.competition_name\}/)
  assert.match(component, /rpc\('reorder_competition_recognitions'/)
  assert.match(component, /data-testid="competition-recognition-add-button"/)
  assert.match(component, /data-testid=\{`competition-recognition-\$\{recognition\.id\}-edit-button`\}/)
  assert.match(component, /role="switch"/)
  assert.match(component, /move-up-button/)
  assert.match(component, /delete-button/)
  assert.match(component, /\.eq\('logo_path', uploadedPath\)[\s\S]*\.maybeSingle\(\)/)
  assert.match(component, /if \(reconciliationError\)[\s\S]*status could not be confirmed[\s\S]*else \{[\s\S]*remove\(\[uploadedPath\]\)/)
  assert.match(component, /if \(editing && uploadedPath[\s\S]*remove\(\[editing\.logo_path\]\)/)
  assert.doesNotMatch(component, /\.from\('competitions'\)/)
  assert.match(admin, /Competition Recognition/)
  assert.match(admin, /<CompetitionRecognitionManagement\/>/)
})
