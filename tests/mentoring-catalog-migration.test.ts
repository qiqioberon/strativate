import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
const read=(p:string)=>{assert.equal(existsSync(p),true,`${p} must exist`);return readFileSync(p,'utf8')}
const migrationPaths=[
 'supabase/migrations/202609160002_mentoring_catalog_schema.sql',
 'supabase/migrations/202609160003_private_catalog_admin_rpcs.sql',
 'supabase/migrations/202609160004_intensive_catalog_admin_rpcs.sql',
 'supabase/migrations/202609160005_intensive_catalog_seed.sql',
]
test('normalized intensive catalog schema, RLS, seeds, and blocked guarantee records',()=>{
 const sql=migrationPaths.map(read).join('\n')
 const conflicts=read('docs/strativate/source-conflicts.md')
 for(const table of ['intensive_mentoring_packages','intensive_mentoring_package_features','intensive_mentoring_add_ons','intensive_mentoring_add_on_features','intensive_mentoring_bundles','intensive_mentoring_bundle_items']) assert.match(sql,new RegExp(`create table public\\.${table}`))
 assert.match(sql,/pricing_mode text not null check \(pricing_mode in \('fixed','consultation'\)\)/)
 assert.match(sql,/item_type text not null check \(item_type in \('package','add_on','feature'\)\)/)
 assert.match(sql,/enable row level security/)
 assert.match(sql,/public\.is_admin\(\)/)
 assert.match(sql,/Intensive[\s\S]*1150000[\s\S]*1400000/)
 assert.match(sql,/Super Intensive[\s\S]*2200000[\s\S]*2800000/)
 assert.match(sql,/Laporan Performa Terperinci[\s\S]*150000/)
 assert.match(sql,/Simulasi Penjurian[\s\S]*300000/)
 assert.match(sql,/Skill Builder[\s\S]*1250000/)
 assert.match(sql,/Competition Ready[\s\S]*2500000/)
 assert.match(sql,/Win Guarantee Protection[\s\S]*false/)
 assert.match(sql,/Competition Assurance[\s\S]*false/)
 assert.match(sql,/admin_upsert_private_mentoring_learning_path/)
 assert.match(sql,/admin_upsert_private_mentoring_session_focus/)
 assert.match(sql,/admin_upsert_competition_category/)
 assert.match(sql,/admin_delete_mentoring_master/)
 for(const fn of ['admin_save_intensive_package','admin_save_intensive_add_on','admin_save_intensive_bundle']) assert.match(sql,new RegExp(fn))
 assert.match(sql,/deactivate_required/)
 assert.match(sql,/feature_text is not null/)
 assert.doesNotMatch(sql,/refund or credit/i)
 assert.match(conflicts,/16 September 2026 Intensive Mentoring catalog resolution/)
 assert.match(conflicts,/remain inactive for public display/)
})
