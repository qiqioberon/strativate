import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const migrationPath = 'supabase/migrations/202609140009_phase3_private_mentoring.sql'

function migration() {
  assert.equal(existsSync(migrationPath), true, 'Phase 3 must be a new forward-only migration')
  return readFileSync(migrationPath, 'utf8')
}

test('private mentoring owns relational business data without reviving generic catalog or offerings', () => {
  const sql = migration()
  for (const table of [
    'competition_categories',
    'private_mentoring_programs',
    'private_mentoring_highlights',
    'private_mentoring_journey_steps',
    'private_mentoring_learning_paths',
    'private_mentoring_session_focuses',
    'private_mentoring_packages',
    'commerce_cart_links',
    'commerce_cart_link_items',
    'private_mentoring_enrollments',
    'private_mentoring_sessions',
  ]) assert.match(sql, new RegExp(`create table public\\.${table}\\b`, 'i'))

  assert.doesNotMatch(sql, /create table public\.(?:private_mentoring_requests|private_mentoring_offerings|commerce_offers|catalog_)/i)
  assert.doesNotMatch(sql, /custom_focus_text|mentor_focus_expertise|custom_price|preferred_start_at|requested_start_at|requested_schedule|reschedule_request_id/i)
})

test('packages reuse mentor tiers and seed exact canonical prices without authoritative per-session price', () => {
  const sql = migration()
  assert.match(sql, /mentor_tier_id uuid not null references public\.mentor_tiers\(id\)/i)
  assert.match(sql, /unique\s*\(mentor_tier_id,\s*session_count\)/i)
  assert.match(sql, /885000/)
  assert.match(sql, /950000/)
  assert.doesNotMatch(sql, /\b285000\b/)
  assert.doesNotMatch(sql, /per_session_price|price_per_session/i)
  assert.match(sql, /duration_minutes[^\n]*default 75/i)
  assert.match(sql, /max_participants[^\n]*default 4/i)
  for (const amount of [300000, 1395000, 1890000, 2500000, 350000, 1005000, 1645000, 2240000, 3000000]) {
    assert.match(sql, new RegExp(String(amount)))
  }
})

test('seed taxonomy is exact and does not reuse onboarding interests', () => {
  const sql = migration()
  for (const path of ['End-to-End Learning', 'Competition-Focused Mentoring']) assert.match(sql, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  for (const focus of [
    'Idea & Problem Framing', 'Business Analysis & Case Structuring', 'Proposal Writing & Storyline',
    'Financial Analysis & Valuation', 'Slide Deck & Visual Design', 'Pitching & Presentation Skills',
  ]) assert.match(sql, new RegExp(focus.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  for (const category of [
    'Business Plan Competition', 'Business Case Competition', 'Scientific Paper Competition',
    'Marketing Competition', 'Accounting and Finance Competition', 'Pitching Competition',
    'Business Essay Competition', 'Equity Research Competition', 'Economic & Policy Case Competition',
  ]) assert.match(sql, new RegExp(category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.doesNotMatch(sql, /references public\.interests/i)
})

test('shared commerce resolves private mentoring from its domain and cart links store references not copied commercial truth', () => {
  const sql = migration()
  assert.match(sql, /create or replace function public\.resolve_commerce_item\s*\(p_commerce_item_id uuid\)/i)
  assert.match(sql, /private_mentoring/i)
  assert.match(sql, /private_mentoring_packages/i)
  assert.match(sql, /token_hash/i)
  const linkItems = sql.match(/create table public\.commerce_cart_link_items\s*\(([\s\S]*?)\);/i)?.[1] ?? ''
  assert.match(linkItems, /commerce_item_id uuid/i)
  assert.doesNotMatch(linkItems, /price|title|name_snapshot|custom/i)
  assert.match(sql, /create function public\.claim_commerce_cart_link/i)
  assert.match(sql, /on conflict \(cart_id, commerce_item_id\) do nothing/i)
})

test('paid private mentoring creates idempotent enrollment/session entitlement without permanent enrollment mentor', () => {
  const sql = migration()
  const enrollment = sql.match(/create table public\.private_mentoring_enrollments\s*\(([\s\S]*?)\);/i)?.[1] ?? ''
  assert.match(enrollment, /order_item_id uuid not null unique/i)
  assert.match(enrollment, /purchased_sessions/i)
  assert.doesNotMatch(enrollment, /mentor_id/i)
  assert.match(sql, /create (?:or replace )?function public\.fulfill_paid_private_mentoring_order/i)
  assert.match(sql, /generate_series\s*\(/i)
  assert.match(sql, /create trigger[\s\S]*orders/i)
})

test('session authority keeps focus with mentee and mentor/schedule with same-tier admin', () => {
  const sql = migration()
  assert.match(sql, /set_private_mentoring_session_focus/i)
  assert.match(sql, /admin_schedule_private_mentoring_session/i)
  assert.match(sql, /mentor_profiles/i)
  assert.match(sql, /tier_id/i)
  assert.match(sql, /awaiting_focus/i)
  assert.match(sql, /awaiting_scheduling/i)
  assert.match(sql, /scheduled/i)
  assert.match(sql, /completed/i)
  assert.match(sql, /public\.is_admin\(\)/i)
})
