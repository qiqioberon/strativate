import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const migrationPath =
  "supabase/migrations/202609200006_operational_realtime_invalidation.sql"

test("operational revision migration hardens bounded revision state", async () => {
  const sql = await readFile(migrationPath, "utf8")

  assert.match(sql, /id\s+bigint\s+generated\s+always\s+as\s+identity\s+primary\s+key/i)
  assert.match(sql, /recipient_role\s+public\.app_role\s+not\s+null/i)
  assert.match(sql, /recipient_user_id\s+uuid/i)
  assert.match(sql, /where\s+recipient_user_id\s+is\s+null/i)
  assert.match(sql, /where\s+recipient_user_id\s+is\s+not\s+null/i)
  assert.match(sql, /enable\s+row\s+level\s+security/i)
  assert.match(sql, /security\s+definer/i)
  assert.match(sql, /set\s+search_path\s+to\s+''/i)
  assert.match(
    sql,
    /revoke\s+all\s+on\s+function\s+public\.bump_operational_invalidation[\s\S]+?from\s+public\s*,\s*anon\s*,\s*authenticated/i,
  )
  assert.match(
    sql,
    /alter\s+publication\s+supabase_realtime\s+add\s+table\s+public\.operational_invalidation_versions/i,
  )
})

test("operational revision migration uses semantic producers without publishing business tables", async () => {
  const sql = await readFile(migrationPath, "utf8")

  assert.match(sql, /create\s+trigger\s+orders_operational_invalidation/i)
  assert.match(sql, /create\s+trigger\s+private_sessions_operational_invalidation/i)
  assert.match(sql, /create\s+trigger\s+intensive_sessions_operational_invalidation/i)
  assert.match(sql, /create\s+trigger\s+availability_operational_invalidation/i)
  assert.match(sql, /create\s+trigger\s+mentor_invitations_operational_invalidation/i)
  assert.doesNotMatch(
    sql,
    /alter\s+publication\s+supabase_realtime\s+add\s+table\s+public\.(orders|carts|cart_items|private_mentoring_sessions|intensive_mentoring_sessions)/i,
  )
})


test("provider invalidation tracks every canonical Private and Intensive meeting state field", async () => {
  const sql = await readFile(migrationPath, "utf8")
  const privateTrigger = sql.match(/create trigger private_provider_operational_invalidation[\s\S]*?invalidate_private_provider_operational_changes\(\);/i)?.[0] ?? ""
  const intensiveTrigger = sql.match(/create trigger intensive_provider_operational_invalidation[\s\S]*?invalidate_intensive_provider_operational_changes\(\);/i)?.[0] ?? ""
  const privateFunction = sql.match(/create function public\.invalidate_private_provider_operational_changes\(\)[\s\S]*?\$\$;/i)?.[0] ?? ""
  const intensiveFunction = sql.match(/create function public\.invalidate_intensive_provider_operational_changes\(\)[\s\S]*?\$\$;/i)?.[0] ?? ""
  const canonicalFields = [
    "meeting_provider",
    "provider_meeting_id",
    "provider_meeting_url",
    "manual_meeting_url",
    "provider_sync_status",
    "provider_sync_error",
    "sync_status",
    "sync_error",
    "recording_status",
    "recording_error",
  ]

  assert.ok(privateTrigger)
  assert.ok(intensiveTrigger)
  assert.ok(privateFunction)
  assert.ok(intensiveFunction)
  for (const field of canonicalFields) {
    assert.match(privateTrigger, new RegExp(field, "i"))
    assert.match(intensiveTrigger, new RegExp(field, "i"))
    assert.match(privateFunction, new RegExp(`old\\.${field}[\\s\\S]*new\\.${field}`, "i"))
    assert.match(intensiveFunction, new RegExp(`old\\.${field}[\\s\\S]*new\\.${field}`, "i"))
  }
  assert.doesNotMatch(privateTrigger, /recording_metadata|recording_available_at/i)
  assert.doesNotMatch(intensiveTrigger, /recording_metadata|recording_available_at/i)
})


test("availability cascade skips only a mentor recipient that no longer exists", async () => {
  const sql = await readFile(migrationPath, "utf8")
  const fn = sql.match(/create function public\.invalidate_availability_operational_changes\(\)[\s\S]*?\$\$;/i)?.[0] ?? ""

  assert.ok(fn)
  assert.match(fn, /exists\s*\([\s\S]*public\.profiles[\s\S]*profile\.id\s*=\s*v_mentor_id[\s\S]*profile\.role\s*=\s*'mentor'/i)
  assert.match(fn, /bump_operational_invalidation\('mentor'[\s\S]*'availability'\)/i)
  assert.match(fn, /bump_operational_invalidation\('mentee'[\s\S]*null[\s\S]*'availability'\)/i)
  assert.match(fn, /bump_operational_invalidation\('admin'[\s\S]*null[\s\S]*'availability'\)/i)
})
