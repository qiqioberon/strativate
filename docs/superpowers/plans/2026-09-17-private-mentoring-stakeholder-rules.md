# Private Mentoring Stakeholder Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align Private Mentoring and Intensive Mentoring commerce/fulfillment with the 17 September 2026 stakeholder rules without regressing Shared Commerce, Calendar/Meet sync, or historical order snapshots.

**Architecture:** Keep orders/order_items as immutable commercial truth, create one Private enrollment per paid Private order item, and add a normalized Intensive entitlement per paid Intensive order item. Keep session lifecycle separate from topic review state; mentee requests are append-audited and admin resolution is required before scheduling. For Private packages with at least five sessions, store the default mentor on the enrollment and enforce it in both slot discovery and the scheduling RPC, with explicit reassignment history.

**Tech Stack:** PostgreSQL/Supabase RLS + SECURITY DEFINER RPCs, Next.js 16, React 19, TypeScript, Google Calendar API, Node test runner, Playwright.

**Spec:** Stakeholder requirements supplied in the 17 September 2026 project conversation; source conflicts are recorded in `docs/strativate/source-conflicts.md`.

## Global Constraints

- Work from latest `main`, push directly to `main`, no force push, maximum three commits.
- Forward migration only; preserve historical migrations and immutable `order_items` snapshots.
- Session Focus is taxonomy, not a commerce SKU; do not add quantity semantics to Shared Commerce.
- Multiple Private enrollments and Private + Intensive entitlements may coexist for one mentee.
- Packages with `purchased_sessions >= 5` require an enrollment-level primary mentor for new scheduling.
- Topic request state is separate from session lifecycle state; completed/cancelled sessions are immutable for topic edits.
- Calendar updates must patch the existing deterministic event, not create duplicate events.

---

### Task 1: Business-rule contract tests

**Files:**
- Create: `tests/private-mentoring-business-rules.test.ts`
- Create: `supabase/tests/private_mentoring_business_rules.sql`
- Modify: `scripts/test-database.ts`

**Interfaces:**
- Consumes: current Shared Commerce, Private Mentoring, Google Calendar, Intensive catalog schema.
- Produces: executable contract for topic review, primary mentor enforcement/history, repeat/multi-item purchase, and Intensive entitlement fulfillment.

- [ ] Write static tests that require the forward migration, new RPCs, UI request/resolve flows, and Calendar resolved-topic patch behavior.
- [ ] Run the unit test and verify RED because the forward migration and new UI/RPC contracts do not yet exist.
- [ ] Add the disposable database contract and register it in `test:db`, superseding the obsolete Phase 3 focus-auto-approval test.

### Task 2: Forward database migration

**Files:**
- Create: `supabase/migrations/202609170003_private_mentoring_stakeholder_rules.sql`

**Interfaces:**
- Produces: `submit_private_mentoring_topic_request`, `admin_resolve_private_mentoring_session_topic`, `admin_set_private_mentoring_primary_mentor`, `list_eligible_private_mentoring_enrollment_mentors`, Intensive commerce resolver/fulfillment, and updated projections.

- [ ] Add topic request/resolution columns and append-only topic event history.
- [ ] Backfill historical focused sessions as confirmed without inventing custom requests.
- [ ] Add enrollment primary mentor + reassignment history and safe single-mentor backfill for `>=5` session enrollments.
- [ ] Enforce topic confirmation and primary mentor at scheduling RPC and slot-context levels.
- [ ] Register fixed Intensive package/bundle/add-on Commerce Items; keep consultation unavailable.
- [ ] Fulfill paid Intensive order items into normalized, idempotent entitlements.
- [ ] Extend owner/admin/mentor projections with only role-appropriate topic data.

### Task 3: Application and UI integration

**Files:**
- Modify: `components/dashboard/private-mentoring-sessions.tsx`
- Modify: `components/admin/private-mentoring-enrollment-management.tsx`
- Modify: `components/admin/admin-schedule-dialog.tsx`
- Modify: `lib/private-mentoring/types.ts`
- Modify: `lib/private-mentoring/server.ts`
- Modify: `lib/private-mentoring/scheduling-server.ts`
- Modify: `lib/google-calendar/server.ts`
- Modify: `lib/mentor/dashboard.ts`
- Modify: mentor assignment/detail components as needed.

**Interfaces:**
- Mentee writes only through `submit_private_mentoring_topic_request`.
- Admin resolves through `admin_resolve_private_mentoring_session_topic` and retries/syncs the same Calendar event when a scheduled topic changes.
- Scheduler consumes the primary-mentor-filtered DB context.

- [ ] Replace focus-only mentee input with required free-text goal + optional structured category and review-state copy.
- [ ] Add admin primary mentor Set/Change control with reassignment reason and topic resolution controls inside the enrollment dialog.
- [ ] Show resolved topic/session goal and mentor-visible notes to assigned mentors.
- [ ] Use resolved topic in Calendar summary/description while preserving deterministic event identity.

### Task 4: Types, docs, and verification

**Files:**
- Modify: `lib/supabase/database.types.ts`
- Modify: `docs/strativate/source-conflicts.md`
- Modify: `docs/strativate/asset-status.md`

- [ ] Update typed database/domain projections without introducing broad new `any` usage.
- [ ] Add a dated 17 September 2026 source-conflict resolution that explicitly supersedes the old Phase 3 assumptions without deleting history.
- [ ] Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and disposable `npm run test:db` when the environment supports them.
- [ ] Verify desktop/mobile mentoring dialogs if an executable browser environment is available.
- [ ] Re-fetch `origin/main`, compare from the initial SHA, fast-forward only, and push without force.
