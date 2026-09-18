import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { escapeEmailHtml, formatInvoiceRupiah, renderPaidInvoiceEmail } from '../lib/email/templates'

test('paid invoice email escapes database-controlled values and renders trusted order details', () => {
  const rendered = renderPaidInvoiceEmail({
    invoiceNumber: 'STR-INV-202609-000123',
    orderId: 'order-1',
    paidAt: '2026-09-19T00:00:00.000Z',
    buyer: { name: '<script>alert(1)</script>', email: 'buyer@example.com' },
    items: [{ kind: 'private_mentoring', name: 'Business <Case>', unitPriceAmount: 250000 }],
    subtotalAmount: 250000,
    totalAmount: 250000,
    currencyCode: 'IDR',
    payment: { provider: 'midtrans', method: 'bank_transfer', transactionReference: 'txn-1' },
  }, 'https://strativate.example')

  assert.equal(escapeEmailHtml('<b>"x"</b>'), '&lt;b&gt;&quot;x&quot;&lt;/b&gt;')
  assert.match(rendered.html, /Business &lt;Case&gt;/)
  assert.doesNotMatch(rendered.html, /<script>/)
  assert.match(rendered.html, /LUNAS/)
  assert.match(rendered.text, /txn-1/)
  assert.match(formatInvoiceRupiah(250000), /250\.000/)
})

test('paid delivery is a non-blocking consequence of verified Midtrans paid application', () => {
  const source = readFileSync('lib/payments/application.ts', 'utf8')
  assert.match(source, /status\.normalizedStatus === 'paid'/)
  assert.match(source, /deliverPaidInvoiceForOrder\(attempt\.order_id\)/)
  assert.match(source, /Paid invoice delivery could not be started/)
})

test('invoice migration guarantees readable identity, durable dedupe, safe retry and service-role delivery', () => {
  const sql = readFileSync('supabase/migrations/202609190001_transactional_email_invoices.sql', 'utf8')
  assert.match(sql, /STR-INV-/)
  assert.match(sql, /idempotency_key text not null unique/)
  assert.match(sql, /for update skip locked/)
  assert.match(sql, /next_attempt_at/)
  assert.match(sql, /orders_invoice_number_unique/)
  assert.doesNotMatch(sql, /exception when others then[\s\S]*?null;/)
  assert.match(sql, /grant execute on function public\.claim_paid_invoice_delivery\(uuid\) to service_role/)
  assert.match(sql, /grant execute on function public\.list_due_paid_invoice_orders\(integer\) to service_role/)
  assert.doesNotMatch(sql, /grant execute on function public\.claim_paid_invoice_delivery\(uuid\) to authenticated/)
})

test('transactional provider and retry worker stay server-only', () => {
  const client = readFileSync('lib/email/email-client.ts', 'utf8')
  const worker = readFileSync('app/api/internal/email-outbox/route.ts', 'utf8')
  const env = readFileSync('.env.example', 'utf8')
  assert.match(client, /import 'server-only'/)
  assert.match(client, /Idempotency-Key/)
  assert.match(client, /process\.env\.RESEND_API_KEY/)
  assert.match(worker, /process\.env\.CRON_SECRET/)
  assert.match(worker, /Authorization|authorization/)
  assert.doesNotMatch(client, /NEXT_PUBLIC_RESEND/)
  assert.doesNotMatch(env, /NEXT_PUBLIC_RESEND_API_KEY/)
})

test('auth email template sources keep clear context-specific copy and confirmation CTA', () => {
  const magic = readFileSync('supabase/email-templates/magic-link.html', 'utf8')
  const recovery = readFileSync('supabase/email-templates/recovery.html', 'utf8')
  const invite = readFileSync('supabase/email-templates/invite.html', 'utf8')
  assert.match(magic, /Verifikasi email/)
  assert.match(recovery, /Atur ulang kata sandi/)
  assert.match(invite, /Selesaikan akun mentor/)
  for (const source of [magic, recovery, invite]) {
    assert.match(source, /STRATIVATE/)
    assert.match(source, /\{\{ \.ConfirmationURL \}\}/)
  }
})

test('mentoring modal has one scroll flow and persisted mentee competition has view-edit-save states', () => {
  const admin = readFileSync('components/admin/private-mentoring-enrollment-management.tsx', 'utf8')
  const css = readFileSync('app/admin-mentoring-scheduling.css', 'utf8')
  const mentee = readFileSync('components/dashboard/private-mentoring-sessions.tsx', 'utf8')
  assert.match(admin, /mentoring-session-dialog-flow/)
  assert.match(css, /mentoring-session-dialog-flow[^}]*[\s\S]*?overflow-y:auto/)
  assert.match(css, /mentoring-session-dialog-flow[^}]*\.schedule-slot-list[\s\S]*?max-height:none[\s\S]*?overflow:visible/)
  assert.match(mentee, /competition-readonly/)
  assert.match(mentee, /editingCompetitions/)
  assert.match(mentee, /Simpan lomba/)
  assert.match(mentee, /<Pencil/)
})

test('shared calendar legend is compact, searchable, dismissible and keeps stable event colors', () => {
  const calendar = readFileSync('components/calendar/role-calendar.tsx', 'utf8')
  assert.match(calendar, /calendar-legend-menu/)
  assert.match(calendar, /Cari participant/)
  assert.match(calendar, /closeOutside/)
  assert.match(calendar, /localeCompare\(b\.name,'id-ID'\)/)
  assert.match(calendar, /personColor/)
  assert.doesNotMatch(calendar, /legend\.slice\(0, 12\)/)
})

test('notification history paginates while admin, mentee and mentor expose the shared history', () => {
  const history = readFileSync('components/dashboard/notification-center.tsx', 'utf8')
  const admin = readFileSync('app/admin/page.tsx', 'utf8')
  const mentee = readFileSync('app/dashboard/dashboard-client.tsx', 'utf8')
  const mentor = readFileSync('components/mentor/dashboard/mentor-secondary-sections.tsx', 'utf8')
  const topbar = readFileSync('components/dashboard/dashboard-topbar-actions.tsx', 'utf8')
  assert.match(history, /const PAGE_SIZE = 20/)
  assert.match(history, /\.range\(0, Math\.max\(0, limit - 1\)\)/)
  assert.match(history, /Muat lebih banyak/)
  assert.match(history, /Buka terkait/)
  assert.match(admin, /'Notifications'/)
  assert.match(mentee, /onOpenRelated/)
  assert.match(mentor, /onOpenRelated/)
  assert.match(topbar, /head:true/)
  assert.match(topbar, /unreadCount/)
})
