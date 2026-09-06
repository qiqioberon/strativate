import assert from 'node:assert/strict'
import test from 'node:test'
import { parseInstitutions, planImport } from '../scripts/institution-data'
const header = 'name,normalized_name,type,province,city,external_id,source,source_url,approval_status,institution_status\n'
test('CSV parser preserves source IDs and quoted names, accepts nullable university metadata', () => {
  const result = parseInstitutions(header + '"Universitas, Indonesia",universitas indonesia,university,,,uuid-123,bima_kemdiktisaintek,,approved,\n')
  assert.equal(result.errors.length, 0)
  assert.equal(result.rows[0].name, 'Universitas, Indonesia')
  assert.equal(result.rows[0].external_id, 'uuid-123')
  assert.equal(result.rows[0].province, null)
  assert.equal(result.rows[0].source_url, null)
})
test('CSV rejects invalid types and does not fabricate identity for missing IDs', () => {
  const result = parseInstitutions(header + 'School,school,other,,,1,school_pdf,,approved,\nSchool,school,sma,,,,school_pdf,,approved,\n')
  assert.equal(result.rows.length, 0)
  assert.equal(result.errors.length, 2)
})
test('import plan is idempotent by source identity, allowing equal institution names', () => {
  const { rows } = parseInstitutions(header + 'SMA Sama,sma sama,sma,,,001,school_pdf,,approved,\nSMA Sama,sma sama,sma,,,002,school_pdf,,approved,\n')
  assert.equal(planImport(rows, []).insert.length, 2)
  const repeat = planImport(rows, rows.map(row => ({ ...row, submitted_by: null })))
  assert.equal(repeat.skip.length, 2)
  assert.equal(repeat.insert.length + repeat.update.length, 0)
  const changed = planImport([{ ...rows[0], city: 'Bandung' }], [{ ...rows[0], submitted_by: null }])
  assert.equal(changed.update.length, 1)
  const protectedSubmission = planImport(rows, [{ ...rows[0], submitted_by: 'user-id' }])
  assert.equal(protectedSubmission.errors.length, 1)
})
