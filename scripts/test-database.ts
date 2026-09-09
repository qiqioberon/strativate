import { readFileSync, readdirSync } from 'node:fs'
import pg from 'pg'

async function main() {
  const url = process.env.TEST_DATABASE_URL
  if (!url || !new URL(url).pathname.slice(1).startsWith('strativate_test_')) throw new Error('Use TEST_DATABASE_URL with a disposable database named strativate_test_*. Never use production.')
  const db = new pg.Client({ connectionString: url })
  await db.connect()
  try {
    if (process.argv.includes('--bootstrap')) {
      const { rows } = await db.query("select to_regclass('auth.users') as users, to_regclass('public.profiles') as profiles")
      if (rows[0].users || rows[0].profiles) throw new Error('Bootstrap requires an empty disposable database.')
      await db.query(readFileSync('supabase/tests/bootstrap.sql', 'utf8'))
      for (const filename of readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort()) {
        await db.query(`BEGIN;\n${readFileSync(`supabase/migrations/${filename}`, 'utf8')}\nCOMMIT;`)
        console.log(`Migration passed: ${filename}`)
      }
    }
    for (const filename of ['auth_security.sql', 'institution_import.sql', 'mentor_invites.sql', 'product_catalog.sql']) {
      const sql = readFileSync(`supabase/tests/${filename}`, 'utf8')
      await db.query(sql)
      console.log(`Passed: ${filename}`)
    }
  } finally { await db.end() }
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Database tests failed'); process.exitCode = 1 })
