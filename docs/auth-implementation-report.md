# Laporan implementasi auth, onboarding, dan admin — 6 September 2026

Kode aplikasi dan validasi lokal telah diimplementasikan. Aktivasi hosted belum selesai: tabel aplikasi belum tersedia pada Supabase yang terhubung (`PGRST205` melalui GET REST), Google provider nonaktif, dan belum ada `SUPABASE_DB_URL` untuk menerapkan SQL dari workspace. Tidak ada migrasi/import/user admin yang dibuat di hosted selama pekerjaan ini. Alur email, Google, serta penerimaan undangan aktual masih harus diuji setelah konfigurasi.

## Arsitektur

- Next.js 16 App Router, pnpm, TypeScript; visual shell dan tiga route dashboard lama dipertahankan.
- `/auth`: satu login email/password dan Google, registrasi email melalui OTP/magic link; tanpa pemilih role publik.
- `@supabase/ssr`: browser client, server cookie client, proxy refresh, callback PKCE/code exchange dan token-hash verification.
- Server memverifikasi `getUser`, lalu membaca profile database. `/admin`, `/mentor`, `/dashboard`, `/onboarding`, `/auth/setup`, dan checkout dilindungi. Mentee incomplete dan mentor belum setup diarahkan ke langkah wajib.
- Postgres menjadi otoritas role/progress. Tidak ada kredensial privileged pada browser; admin invitation adalah Next.js server action, bukan Edge Function.
- Wizard baru empat langkah memakai auth shell/input/button/gaya yang ada. Checkout awal ternyata belum memiliki wizard yang disebut di spesifikasi.
- Data produk/order/sesi demo yang tidak termasuk scope tetap dipertahankan; role switcher, fake auth, identitas login hard-coded dan logout palsu diganti.

## Migrasi, tabel, dan RLS

| Migrasi | Isi |
| --- | --- |
| `supabase/migrations/202609060001_auth_onboarding.sql` | pg_trgm, enum, 7 tabel, constraints/indexes, normalizer Unicode/NFC, triggers Auth/profile/password, seed referral/minat, RPC onboarding/pengajuan/merge/setup, RLS/grants |
| `supabase/migrations/202609060002_institution_import.sql` | RPC importer batch hanya untuk service role; upsert identitas resmi, rollback batch, perhitungan insert/update/skip |

| Tabel | Akses normal | Akses admin/tepercaya |
| --- | --- | --- |
| `profiles` | Baca sendiri, update kolom nama/username/avatar sendiri. Role, registration method, password marker dan setup completion terlindungi | Admin dapat membaca profil; perubahan role melalui operasi SQL/Auth tepercaya |
| `mentee_profiles` | Baca sendiri, simpan melalui RPC tervalidasi | Admin membaca; merge institusi mengubah referensi secara transaksi |
| `institutions` | Baca approved/pending milik sendiri, ajukan pending melalui RPC | Admin create/edit/approve/reject/archive/explicit merge |
| `referral_sources` | Baca opsi aktif | Admin add/edit/order/archive |
| `interests` | Baca opsi aktif | Admin add/edit/order/archive |
| `mentee_interests` | Baca sendiri; pilihan disimpan atomik via RPC | Admin membaca |
| `mentor_invites` | Tidak ada grant/policy browser | Registry invitation server-only |

Semua tabel memiliki RLS. Kolom role tidak dapat diupdate melalui client meskipun user memalsukan metadata. Username unik tanpa membedakan kapitalisasi. `(source, external_id)` unik; nama institusi tidak globally unique. Nama sama bisa diajukan sebagai record berbeda setelah konfirmasi eksplisit. Pengajuan berulang milik sendiri idempotent.

Dua detail Auth ditangani sesuai implementasi Supabase: invitation meng-update `invited_at` setelah insert user; magic-link signup dapat menyisipkan hash password sementara. Trigger role invitation mengikuti transisi tepercaya tersebut, sedangkan `password_set_at` hanya mencatat perubahan password nyata setelah email terverifikasi. Password/hash tidak disimpan di tabel aplikasi.

## File frontend dan server

| Kelompok | File |
| --- | --- |
| Auth/session | `lib/supabase/client.ts`, `server.ts`, `admin.ts`, `database.types.ts`; `lib/auth/server.ts`, `rules.ts`, `errors.ts`; `proxy.ts` |
| Halaman auth | `app/auth/page.tsx`, `callback/route.ts`, `continue/route.ts`, `error/page.tsx`, `setup/page.tsx`, `recovery/page.tsx`, `auth.css` |
| Komponen auth | `components/auth/auth-shell.tsx`, `auth-form.tsx`, `account-provider.tsx`, `sign-out.tsx`, `setup-form.tsx`, `profile-form.tsx` |
| Dashboard | `app/admin/page.tsx`, `app/mentor/page.tsx`, `app/dashboard/page.tsx`; layout guard pada masing-masing folder serta `app/checkout/layout.tsx` |
| Onboarding | `app/onboarding/page.tsx`, `components/onboarding/wizard.tsx`, `institution-picker.tsx`, `lib/onboarding/rules.ts` |
| Administrasi | `components/admin/people.tsx`, `institutions.tsx`, `master-options.tsx`; `lib/admin/invite-mentor.ts` |
| Aplikasi | `app/layout.tsx`, `app/error.tsx`, `next.config.mjs`; role switcher demo dihapus |
| Tooling | `scripts/import-institutions.ts`, `institution-data.ts`, `test-database.ts`; `eslint.config.mjs`, `playwright.config.ts`, package/lockfile, `.env.example`, `.gitignore` |

Penyimpanan onboarding melalui `save_onboarding_step`, submission melalui `submit_institution`, pencarian melalui `search_institutions` (minimal 2 karakter, debounce 300ms, maksimal 25 hasil), setup mentor melalui `complete_mentor_setup`, merge melalui `merge_institutions`.

## Dataset dan hasil importer

CSV asli ditemukan di `../institution_scraper/outputs/institutions_all.csv`; salinan reproducible ada di `supabase/seed/institutions_all.csv`.

| Hasil | Jumlah |
| --- | ---: |
| Data valid | 3.479 |
| Universitas | 2.129 |
| SMA | 421 |
| SMK | 929 |
| ID resmi kosong/duplikat di CSV | 0 |
| Insert ke PostgreSQL lokal, run pertama | 3.479 |
| Update/skipped/error run pertama | 0 / 0 / 0 |
| Insert/update run kedua | 0 / 0 |
| Skipped run kedua | 3.479 |
| Error run kedua | 0 |
| Baris diimpor ke hosted oleh pekerjaan ini | **0 — menunggu migrasi** |

CLI yang sama diuji terhadap PostgreSQL 17 lokal menggunakan `--postgres`, bukan hanya simulasi array. Mode REST Supabase memakai RPC yang sama setelah migration 002 diterapkan; transport hosted belum diuji karena skema belum tersedia.

## Bukti pengujian

| Pemeriksaan | Hasil |
| --- | --- |
| `pnpm test` | 14 tes lulus: role routing, password, username, CSV/import plan, onboarding payloads/prefill, duplikat, regresi surname kosong |
| `pnpm test:db --bootstrap` pada database baru | Kedua migrasi diterapkan; `auth_security.sql` (94 pemeriksaan) dan `institution_import.sql` lulus |
| SQL/RLS | Percobaan role admin/mentor, approval/master mutations, metadata forgery, cross-user reads/writes, pending visibility, step skipping, password requirement, inactive options, completion atomicity, invite transition ditolak/diterima sesuai aturan |
| SQL importer | Identitas berbeda dengan nama sama, repeat skip, metadata update, rollback batch gagal, perlindungan submission, execute grants lulus |
| `pnpm test:e2e` | 10 tes Chromium lulus: login/registrasi, mobile, enam route terlindungi, callback error/redirect arbitrer |
| `pnpm typecheck` | Lulus |
| `pnpm lint` | 0 error; 9 warning pada landing page lama `app/page.tsx` |
| `pnpm build` | Build produksi lulus; `ignoreBuildErrors` dihapus |
| Browser bundle secret scan | 27 file JS/JSON/map diperiksa; 0 kecocokan secret Supabase |
| Review kode | Tidak ditemukan defect otorisasi yang tersisa; defect surname Google, duplicate acknowledgement, normalizer, serta importer race accounting telah diperbaiki |

Tes browser tidak diklaim menguji penerimaan email/OAuth atau wizard authenticated hosted. RLS diuji pada Postgres nyata dengan harness Auth lokal. Pengujian penerimaan provider membutuhkan Supabase yang dikonfigurasi. Screenshot mobile tersedia sebagai artefak lokal `output/playwright/` dan tidak ikut version control.

## Tindakan manual tersisa dan prosedur penerimaan

Panduan lengkap dengan SQL dan perintah: [Supabase setup](supabase-setup.md).

1. Terapkan kedua migration berurutan ke Supabase; jalankan importer hosted.
2. Set `APP_URL` serta Site URL/redirect allowlist lokal dan produksi.
3. Enable Google dengan Client ID/Secret dan Google callback URI Supabase.
4. Ubah template magic-link/signup/invite/recovery ke token hash; konfigurasi SMTP produksi.
5. Bootstrap admin pertama: buat Auth user manually confirmed → jalankan SQL role update menggunakan UUID sebagaimana [bagian bootstrap](supabase-setup.md#4-bootstrap-admin-pertama) → login `/auth` → `/admin`.
6. [Uji email mentee](supabase-setup.md#7-uji-satu-mentee-email): email link → wajib set password → simpan langkah 1/2 → reload/logout/login → resume langkah 3 → referral/multiple interests → `/dashboard`.
7. [Uji Google mentee](supabase-setup.md#8-uji-satu-mentee-google): OAuth → username → password kosong → onboarding → logout/Google login; akun uji kedua untuk password opsional.
8. [Uji mentor](supabase-setup.md#9-undang-satu-mentor-dan-kelola-master): Admin/Mentors/Invite Mentor → email invitation → `/auth/setup` → password/nama/username → `/mentor` → reload/login ulang.

Tidak memerlukan deploy Edge Function. Deploy Next.js server dengan `SUPABASE_SECRET_KEY` sebagai secret server environment. Tidak ada push, commit, atau deployment yang dilakukan.
