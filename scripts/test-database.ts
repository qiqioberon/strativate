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
      const migrations = readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort()
      const versions = migrations.map(filename => filename.split('_')[0])
      const duplicateVersion = versions.find((version, index) => versions.indexOf(version) !== index)
      if (duplicateVersion) throw new Error(`Duplicate Supabase migration version: ${duplicateVersion}`)
      for (const filename of migrations) {
        await db.query(`BEGIN;\n${readFileSync(`supabase/migrations/${filename}`, 'utf8')}\nCOMMIT;`)
        console.log(`Migration passed: ${filename}`)
      }
    }
    for (const filename of ['auth_security.sql', 'institution_import.sql', 'mentor_invites.sql', 'marketing_hero_posters.sql', 'marketing_testimonials.sql', 'mentor_domain.sql', 'mentor_weekly_controls.sql', 'catalog_removal.sql', 'digital_products.sql', 'shared_commerce.sql', 'protected_digital_content.sql', 'payment_attempts.sql', 'private_mentoring_business_rules.sql', 'admin_commerce_operations.sql', 'admin_mentoring_management.sql', 'profile_whatsapp_admin_mentees.sql', 'calendar_scheduling.sql', 'private_mentoring_cancellation.sql', 'operations_notifications.sql', 'intensive_mentoring_operations.sql', 'operational_realtime.sql']) {
      const sql = readFileSync(`supabase/tests/${filename}`, 'utf8')
      await db.query(sql)
      console.log(`Passed: ${filename}`)
    }
  } finally { await db.end() }
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Database tests failed'); process.exitCode = 1 })
