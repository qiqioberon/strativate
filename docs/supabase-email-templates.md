# Email delivery dan template Strativate

Strativate memakai dua jalur email yang terpisah agar responsibility dan security tetap jelas.

## Supabase Auth email

Magic-link / signup verification, password recovery, dan mentor invitation saat ini dikirim oleh Supabase Auth melalui `signInWithOtp`, `resetPasswordForEmail`, dan `inviteUserByEmail`. Karena hosted Auth Email Templates tidak disimpan sebagai runtime code, repository menyimpan source template di:

- `supabase/email-templates/magic-link.html`
- `supabase/email-templates/recovery.html`
- `supabase/email-templates/invite.html`

Terapkan template tersebut di **Supabase Dashboard → Authentication → Email Templates** dengan subject:

- Magic Link: **Verifikasi email Strativate**
- Reset Password: **Atur ulang kata sandi Strativate**
- Invite User: **Undangan menjadi Mentor Strativate**

Pastikan `{{ .ConfirmationURL }}` tetap dipakai sebagai URL CTA. Repository tidak menganggap hosted template sudah terpasang sampai perubahan di dashboard production benar-benar diverifikasi.

## Paid invoice

Invoice Shared Commerce memakai server-only transactional provider melalui Resend. Set di production environment:

```dotenv
RESEND_API_KEY=...
STRATIVATE_EMAIL_FROM="Strativate <no-reply@domain-terverifikasi>"
APP_URL=https://...
```

Jangan beri prefix `NEXT_PUBLIC_` pada credential email.

Invoice hanya dijadwalkan setelah trusted Midtrans state menjadi `paid`. Database membuat `invoice_number` yang readable, snapshot invoice, dan row `transactional_email_outbox` dengan unique idempotency key. Browser tidak dapat membaca atau menulis outbox. Duplicate webhook/status reconciliation akan menemukan row yang sama; delivery retry juga mengirim provider idempotency key yang sama.

Kegagalan provider email menandai delivery `failed` dan memberi backoff tanpa mengubah Order, fulfillment, atau paid state.

## Production checklist

1. Verifikasi sender/domain di provider transactional email.
2. Isi `RESEND_API_KEY` dan `STRATIVATE_EMAIL_FROM` hanya pada server environment.
3. Terapkan tiga Auth Email Templates + subject di Supabase Dashboard.
4. Pastikan Supabase Site URL/redirect allowlist mengarah ke origin production dan `/auth/callback`.
5. Kirim test magic link, recovery, invitation, dan paid invoice ke akun internal sebelum customer rollout.
6. Jangan log token auth, magic link, SMTP/API secret, atau full payment payload.


## Retry worker

Endpoint server-only `GET /api/internal/email-outbox` akan mencoba delivery yang `pending`, `failed`, atau stale `processing`. Endpoint wajib memakai:

```
Authorization: Bearer <CRON_SECRET>
```

Jadwalkan endpoint tersebut dari Vercel Cron atau scheduler tepercaya dengan interval operasional yang sesuai. Jangan expose `CRON_SECRET` ke browser. Retry memakai row outbox dan provider idempotency key yang sama, sehingga retry tidak membuat invoice baru.
