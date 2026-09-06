import { parse } from 'csv-parse/sync'
export type ImportRow = { name: string; normalized_name: string; type: 'university' | 'sma' | 'smk'; province: string | null; city: string | null; external_id: string; source: string; source_url: string | null; approval_status: 'approved'; institution_status: string | null }
const columns = ['name', 'normalized_name', 'type', 'province', 'city', 'external_id', 'source', 'source_url', 'approval_status', 'institution_status']
export function parseInstitutions(text: string): { rows: ImportRow[]; errors: string[] } {
  const rows: ImportRow[] = [], errors: string[] = [], identities = new Set<string>()
  let records: Record<string, string>[]
  try {
    records = parse(text, { bom: true, columns: (headers: string[]) => {
      if (columns.some(column => !headers.includes(column))) throw new Error('CSV columns do not match.')
      return headers
    }, skip_empty_lines: true, trim: true })
  } catch { return { rows, errors: ['CSV tidak valid atau kolom wajib tidak lengkap.'] } }
  records.forEach((record, index) => {
    const name = record.name.trim().replace(/\s+/gu, ' ')
    const source = record.source.trim(), external_id = record.external_id.trim()
    const identity = `${source}:${external_id}`
    if (name.length < 2 || name.length > 250 || !['university', 'sma', 'smk'].includes(record.type) || !['bima_kemdiktisaintek', 'school_pdf'].includes(source) || !external_id || record.approval_status !== 'approved' || identities.has(identity)) {
      errors.push(`Baris ${index + 2}: nama, tipe, sumber, status, atau identitas resmi tidak valid/duplikat.`); return
    }
    identities.add(identity)
    const nullable = (value: string) => value.trim() || null
    rows.push({ name, normalized_name: name.normalize('NFC').toLowerCase(), type: record.type as ImportRow['type'], province: nullable(record.province), city: nullable(record.city), external_id, source, source_url: nullable(record.source_url), approval_status: 'approved', institution_status: nullable(record.institution_status) })
  })
  return { rows, errors }
}
export function planImport(rows: ImportRow[], existing: (ImportRow & { submitted_by: string | null })[]) {
  const plan = { insert: [] as ImportRow[], update: [] as ImportRow[], skip: [] as ImportRow[], errors: [] as string[] }
  const records = new Map(existing.map(row => [`${row.source}:${row.external_id}`, row]))
  for (const row of rows) {
    const current = records.get(`${row.source}:${row.external_id}`)
    if (!current) plan.insert.push(row)
    else if (current.submitted_by) plan.errors.push(`Identitas ${row.source}:${row.external_id} terkait pengajuan pengguna.`)
    else if (columns.every(key => row[key as keyof ImportRow] === current[key as keyof ImportRow])) plan.skip.push(row)
    else plan.update.push(row)
  }
  return plan
}
