# Konfigurasi Supabase Strativate

Implementasi memakai Next.js App Router dan Supabase SSR cookies. Login bersama di `/auth`; callback di `/auth/callback`. Role berasal dari `public.profiles`, bukan user metadata. Dashboard tetap `/admin`, `/mentor`, `/dashboard`; mentee yang belum selesai diarahkan ke `/onboarding`, mentor baru ke `/auth/setup`.

## 1. Environment dan migrasi

Isi `.env` mengikuti `.env.example`, tanpa menimpa kredensial yang sudah ada:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY=YOUR_SERVER_SECRET_KEY
APP_URL=http://localhost:3000
```

`SUPABASE_SECRET_KEY` hanya dipakai server action undangan dan importer. Untuk deployment gunakan secret environment variable di hosting, dan ubah `APP_URL` ke origin HTTPS produksi. Jangan tambahkan prefix `NEXT_PUBLIC_` pada secret. Restart aplikasi setelah mengubah environment.

Jalankan migrasi berurutan di Supabase SQL Editor, masing-masing sebagai satu transaksi (`BEGIN;` sebelum isi dan `COMMIT;` sesudah isi):

1. `supabase/migrations/202609060001_auth_onboarding.sql`
2. `supabase/migrations/202609060002_institution_import.sql`
3. `supabase/migrations/202609060003_invite_management_auth_ux.sql`

Untuk project yang sudah menjalankan 001 dan 002, jalankan **hanya 003 sebelum deployment revisi ini**. Migrasi 003 menambahkan pengelolaan undangan khusus admin dan mewajibkan minat dari daftar master. Jawaban minat bebas yang lama tidak dihapus massal; kolom historis dikosongkan ketika langkah minat disimpan ulang. Pilihan "Lainnya" pada sumber informasi/referral tetap tersedia.

Alternatif dengan PostgreSQL CLI dan `SUPABASE_DB_URL` yang disimpan sebagai environment variable:

```powershell
psql $env:SUPABASE_DB_URL -v ON_ERROR_STOP=1 --single-transaction -f supabase/migrations/202609060001_auth_onboarding.sql
psql $env:SUPABASE_DB_URL -v ON_ERROR_STOP=1 --single-transaction -f supabase/migrations/202609060002_institution_import.sql
psql $env:SUPABASE_DB_URL -v ON_ERROR_STOP=1 --single-transaction -f supabase/migrations/202609060003_invite_management_auth_ux.sql
```

`psql` tidak otomatis membaca `.env`; ekspor `SUPABASE_DB_URL` ke shell atau gunakan koneksi CLI dari menu **Connect** Supabase. Jangan menjalankan ulang migration 001 yang sudah diterapkan. Pada project yang memakai Supabase CLI, gunakan `supabase db push` sesuai riwayat migrasinya. Jika SQL Editor sudah dipakai terlebih dahulu, sinkronkan migration history sebelum beralih ke CLI.

Migrasi membuat `profiles`, `mentee_profiles`, `institutions`, `referral_sources`, `interests`, `mentee_interests`, dan registry privat `mentor_invites`. RLS aktif pada ketujuh tabel. Onboarding dan pengajuan institusi menggunakan RPC transaksi. Role, metode registrasi, status password, dan completion tidak dapat ditulis browser. Opsi referral/minat awal disediakan migrasi.

## 2. URL dan email

Di **Authentication → URL Configuration**:

- Site URL: origin produksi, atau `http://localhost:3000` selama pengembangan.
- Redirect URLs: `http://localhost:3000/auth/callback` dan `https://YOUR_DOMAIN/auth/callback`.
- Gunakan URL persis; hindari wildcard produksi.

Template email harus memakai token hash agar callback server dapat membentuk session cookie, termasuk bila email dibuka di browser lain. Konfigurasi tautan utama pada **Authentication → Email Templates**:

Magic Link dan Confirm Signup:

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type=email">Masuk ke Strativate</a>
```

Invite User:

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type=invite">Terima undangan mentor</a>
```

Reset Password (callback recovery tersedia; tidak ada tombol reset baru dalam lingkup ini):

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type=recovery">Atur password baru</a>
```

Semua operasi aplikasi memberikan `RedirectTo` tanpa query dan mengarah ke `/auth/callback`. Untuk undangan mentor, gunakan menu Admin aplikasi agar registry tepercaya tersedia; undangan langsung dari Dashboard Supabase tidak otomatis menjadi mentor. Template default berbasis URL fragment `#access_token` perlu diganti dengan token-hash di atas.

Aktifkan Email provider dan pendaftaran pengguna. Gunakan password policy minimal 8 karakter (aplikasi membatasi 8–128); gunakan SMTP produksi dengan domain terverifikasi. Atur rate limit dan pengiriman sesuai kebutuhan produk. Callback mengabaikan `next`/redirect arbitrer.

## 3. Google

1. Buat Google OAuth Web Client di Google Cloud dan konfigurasi consent screen/test users.
2. Authorized redirect URI Google: `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback` — ini callback provider milik Supabase.
3. Masukkan Client ID/Secret ke **Authentication → Providers → Google**, lalu enable.
4. Tambahkan callback aplikasi lokal/produksi ke redirect allowlist Supabase sebagaimana di atas.

OAuth menggunakan PKCE Supabase. Nama/avatar yang tersedia diprefill; username tetap dipilih pengguna. Password Google opsional dan tidak pernah dibuatkan password aplikasi palsu.

## 4. Bootstrap admin pertama

1. Di **Authentication → Users → Add user → Create new user**, buat user dengan email yang kamu kuasai dan password kuat. Tandai email confirmed. Jangan membuat user dengan metadata role sebagai mekanisme admin.
2. Salin UUID user dari daftar Auth Users.
3. Jalankan SQL berikut di SQL Editor tepercaya, mengganti UUID dan data contoh. SQL mengunci target serta gagal bila profil tidak ditemukan:

```sql
begin;
do $$
declare target uuid := 'REPLACE_WITH_AUTH_USER_UUID';
begin
  perform id from public.profiles where id = target for update;
  if not found then raise exception 'Auth profile not found'; end if;
  update public.profiles
  set role = 'admin', first_name = 'Admin', last_name = 'Strativate'
  where id = target;
  delete from public.mentee_profiles where user_id = target;
end $$;
commit;
```

4. Masuk melalui `/auth` dengan email/password itu. User diarahkan ke `/admin`. Tidak ada registrasi admin publik maupun API browser untuk mengganti role.

## 5. Import dataset

Dataset version-controlled: `supabase/seed/institutions_all.csv` (3.479 baris: 2.129 universitas, 421 SMA, 929 SMK). Sumber aslinya ditemukan di `../institution_scraper/outputs/institutions_all.csv`.

```powershell
pnpm import:institutions --dry-run
pnpm import:institutions --dry-run --compare
pnpm import:institutions
pnpm import:institutions
```

`--dry-run` hanya memvalidasi CSV. `--compare` juga membaca database dan melaporkan rencana insert/update/skip. Impor sebenarnya menggunakan RPC service-only, batch 200, identitas `(source, external_id)`, dan transaksi per batch. Nilai kosong di metadata opsional menjadi null. Pengajuan pengguna tidak ditimpa. Eksekusi ulang tanpa perubahan melaporkan `inserted: 0`, `updated: 0`, `skipped: 3479`.

Path CSV lain dapat diberikan sebagai argumen posisi. Bila memakai koneksi SQL langsung, simpan `SUPABASE_DB_URL` di `.env`, lalu gunakan `pnpm import:institutions --postgres`. Impor gagal dengan exit code nonzero bila CSV tidak ada, data tidak valid, atau suatu batch gagal; batch sebelumnya mungkin sudah committed dan aman dilanjutkan dengan menjalankan ulang.

## 6. Backend undangan

Tidak ada Edge Function terpisah. `lib/admin/invite-mentor.ts` adalah Next.js server action yang ikut deployment aplikasi. Hosting harus menjalankan Next.js server, bukan static export. Action memverifikasi session dengan `getUser`, membaca role admin dari database, membuat registry privat, lalu memanggil `auth.admin.inviteUserByEmail`. Trigger Auth menetapkan mentor dalam transaksi invitation sebelum email dapat diterima.

Undangan berulang yang sedang diproses/sudah terkirim tidak dikirim ulang. Kegagalan pengiriman sebelum user terbentuk dapat dicoba lagi. Jika proses server terputus sehingga registry tertinggal `pending`, periksa `mentor_invites` dan Auth Users melalui tooling admin: bila `user_id` sudah terisi dan role mentor benar, tandai registry `sent`; bila belum ada user dan tidak ada proses berjalan, tandai `failed` untuk mengizinkan percobaan ulang. Jangan menghapus/mengganti akun aktif untuk mengulang undangan.

Admin → Mentors kini memiliki **Undangan mentor**, termasuk status gagal yang belum memiliki profil. Tombol **Hapus** meminta konfirmasi email tujuan. RPC `delete_mentor_invite` menghapus registry serta akun Auth/profil yang terkait dalam satu transaksi, hanya jika akun undangan belum dikonfirmasi, belum pernah login, belum menyimpan password, dan belum menyelesaikan setup. Token undangan lama tidak berlaku setelah akun dihapus, dan email dapat diundang kembali. Akun aktif serta undangan `pending` dilindungi; kegagalan penghapusan akun membatalkan penghapusan registry juga. Tidak ada grant baca/tulis langsung registry untuk browser. RPC daftar dan hapus memverifikasi role admin dari database setiap kali dipanggil.

## 7. Uji satu mentee email

1. Buka browser privat, `/auth` → **Belum punya akun? Daftar**. Masukkan email milikmu dan kirim tautan.
2. Klik email. Callback membentuk session dan membuka langkah **Data Diri**. Profile harus `mentee` walaupun ada metadata role lain.
3. Isi nama, username unik, password minimal 8 karakter, konfirmasi. Lanjutkan; cek `profiles` dan `mentee_profiles` lewat SQL Editor.
4. Cari institusi minimal dua karakter; pilih hasil atau ajukan dengan tipe yang sesuai. Pengajuan baru `pending`, `user_submission`, dan `submitted_by` UUID sendiri. Akun lain tidak bisa melihatnya.
5. Isi jurusan/angkatan; lanjut. Reload, keluar, lalu login email/password: harus kembali ke **Dari Mana?**.
6. Pilih satu referral atau Lainnya; pilih satu atau lebih minat dari daftar. Selesaikan. Dashboard `/dashboard` terbuka hanya setelah completion tersimpan.
7. Reload dan login ulang: tetap dashboard. Periksa custom referral tidak menambah master referral.

## 8. Uji satu mentee Google

1. Di browser privat pilih **Lanjutkan dengan Google**, gunakan akun yang belum terdaftar.
2. Setelah callback, periksa nama/avatar dari provider dan role `mentee`; pilih username sendiri.
3. Biarkan password kosong, selesaikan onboarding, keluar, lalu masuk lewat Google. Dashboard harus terbuka.
4. Untuk memverifikasi password opsional, gunakan akun Google uji kedua, isi password/konfirmasi pada langkah 1. Setelah selesai, login email/password maupun Google harus tersedia.

## 9. Undang satu mentor dan kelola master

1. Login sebagai admin, tab **Mentors** → **Invite Mentor**, masukkan email yang kamu kuasai dan belum menjadi akun confirmed.
2. Klik email undangan. Harus menuju `/auth/setup`, bukan onboarding mentee.
3. Tetapkan nama, username, password dan konfirmasi. Setelah tersimpan buka `/mentor`; reload dan login ulang mempertahankan akses.
4. Sebagai mentee, mengetik `/admin`/`/mentor` harus diarahkan ke tujuan akun sendiri. RPC/REST langsung untuk mengubah role/master atau data orang lain harus ditolak.
5. Di Admin → **Institutions**, filter `pending`, setujui/tolak/edit/arsipkan. **Duplikat** memerlukan pemilihan dan konfirmasi tujuan, memindahkan referensi secara transaksi lalu mengarsipkan asal.
6. Di **Referral Sources** dan **Competition Interests**, tambah/edit nama/urutan atau arsipkan. Opsi nonaktif hilang dari pilihan baru; referensi lama tetap tersimpan.
7. Dengan akun uji lain yang belum menerima undangan, uji **Hapus** → batal (data tetap ada), lalu konfirmasi (undangan dan akun uji hilang). Undang ulang email yang sama; akun harus tetap mendapat role mentor. Undangan akun yang sudah aktif tidak boleh dihapus.
8. Uji ikon mata pada login, setup mentor, recovery password, dan langkah Data Diri onboarding. Tombol harus berganti tampil/sembunyi tanpa mengirim form atau mengubah isinya; password dan konfirmasinya dapat ditampilkan secara terpisah.

## 10. Pengujian otomatis dan batas bukti

```powershell
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Untuk menyiapkan database uji Postgres yang benar-benar baru (contoh port lokal 55439):

```powershell
createdb -h 127.0.0.1 -p 55439 -U postgres strativate_test_auth
$env:TEST_DATABASE_URL = 'postgresql://postgres@127.0.0.1:55439/strativate_test_auth'
pnpm test:db --bootstrap
```

Runner hanya menerima nama database `strativate_test_*`. `--bootstrap` menolak database yang sudah memiliki tabel Auth/profiles, lalu memasang harness dan semua migrasi secara berurutan. Tanpa `--bootstrap`, runner menjalankan ulang tiga suite SQL pada database uji yang telah disiapkan. Gunakan database uji bersih dengan seed bawaan, sebelum impor dataset lengkap. Suite importer memeriksa idempotensi, update, rollback batch gagal, serta perlindungan pengajuan pengguna.

`supabase/tests/auth_security.sql` memeriksa SQL/RLS sebagai role `anon`/`authenticated`, ownership, progress, password, invitation, master mutations, dan duplicate handling. Jalankan setelah migrasi pada database uji saja. Fixture di-rollback:

```powershell
psql $env:TEST_DATABASE_URL -v ON_ERROR_STOP=1 -f supabase/tests/auth_security.sql
```

`supabase/tests/mentor_invites.sql` memeriksa izin admin, penghapusan undangan/akun belum aktif, perlindungan akun aktif, undangan yang masih diproses, pengiriman ulang, dan rollback ketika penghapusan akun ditolak foreign key.

`supabase/tests/bootstrap.sql` hanya harness untuk **PostgreSQL kosong lokal**, meniru kolom Auth dan helper claims agar RLS dapat diuji. Jangan jalankan bootstrap ini di Supabase atau database yang sudah berisi data. Test SQL lokal tidak membuktikan SMTP/OAuth hosted sudah dikonfigurasi; uji email/Google/invite di atas tetap diperlukan setelah setup provider dan migrasi.

Referensi resmi: [SSR Supabase](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [template email](https://supabase.com/docs/guides/auth/auth-email-templates), [Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google), [Admin invitations](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail).
