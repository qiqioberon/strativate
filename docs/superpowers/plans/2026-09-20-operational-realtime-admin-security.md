# Operational Realtime Synchronization and Admin Account Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Add secure, bounded Realtime invalidation that causes canonical operational data to refresh, plus Admin-only self-service email and password updates.

**Architecture:** PostgreSQL maintains a single revision row for each structured recipient scope and operational domain; trusted semantic triggers atomically bump it after authoritative mutations. An authenticated client provider subscribes to revision and notification signals, reconciles only after SUBSCRIBED, coalesces stale domain sets, and tells existing loaders to refetch; it never stores business entities. The Admin profile uses the browser's current Supabase Auth session for updateUser, including a nonce reauthentication continuation when deployed Auth configuration requires it.

**Tech Stack:** Next.js 16 App Router, React, TypeScript 5.7, @supabase/supabase-js 2.115.0, PostgreSQL/Supabase RLS and Realtime, Node test runner with tsx.

**Spec:** docs/superpowers/specs/2026-09-20-operational-realtime-admin-security-design.md

## Global Constraints

- Immediately before implementation, fetch remote main and rebase the single feat/operational-realtime-and-admin-security branch onto its actual latest SHA. Use at most three commits total, bulk changes before committing, push once after verification, and open one PR to main without merging.
- Preserve layouts, navigation, onboarding, business rules, checkout polling, manual refresh controls, and visual design; the only new UI is compact Admin account security inside Profile.
- Use structured recipient_role and nullable recipient_user_id, never an opaque parsed scope; bound rows with two partial unique indexes.
- Realtime holds only revision/invalidation state. Consumers refetch from established authoritative API/RPC/server loaders; backend transaction/concurrency validation remains authoritative.
- Revision bumps occur only through a hardened, schema-qualified SECURITY DEFINER helper with empty/restricted search_path; revoke from PUBLIC, anon, and authenticated.
- Reconcile only after SUBSCRIBED, then every successful reconnect and hidden-to-visible change. Coalesce all stale domains in a roughly 150ms Set window.
- Keep notification-to-domain mappings in exactly one typed source. Do not make notifications solely to invalidate data.
- Emit at semantic mutation boundaries. Fulfillment that commits separately from payment must bump its own domains after its own commit.
- User rows are readable only by the exact current account and role; role-wide Admin rows must be unreadable to Mentor/Mentee accounts. Add executable SQL coverage for both guarantees.
- SDK audit: installed @supabase/supabase-js is 2.115.0 and exposes reauthenticate() and updateUser({ password, nonce }). No tracked supabase/config.toml establishes hosted Secure Password Change status, so support an error-driven nonce flow without inventing a current-password field.
- Before frontend edits, reread the three Strativate frontend docs and relevant installed Next 16 App Router docs.

## Review Focus

- Calendar and provider events inside one debounce interval must invoke one callback containing both domains; Task 2 tests the union.
- Initial reconciliation must not fetch before SUBSCRIBED, and a visible-tab change during reconnect must defer to a later SUBSCRIBED; Task 2 tests both.
- Admin role-wide revisions must be visible to Admin but denied to Mentor/Mentee, and user revisions denied to another same-role account; Task 1 runs those Postgres assertions.
- A scheduling slot that vanishes from a canonical reload must clear selection, while filters and still-valid selection remain; Task 4 tests each result.
- A password change that receives reauthentication_needed must not persist the password and must only complete with the nonce continuation; Task 5 tests the sequence.

---

## File Structure

| Path | Responsibility |
| --- | --- |
| supabase/migrations/202609200006_operational_realtime_invalidation.sql | Bounded table, RLS, publication membership, protected bump helper, guarded semantic triggers. |
| supabase/tests/operational_realtime.sql | Database assertions for shape, grants, atomic bumps, and scope isolation. |
| lib/realtime/operational-invalidation.ts | Sole typed notification-to-domain map plus domain, accumulator, and revision utilities. |
| components/realtime/operational-realtime-provider.tsx | Channel lifecycle, post-subscription reconciliation, version map, domain callback registry. |
| components/auth/account-provider.tsx | Mounts provider without changing auth/business entity state. |
| components/dashboard, components/calendar, components/mentor, components/admin | Register existing canonical loaders against typed domains. |
| components/auth/admin-account-security.tsx | Admin-only current-session email/password/reauthentication UI. |
| tests/operational-realtime*.test.ts and tests/admin-account-security.test.ts | Static migration, pure, provider, consumer, and account-security tests. |
| scripts/test-database.ts and lib/database.types.ts | Register SQL suite and type the read-only revision table. |

### Task 1: Create the bounded database invalidation contract

**Files:**
- Create: supabase/migrations/202609200006_operational_realtime_invalidation.sql
- Create: supabase/tests/operational_realtime.sql
- Create: tests/operational-realtime-migration.test.ts
- Modify: scripts/test-database.ts
- Modify: lib/database.types.ts

**Interfaces:**
- Produces public.operational_invalidation_versions(id bigint generated always as identity primary key, recipient_role public.app_role, recipient_user_id uuid, domain text, revision bigint, updated_at timestamptz) and trigger-only public.bump_operational_invalidation(public.app_role, uuid, text).
- Produces Realtime payloads Task 2 reads as { recipient_role, recipient_user_id, domain, revision }.

- [ ] **Step 1: Write the failing static migration test**

~~~
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('operational revision migration hardens bounded revision state', async () => {
  const sql = await readFile('supabase/migrations/202609200006_operational_realtime_invalidation.sql', 'utf8')
  assert.match(sql, /recipient_role\s+public\.app_role/i)
  assert.match(sql, /recipient_user_id\s+uuid/i)
  assert.match(sql, /generated always as identity primary key/i)
  assert.match(sql, /WHERE recipient_user_id IS NULL/i)
  assert.match(sql, /WHERE recipient_user_id IS NOT NULL/i)
  assert.match(sql, /SECURITY DEFINER/i)
  assert.match(sql, /SET search_path TO ''/i)
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.bump_operational_invalidation/i)
  assert.match(sql, /ADD TABLE public\.operational_invalidation_versions/i)
})
~~~

- [ ] **Step 2: Run test to verify it fails**

Run: node --import tsx --test tests/operational-realtime-migration.test.ts

Expected: FAIL with ENOENT naming 202609200006_operational_realtime_invalidation.sql.

- [ ] **Step 3: Add the table, indexes, RLS, publication, and protected upsert helper**

~~~
create table public.operational_invalidation_versions (
  id bigint generated always as identity primary key,
  recipient_role public.app_role not null,
  recipient_user_id uuid references public.profiles(id) on delete cascade,
  domain text not null check (domain in ('commerce','cart','library','mentoring','mentor-dashboard','calendar','availability','provider','admin-overview','cart-links','mentor-invitations')),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
create unique index operational_invalidation_user_scope_domain_key
  on public.operational_invalidation_versions (recipient_role, recipient_user_id, domain)
  where recipient_user_id is not null;
create unique index operational_invalidation_role_scope_domain_key
  on public.operational_invalidation_versions (recipient_role, domain)
  where recipient_user_id is null;
alter table public.operational_invalidation_versions enable row level security;
create policy operational_invalidation_read_current_scope on public.operational_invalidation_versions for select to authenticated using (
  recipient_role = (select role from public.profiles where id = auth.uid())
  and (recipient_user_id = auth.uid() or recipient_user_id is null)
);
create function public.bump_operational_invalidation(p_recipient_role public.app_role, p_recipient_user_id uuid, p_domain text)
returns void language plpgsql security definer set search_path to '' as $$
begin
  if p_domain not in ('commerce','cart','library','mentoring','mentor-dashboard','calendar','availability','provider','admin-overview','cart-links','mentor-invitations') then raise exception 'unsupported invalidation domain'; end if;
  if p_recipient_user_id is null then
    insert into public.operational_invalidation_versions as v (recipient_role, recipient_user_id, domain) values (p_recipient_role, null, p_domain)
    on conflict (recipient_role, domain) where recipient_user_id is null do update set revision = v.revision + 1, updated_at = now();
  else
    insert into public.operational_invalidation_versions as v (recipient_role, recipient_user_id, domain) values (p_recipient_role, p_recipient_user_id, p_domain)
    on conflict (recipient_role, recipient_user_id, domain) where recipient_user_id is not null do update set revision = v.revision + 1, updated_at = now();
  end if;
end;
$$;
revoke all on function public.bump_operational_invalidation(public.app_role, uuid, text) from public, anon, authenticated;
~~~

Use established profile-role helper pattern if prior migrations expose one; every relation/function used by a SECURITY DEFINER body must be schema-qualified. Add this table, and no business table solely for invalidation, to supabase_realtime.

- [ ] **Step 4: Add narrow semantic trigger functions and producer triggers**

Implement guarded trigger functions under public with SECURITY DEFINER SET search_path TO '', qualified helper calls, and IS DISTINCT FROM guards. Attach to the established authoritative boundaries: orders/payment attempts, carts/cart items/cart links, Private and Intensive enrollment/session/integration, availability rules, and mentor invitations. Use AFTER UPDATE OF for status, assignment, schedule/provider, and availability columns. On reassign, bump old and new mentor scopes. Preserve existing triggers/rules; do not attach broad every-row downstream triggers.

~~~
if tg_op = 'UPDATE' and old.mentor_id is not distinct from new.mentor_id then return new; end if;
if old.mentor_id is not null then perform public.bump_operational_invalidation('mentor', old.mentor_id, 'mentoring'); end if;
if new.mentor_id is not null then perform public.bump_operational_invalidation('mentor', new.mentor_id, 'mentoring'); end if;
perform public.bump_operational_invalidation('admin', null, 'admin-overview');
return new;
~~~

For payment, inspect transaction boundaries. Cover dependent domains at the order boundary only when fulfillment is same transaction; otherwise add a guarded authoritative bump at each later fulfillment commit.

- [ ] **Step 5: Add executable database access and atomicity proof**

Register the suite in scripts/test-database.ts. Follow supabase/tests/bootstrap.sql helpers to seed Admin, Mentor, Mentee, and two same-role accounts. Assert Admin sees its role-wide row; Mentor/Mentee SELECTs return zero rows for it; a user-scoped SELECT returns zero rows to another same-role account; authenticated writes and helper execution raise permission errors; and two trusted bumps leave one row at revision 2.

~~~
select test_security.assert((select revision = 2 from public.operational_invalidation_versions where recipient_role = 'admin' and recipient_user_id is null and domain = 'admin-overview'), 'trusted bumps are atomic and bounded');
set local role authenticated;
select set_config('request.jwt.claim.sub', test_security.user_id('mentor'), true);
select test_security.assert((select count(*) = 0 from public.operational_invalidation_versions where recipient_role = 'admin'), 'mentor sees zero admin role-wide revisions');
select test_security.denied($$ select public.bump_operational_invalidation('mentor', auth.uid(), 'mentoring') $$, 'authenticated user cannot invoke bump helper');
~~~

- [ ] **Step 6: Type table and verify Task 1**

Add generated-equivalent table row/insert/update types to lib/database.types.ts; do not expose protected helper as a client RPC. Run node --import tsx --test tests/operational-realtime-migration.test.ts and expect PASS. If TEST_DATABASE_URL names a disposable strativate_test_* database, run pnpm test:db and expect operational_realtime.sql to pass; otherwise report it as intentionally not run.

### Task 2: Implement the typed invalidation provider and reconcile protocol

**Files:**
- Create: lib/realtime/operational-invalidation.ts
- Create: components/realtime/operational-realtime-provider.tsx
- Create: tests/operational-realtime.test.ts
- Create: tests/operational-realtime-provider.test.ts
- Modify: components/auth/account-provider.tsx

**Interfaces:**
- Produces OperationalDomain, domainsForNotification(type), createDomainAccumulator(flush, 150), and isNewerRevision(previous, next).
- Produces OperationalRealtimeProvider and useOperationalInvalidation(domains, callback), whose callback receives ReadonlySet<OperationalDomain>. Observed counters are keyed by recipient_role, recipient_user_id-or-role-wide, and domain; only domains enter the coalesced Set.

- [ ] **Step 1: Write failing pure behavior tests**

~~~
test('notification mapping and accumulator preserve every domain', async () => {
  assert.deepEqual(domainsForNotification('payment_paid'), ['commerce', 'cart', 'library', 'mentoring', 'admin-overview'])
  const calls: string[][] = []
  const accumulator = createDomainAccumulator(domains => calls.push([...domains].sort()), 1)
  accumulator.add(['calendar']); accumulator.add(['provider']); await delay(5)
  assert.deepEqual(calls, [['calendar', 'provider']])
})
test('older revisions do not make a domain stale', () => assert.equal(isNewerRevision(8, 8), false))
test('scope revision keys keep independent counters separate', () => {
  assert.notEqual(revisionScopeKey('admin', null, 'commerce'), revisionScopeKey('mentee', null, 'commerce'))
  assert.notEqual(revisionScopeKey('mentee', null, 'cart'), revisionScopeKey('mentee', 'user-a', 'cart'))
})
~~~

- [ ] **Step 2: Run test to verify it fails**

Run: node --import tsx --test tests/operational-realtime.test.ts

Expected: FAIL with missing module/export.

- [ ] **Step 3: Implement central mapping and accumulator**

~~~
export const operationalDomains = ['commerce','cart','library','mentoring','mentor-dashboard','calendar','availability','provider','admin-overview','cart-links','mentor-invitations'] as const
export type OperationalDomain = (typeof operationalDomains)[number]
export const notificationMetadata = {
  payment_paid: { category: 'commerce', domains: ['commerce','cart','library','mentoring','admin-overview'] },
  mentor_assigned: { category: 'mentoring', domains: ['mentoring','mentor-dashboard','calendar','availability'] },
  session_scheduled: { category: 'mentoring', domains: ['mentoring','mentor-dashboard','calendar','availability','provider'] },
  session_cancelled: { category: 'mentoring', domains: ['mentoring','mentor-dashboard','calendar','availability','provider'] },
} as const satisfies Record<string, { category: string; domains: readonly OperationalDomain[] }>
export const domainsForNotification = (type: string) => notificationMetadata[type as keyof typeof notificationMetadata]?.domains ?? []
~~~

Complete the map with every existing type named by the spec. The accumulator has one pending Set, one timer begun by first add, flushes a copied set, then clears; dispose clears timer and set.

- [ ] **Step 4: Write failing provider lifecycle tests**

Use a fake Supabase channel/query adapter. Assert revision select cannot occur before SUBSCRIBED; initial SUBSCRIBED selects visible rows and dispatches domains; later SUBSCRIBED selects again; hidden-to-visible while unsubscribed waits for next SUBSCRIBED; unmount removes document listener and channel.

- [ ] **Step 5: Implement provider and AccountProvider mount**

Subscribe to one channel before reconciliation, with both postgres_changes bindings for notifications and operational_invalidation_versions. Keep Map<string, bigint> in a ref keyed by a collision-safe encoding of recipient_role, recipient_user_id-or-role-wide, and domain; compare only revisions for the same scope key, then emit just the domain. First reconciliation treats visible rows as stale. Notifications dispatch strativate:notifications-changed and add domainsForNotification(row.type).

~~~
channel.subscribe(status => {
  if (status !== 'SUBSCRIBED') return
  subscribedRef.current = true
  void reconcileVisibleRevisions()
})
const onVisibilityChange = () => {
  if (document.visibilityState !== 'visible') return
  if (subscribedRef.current) void reconcileVisibleRevisions()
  else reconcileWhenSubscribedRef.current = true
}
~~~

Wrap authenticated children in OperationalRealtimeProvider inside AccountProvider, retaining USER_UPDATED refresh behavior. Context exposes registration only, never entity lists.

- [ ] **Step 6: Run Task 2 tests**

Run: node --import tsx --test tests/operational-realtime.test.ts tests/operational-realtime-provider.test.ts

Expected: PASS for post-subscription fetch, reconnect, visibility deferral, union coalescing, stale suppression, cleanup.

### Task 3: Route existing Mentee, Mentor, calendar, availability, and notification consumers through domains

**Files:**
- Modify: components/dashboard/dashboard-topbar-actions.tsx
- Modify: components/dashboard/notification-center.tsx
- Modify: components/calendar/role-calendar.tsx
- Modify: app/dashboard/dashboard-client.tsx
- Modify: mentor availability editor located from its existing load() implementation
- Modify: components/mentor/mentor-dashboard-client.tsx
- Create: tests/operational-realtime-consumers.test.ts

**Interfaces:**
- Consumes useOperationalInvalidation(domains, callback).
- Produces targeted canonical loader calls while preserving notification presentation.

- [ ] **Step 1: Write failing consumer contract tests**

Assert topbar/notification center no longer create Realtime channels; RoleCalendar registers calendar/provider and calls current-range loader; Mentee availability calls load(false) for availability; snapshot dashboards register only snapshot domains and call router.refresh once per coalesced callback.

- [ ] **Step 2: Run test to verify it fails**

Run: node --import tsx --test tests/operational-realtime-consumers.test.ts

Expected: FAIL while independent channels and generic operational-refresh wiring remain.

- [ ] **Step 3: Replace duplicate notification transport**

Keep initial load/mark-read behavior, remove notification channel setup, listen to strativate:notifications-changed and invoke existing loader. Derive categories/type handling from notificationMetadata, eliminating raw duplicate type lists.

- [ ] **Step 4: Register canonical consumers**

~~~
useOperationalInvalidation(['calendar', 'provider'], () => { void load() })
useOperationalInvalidation(['availability'], () => { void load(false) })
useOperationalInvalidation(['commerce', 'cart', 'library', 'mentoring'], () => router.refresh())
useOperationalInvalidation(['mentor-dashboard', 'mentoring', 'provider'], () => router.refresh())
~~~

Use real existing closure dependencies. Do not include calendar/availability in Mentee server snapshot refresh where targeted loaders exist. Preserve range, filters, selection, dialogs, retry state, and stable keys.

- [ ] **Step 5: Run Task 3 tests**

Run: node --import tsx --test tests/operational-realtime-consumers.test.ts

Expected: PASS with shared transport and targeted loaders.

### Task 4: Register Admin loaders and preserve scheduling-dialog state

**Files:**
- Modify: Admin commerce operations component with load()
- Modify: components/admin/private-mentoring-enrollment-management.tsx
- Modify: components/admin/intensive-mentoring-session-management.tsx
- Modify: components/admin/admin-schedule-dialog.tsx
- Modify: Cart Links history component with loadHistory()
- Modify: mentor invitations component with load()
- Create: tests/operational-realtime-admin-consumers.test.ts
- Modify/Create: scheduling-dialog test beside existing component tests

**Interfaces:**
- Consumes Task 2 hook; callbacks use named existing loaders, never revision rows directly.

- [ ] **Step 1: Write failing Admin and slot-validity tests**

Test commerce uses commerce/admin-overview; Private/Intensive use mentoring/provider; Cart Links uses cart-links; invitations uses mentor-invitations. Select a slot, reload without it, expect selectedSlotId cleared; reload with it, expect selectedSlotId and filters retained.

- [ ] **Step 2: Run test to verify it fails**

Run: node --import tsx --test tests/operational-realtime-admin-consumers.test.ts

Expected: FAIL before domain hooks and state-preserving loader exist.

- [ ] **Step 3: Add targeted Admin hooks**

~~~
useOperationalInvalidation(['commerce', 'admin-overview'], () => { void load() })
useOperationalInvalidation(['mentoring', 'provider'], () => { void Promise.all([load(), loadSessions()]) })
useOperationalInvalidation(['cart-links'], () => { void loadHistory() })
useOperationalInvalidation(['mentor-invitations'], () => { void load() })
~~~

Keep existing errors/loaders and do not reset paging, sort, filters, selected record, or dialogs.

- [ ] **Step 4: Refactor schedule-dialog reload around current filters**

Give existing slot loader resetForNewSession: boolean. Opening effect calls loadSlots(true); invalidation calls loadSlots(false), preserves filters, and validates selected ID against fetched slots.

~~~
const loadSlots = async (resetForNewSession: boolean) => {
  const slots = await fetchSlots(resetForNewSession ? defaultFilters : filters)
  setSlots(slots)
  setSelectedSlotId(current => current && slots.some(slot => slot.id === current) ? current : null)
}
useOperationalInvalidation(['calendar', 'availability', 'provider'], () => { if (open) void loadSlots(false) })
~~~

- [ ] **Step 5: Run Task 4 tests and make aggregate Realtime commit**

Run: node --import tsx --test tests/operational-realtime-admin-consumers.test.ts tests/operational-realtime-consumers.test.ts tests/operational-realtime.test.ts tests/operational-realtime-provider.test.ts tests/operational-realtime-migration.test.ts

Expected: PASS. If disposable database exists, run pnpm test:db.

~~~
git add supabase/migrations/202609200006_operational_realtime_invalidation.sql supabase/tests/operational_realtime.sql scripts/test-database.ts lib/database.types.ts lib/realtime components/realtime components/auth/account-provider.tsx components/dashboard components/calendar components/admin tests
git commit -m "feat: synchronize operational views with bounded realtime revisions"
~~~

### Task 5: Add Admin-only current-session email and password security

**Files:**
- Create: components/auth/admin-account-security.tsx
- Modify: components/auth/profile-form.tsx
- Create: tests/admin-account-security.test.ts
- Modify: existing authentication validation/error test if it owns passwordError

**Interfaces:**
- Consumes current account { id, role, email }, browser Supabase client, existing PasswordInput/passwordError.
- Produces AdminAccountSecurity rendered only when account.role === admin.

- [ ] **Step 1: Write failing account-security tests**

Mock current-session Auth. Assert non-Admin render has no controls; unchanged/malformed email never calls Auth; email calls updateUser({ email }); response email mismatch displays confirmation-pending and retains displayed address; password direct call uses { password }; reauthentication_needed shows continuation; it calls reauthenticate then updateUser({ password, nonce }); success/failure/cancel clear fields; no storage API is called.

- [ ] **Step 2: Run test to verify it fails**

Run: node --import tsx --test tests/admin-account-security.test.ts

Expected: FAIL with missing component/export.

- [ ] **Step 3: Implement Admin email change**

Render only in Admin Profile branch. Validate trimmed email and reject equality to canonical current email. Call auth.updateUser({ email }); if data.user.email differs, report confirmation pending and retain current display; otherwise use established account/session refresh. Never accept target UUID, call admin Auth APIs, use service keys, or write Auth fields to application tables.

- [ ] **Step 4: Implement password and nonce continuation**

~~~
const result = await supabase.auth.updateUser({ password })
if (result.error?.code === 'reauthentication_needed' || result.error?.code === 'reauth_nonce_missing') {
  setReauthRequired(true)
  return
}
const sendNonce = async () => { const { error } = await supabase.auth.reauthenticate(); if (error) setFormError(error.message) }
const confirmNonce = async () => supabase.auth.updateUser({ password, nonce })
~~~

Apply existing policy/confirmation before calls. Keep password only during requested nonce continuation; clear after success, cancel, expiry/invalid nonce, and terminal error. Render no current-password field; never log, serialize, route, or store password/nonce.

- [ ] **Step 5: Run Task 5 tests and make final feature commit**

Run: node --import tsx --test tests/admin-account-security.test.ts

Expected: PASS.

~~~
git add components/auth/admin-account-security.tsx components/auth tests/admin-account-security.test.ts docs/superpowers/plans/2026-09-20-operational-realtime-admin-security.md
git commit -m "feat: add secure admin account email and password controls"
~~~

### Task 6: Verify integrated branch and hand off safely

**Files:**
- Modify only if verification finds a concrete requirement miss in files already touched.

**Interfaces:**
- Consumes committed branch and prior tests.
- Produces verified pushed branch and one unmerged PR to main.

- [ ] **Step 1: Run focused tests**

Run: node --import tsx --test tests/operational-realtime-migration.test.ts tests/operational-realtime.test.ts tests/operational-realtime-provider.test.ts tests/operational-realtime-consumers.test.ts tests/operational-realtime-admin-consumers.test.ts tests/admin-account-security.test.ts

Expected: PASS.

- [ ] **Step 2: Run repository checks**

Run pnpm test, pnpm typecheck, pnpm lint, and pnpm build.

Expected: each exits 0. Run pnpm test:db only with disposable TEST_DATABASE_URL accepted by existing guard; otherwise report it as safety-blocked, not passed.

- [ ] **Step 3: Perform multi-actor QA**

Use isolated Admin, Mentor, Mentee A, and Mentee B sessions. Verify RLS, update propagation after subscribe/reconnect/visible reconciliation, current calendar/availability views, dialog slot invalidation, notification bell/history, fulfillment at actual commit boundaries, and Admin UUID/role/secret safety.

- [ ] **Step 4: Review scope, push, and open one PR**

Run git diff main...HEAD --check, inspect git log --oneline main..HEAD for three commits total, and inspect git status --short. Confirm no external helper grant, direct client revision writes, business table publication solely for invalidation, or unrelated marketing/onboarding/UI changes. Push once and create one PR to main; do not merge.

## Self-Review

- Spec coverage: Task 1 implements structured bounded rows, trusted atomic bumps, RLS, producer boundaries, deferred fulfillment, and executable isolation. Task 2 implements mapping, coalescing, channel lifecycle, and post-subscription reconciliation. Tasks 3–4 attach every named consumer and protect local state. Task 5 implements constrained Admin Auth. Task 6 verifies and opens the required unmerged PR.
- Completion-detail scan: every task names files, interfaces, commands, expected behavior, and implementation detail.
- Type consistency: every client consumer uses OperationalDomain and useOperationalInvalidation from Task 2; Task 1 emits the revision payload Task 2 reads.
- Review Focus: each high-risk case in the opening section has an owning task and explicit test.
