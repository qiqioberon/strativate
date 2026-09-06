import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { parseInstitutions, planImport, type ImportRow } from './institution-data'
import type { Database } from '../lib/supabase/database.types'
import pg from 'pg'

const args = process.argv.slice(2)
const pathArg = args.find(arg => !arg.startsWith('--'))
const path = resolve(pathArg || 'supabase/seed/institutions_all.csv')
const dryRun = args.includes('--dry-run'), postgres = args.includes('--postgres')
async function main() {
  if (!existsSync(path)) throw new Error('CSV tidak ditemukan. Berikan path institutions_all.csv.')
  const { rows, errors } = parseInstitutions(readFileSync(path, 'utf8'))
  if (errors.length) { errors.forEach(error => process.stderr.write(`${error}\n`)); throw new Error(`${errors.length} baris tidak valid; impor tidak dijalankan.`) }
  if (dryRun && !args.includes('--compare')) { console.log(JSON.stringify({ mode: 'validate-only', valid: rows.length, errors: 0 })); return }
  const databaseUrl = process.env.SUPABASE_DB_URL
  const sql = postgres ? new pg.Client({ connectionString: databaseUrl }) : null
  if (postgres && !databaseUrl) throw new Error('SUPABASE_DB_URL wajib untuk --postgres.')
  if (!postgres && (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY)) throw new Error('URL Supabase dan secret server wajib diatur.')
  const supabase = !postgres ? createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } }) : null
  const totals = { inserted: 0, updated: 0, skipped: 0, errors: 0 }
  try {
    if (sql) await sql.connect()
    for (let offset = 0; offset < rows.length; offset += 200) {
      const batch = rows.slice(offset, offset + 200)
      if (dryRun && supabase) {
        const existing: (ImportRow & { submitted_by: string | null })[] = []
        for (const source of new Set(batch.map(row => row.source))) {
          const { data, error } = await supabase.from('institutions').select('*').eq('source', source).in('external_id', batch.filter(row => row.source === source).map(row => row.external_id))
          if (error) throw new Error('Database belum dapat dibaca. Terapkan migrasi dan periksa kredensial.')
          existing.push(...(data || []) as (ImportRow & { submitted_by: string | null })[])
        }
        const plan = planImport(batch, existing)
        totals.inserted += plan.insert.length; totals.updated += plan.update.length; totals.skipped += plan.skip.length; totals.errors += plan.errors.length
      } else if (dryRun && sql) {
        const { rows: existing } = await sql.query('select * from public.institutions where (source,external_id) in (select x.source,x.external_id from jsonb_to_recordset($1::jsonb) x(source text,external_id text))', [JSON.stringify(batch)])
        const plan = planImport(batch, existing)
        totals.inserted += plan.insert.length; totals.updated += plan.update.length; totals.skipped += plan.skip.length; totals.errors += plan.errors.length
      } else {
        const result = sql ? (await sql.query('select public.import_institutions_batch($1::jsonb) as counts', [JSON.stringify(batch)])).rows[0].counts
          : await supabase!.rpc('import_institutions_batch', { p_rows: batch }).then(({ data, error }) => { if (error) throw new Error('Batch gagal. Periksa migrasi, koneksi, dan identitas institusi.'); return data })
        const counts = result as { inserted: number; updated: number; skipped: number }
        totals.inserted += counts.inserted; totals.updated += counts.updated; totals.skipped += counts.skipped
      }
    }
    console.log(JSON.stringify({ mode: dryRun ? 'comparison-only' : 'import', rows: rows.length, ...totals }))
    if (totals.errors) process.exitCode = 1
  } catch (error) {
    console.log(JSON.stringify({ mode: 'partial-import', ...totals, errors: totals.errors + 1 }))
    throw error
  } finally { if (sql) await sql.end() }
}
main().catch(error => { console.error(error instanceof Error && !('severity' in error) ? error.message : 'Operasi database gagal. Periksa konfigurasi dan log database.'); process.exitCode = 1 })
