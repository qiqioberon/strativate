# Mentor Domain Phase 1 Design

## Objective

Build the canonical operational Mentor Domain on top of `origin/main` at
`3e98d25` without redesigning authentication, Product Catalog, public mentor
marketing, scheduling, checkout, or other future domains.

Phase 1 covers mentor accounts, operational mentor profiles and tiers, tiered
mentor invitations, recurring weekly availability, admin mentor management,
mentor availability management, and regression protection for public and
role-protected routes.

## Baseline and boundaries

- `auth.users` remains the identity provider and `profiles` remains the generic
  account record.
- `profiles.mentor_setup_completed_at` remains account-setup metadata and is not
  moved.
- Existing password, invitation acceptance, mentor setup, and role-based
  destination behavior remain intact.
- `lib/content/mentors.ts`, public mentor cards, portraits, credentials, and all
  marketing mentor content remain unchanged.
- Product Catalog is not redesigned. `catalog_mentor_tiers` remains the
  catalog-specific tier definition used by Private Mentoring products,
  offerings, public views, admin catalog editing, and catalog tests.
- Scheduling, mentor assignment, sessions, Google Calendar, checkout, orders,
  notifications, ratings, and analytics remain out of scope.
- No remote Supabase migration is run. Database verification uses only a local
  disposable database named `strativate_test_*`.

## Ownership model

After Phase 1, each current responsibility has one authoritative source:

```text
AUTH DOMAIN
├── auth.users
├── profiles
└── mentor_invites

MENTOR DOMAIN
├── mentor_profiles
├── mentor_tiers
└── mentor_availability_rules

PRODUCT CATALOG
└── catalog_mentor_tiers (temporary catalog-specific legacy model)

PUBLIC MENTOR MARKETING
└── lib/content/mentors.ts (intentionally unchanged)
```

`mentor_tiers` is authoritative for an operational mentor's tier.
`catalog_mentor_tiers` describes the commercial tier attached to a catalog
offering and is not consulted when assigning a mentor account. Connecting the
two models belongs to the future Private Mentoring redesign.

## Database model

### `mentor_tiers`

```text
id          uuid primary key
code        unique uppercase machine code
name        unique display name
sort_order  integer
is_active   boolean
created_at  timestamptz
updated_at  timestamptz
```

Seed exactly:

- `TOP_STUDENT` / `Top Student`
- `YOUNG_PROFESSIONAL` / `Young Professional`

The seed rows use stable UUIDs. Admin assignment and new invitations accept
only active tiers. An inactive tier remains readable on a mentor who was
assigned previously, but it is not offered for a new assignment.

### `mentor_profiles`

```text
user_id     uuid primary key references profiles(id) on delete cascade
tier_id     uuid nullable references mentor_tiers(id)
timezone    text not null default 'Asia/Jakarta'
created_at  timestamptz
updated_at  timestamptz
```

Only a `profiles.role = 'mentor'` account may own a mentor profile. Database
triggers enforce this invariant and ensure every account promoted or created as
a mentor receives a mentor-profile row. Existing mentor accounts are backfilled
with `tier_id = NULL`; no tier is inferred from marketing or Product Catalog.

Changing an operational tier is allowed only through an admin-authorized RPC.
A mentor may read the mentor profile and tier assigned to their own account but
cannot change it.

### `mentor_invites`

Add nullable `tier_id references mentor_tiers(id)` to the existing registry.
Nullability is retained only so already-existing tierless invitations can
continue through the established flow.

A database trigger enforces these transition rules:

- every newly inserted invitation requires a non-null active tier;
- a tiered invitation cannot be cleared or changed to an inactive tier;
- an existing legacy invitation whose tier is already null may continue through
  its existing status and account-link transitions;
- retrying a failed legacy invitation through the admin UI requires selecting
  an active tier.

The server invitation action also rejects a missing or inactive tier after
authenticating the caller as an admin. Browser `required` validation is only a
usability aid.

Both trusted Auth paths are updated: an Auth user inserted with trusted
`invited_at`, and GoTrue's insert-then-update invitation transaction. When a new
tiered invitation creates or promotes a mentor account, the same trusted flow
must create the corresponding `mentor_profiles` row with exactly the registry's
`tier_id`. The trigger raises and rolls back if a tiered invitation would finish
without that tier. Legacy tierless invitations may create a tierless mentor
profile.

### `mentor_availability_rules`

```text
id           uuid primary key
mentor_id    uuid references mentor_profiles(user_id) on delete cascade
day_of_week  smallint, 1 = Monday through 7 = Sunday
start_time   time without time zone
end_time     time without time zone
created_at   timestamptz
updated_at   timestamptz
```

`start_time < end_time` is a check constraint. A GiST exclusion constraint over
mentor, weekday, and a half-open time range prevents overlaps while allowing
adjacent ranges such as `09:00–12:00` and `12:00–14:00`. The mentor timezone is
stored only on `mentor_profiles`.

Authenticated users receive read access only to rows allowed by RLS: mentors
see their own rules and admins see all rules. Direct authenticated mutations
are not granted. A single security-definer RPC replaces the complete weekly
configuration in one transaction after validating ownership, target role,
JSON shape, weekday, times, and overlap rules. Mentors may target only
themselves; admins may target any mentor. Empty input means unavailable all
week.

## Read and mutation interfaces

The migration provides these application boundaries:

- `list_managed_mentors(offset, query, tier, setup_status)` returns admin-only
  account identity, operational tier, setup state, timezone, and a derived
  availability-configured flag. Email is joined from `auth.users` only inside
  this restricted function.
- `list_mentor_invites(offset)` keeps its current name and deletion semantics,
  but adds tier identity and label for the integrated pending-invitation view.
- `set_mentor_tier(mentor_id, tier_id)` is admin-only, accepts only an existing
  mentor and active tier, and returns the updated operational profile.
- `save_mentor_availability(mentor_id, rules)` atomically replaces a week and
  returns its sorted persisted rows.

The existing `delete_mentor_invite`, `complete_mentor_setup`, bootstrap, and
invitation-assignment behavior remain, with only the changes required to create
and populate `mentor_profiles` safely.

## Application architecture

### Admin mentor management

The existing admin shell and its `Mentors` navigation item remain. The generic
mentor branch of `PeopleManagement` is replaced with focused components:

- a tier-aware invitation form;
- searchable/filterable active mentor list;
- pending invitation list integrated into the same management surface;
- reusable inline tier selector;
- an in-page Manage panel containing account summary and weekly availability.

Tier remains editable directly in every mentor list row. The Manage panel is
not the exclusive tier-editing location. Tier saves are pessimistic: the
selector is disabled while the RPC runs, success is announced, and a failure
restores/refetches the authoritative value while showing a readable error.

The page distinguishes active mentor accounts from pending, sent, and failed
invitations. Search covers mentor name, username, and email; filters cover tier
and setup/account state without inventing a new persisted account-status model.

### Mentor dashboard

The dashboard retains its existing shell and unfinished demo-only sections.
The Availability section becomes a focused Supabase-backed editor supporting
zero or more ranges for all seven days. It loads the mentor's operational tier,
timezone, and current rules; allows adding, changing, and removing ranges; and
saves the whole week through the atomic RPC.

Client validation reports malformed or overlapping ranges before submission,
while PostgreSQL remains authoritative. A failed save retains the local form
state. A successful save replaces it with the database response so refreshes
show the same values. The existing hardcoded availability display and fake
availability-hours metric are removed rather than left as competing state.

The same availability editor is reused by the admin Manage panel with an
explicit mentor target.

### Public and protected routing

The current root page is already public and the proxy matcher does not redirect
authenticated sessions away from `/`. That working behavior is preserved and
covered by regression tests. `/admin`, `/mentor/dashboard`, `/dashboard`,
`/onboarding`, and checkout routes retain their current authentication and role
checks. Successful authentication may still continue to the role destination;
users remain free to navigate back to public marketing pages afterward.

## Error behavior

- Missing or inactive tiers are rejected by both the server action and database
  invariant before an invitation is sent.
- A tiered invitation that cannot propagate its tier aborts the trusted account
  transition rather than producing a silently tierless mentor.
- Admin list, tier, invitation, and availability errors keep useful form state
  and display an Indonesian error message.
- Failed tier changes refetch the authoritative mentor record.
- Failed weekly saves roll back the entire database operation and preserve the
  editor's unsaved values.
- Public query failures and unrelated demo domains are not given fallback
  mentor-domain data.

## Cleanup decisions

Removed or replaced in Phase 1:

- hardcoded weekly availability rows in the mentor dashboard;
- fabricated availability-hours display tied to those rows;
- the mentor-specific branch of the rough generic people-management UI.

Migrated:

- existing mentor accounts to nullable-tier `mentor_profiles` rows;
- existing trusted invitation triggers to populate the operational profile and
  propagate a tier when one exists;
- the invitation registry and list interface to carry operational tier data.

Kept temporarily:

- `catalog_mentor_tiers`, because catalog offerings, public views, Product
  Catalog admin, bootstrap data, RLS, generated types, and SQL tests depend on
  it;
- hardcoded public mentor marketing data, by explicit phase boundary;
- demo mentor-assignment names and records, because Mentor Assignment is an
  unfinished future domain and Phase 1 does not replace its persistence.

No existing database table or RPC is dropped merely for having a mentor-related
name. Before completion, repository-wide searches cover every changed database
object to detect stale queries, types, grants, policies, triggers, tests, and
demo availability state.

## Test strategy

Tests are written before production changes and observed failing for the
expected missing behavior.

Database tests prove:

- admin tier assignment and change;
- mentor and mentee tier mutation denial;
- active-tier enforcement for new and retried invitations;
- compatibility for pre-migration tierless invitations and mentors;
- exact invitation-tier propagation through both trusted Auth paths;
- mentor/admin availability read and mutation rights;
- cross-mentor and mentee mutation denial;
- invalid weekday, invalid time order, and overlapping ranges rejection;
- adjacent ranges and atomic whole-week replacement;
- Product Catalog tier tables and existing catalog tests remain intact.

Unit tests cover deterministic availability normalization and overlap messages,
day ordering, UI view-model derivation, and public/protected route
classification. Browser tests preserve the public landing page and anonymous
protection behavior without modifying public mentor marketing.

The final verification commands are:

```bash
pnpm test
pnpm test:db -- --bootstrap
pnpm typecheck
pnpm lint
pnpm build
pnpm exec playwright test --workers 3
```

## Success criteria

Phase 1 is complete when the operational mentor tier has one authoritative
source, new tiered invitations cannot produce tierless mentors, existing legacy
records remain safe without fabricated tiers, weekly availability persists
atomically under database authorization, admin tier editing remains directly in
the mentor list, the admin and mentor experiences use real Supabase data, public
marketing remains unchanged, protected routing remains correct, Product Catalog
continues to pass unchanged responsibilities, and the complete verification
suite passes without touching the remote Supabase project.
