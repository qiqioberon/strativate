# Admin operations, analytics and payment receipts

Apply these forward migrations in order before deploying the matching application:

1. `202610150001_weekly_mentoring_reporting.sql`
2. `202610150002_categorized_supporting_materials.sql`
3. `202610150003_discount_code_analytics.sql`
4. `202610150004_payment_receipts.sql`

They depend on the existing migrations through `202610080003_about_featured_stories_fixed_slots.sql`,
including the shared sales reporting views, mentoring operations, and Trusted Partners.
No new environment variables are required. Use the existing Supabase authentication
configuration. Install the committed lockfile with the existing pnpm package manager.

Weekly Analytics combines Private and Intensive session records. The default week
starts Monday at 00:00 Asia/Jakarta and ends at the next Monday, exclusively.
Only a session's current scheduled start attributes it to a reporting period;
rescheduling moves that same session to its new period. Status and mentor assignment
come from the canonical session, including inactive mentors. Completion rate is
completed divided by all dated sessions except cancelled sessions. Undated sessions
are separately reported across all dates under the same non-date filters. No payroll
or mentor compensation calculations are included.

Reports reuse this session read model for their selected business-date range.
Paid-order revenue follows the existing payment-date and legacy fallback rules;
purchased session entitlements and completed session records remain distinct.

Discount Analytics counts one paid order with a redeemed reservation as one
successful redemption. Reserved/released reservations and payment retries do not
increase usage. Monetary values and historical paid-time fallbacks reuse the sales
reporting facts. Campaign, collaboration, partner, and applicable-category metadata
describe the code's current configuration; unknown historical attribution stays
empty. Institution and referral fields describe recorded customer origin, separately
from commercial partnership attribution.

Both reporting models aggregate on the server and paginate their detail tables.
Weekly XLSX exports contain all filtered records across summary, mentor, mentee,
session-detail, and undated-review sheets, with a 50,000-session / 64 MB limit.
Discount CSV/XLSX exports include all matching usage, with a 25,000-order,
100,000-item / 32 MB limit. Larger exports fail with a request to narrow filters;
neither silently exports only a visible page. Text is sanitized for spreadsheet
formula injection.

Categorized materials use nullable `supporting_material_entries` JSONB. NULL retains
the historical `supporting_materials` array as Additional Materials. New writes
normalize and validate a maximum of 20 entries and mirror their plain values to the
legacy array. Existing preference RPC callers remain compatible. Closed-session
immutability, audit history, Calendar invalidation, and authorization are preserved.

The authenticated `/api/orders/[id]/receipt` route produces real PDFs for paid orders.
Order owners and authorized admins use the same guarded RPC and template. Receipts
reuse historical monetary/item snapshots, never current catalog prices. Existing
invoice numbers are retained; missing numbers use the actual order UUID reference.
Responses are private and uncached; `?download=1` sets attachment disposition.
The PDF is a payment receipt, without invented tax, seller-address, or legal fields.
Bundled approved branding and the licensed Poppins font are included in the server
route trace, with no external PDF service or runtime font download.

Migration execution, tests, lint, typecheck, build, and runtime verification were
not performed for this implementation, as requested.
