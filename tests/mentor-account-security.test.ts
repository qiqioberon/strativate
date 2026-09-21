import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("Mentor Profile mounts shared password security without Admin email controls", async () => {
  const [profile, passwordSecurity, adminSecurity] = await Promise.all([
    readFile("components/auth/profile-form.tsx", "utf8"),
    readFile("components/auth/account-password-security.tsx", "utf8"),
    readFile("components/auth/admin-account-security.tsx", "utf8"),
  ])

  assert.match(
    profile,
    /account\.role\s*===\s*['"]admin['"][\s\S]*?<AdminAccountSecurity[\s\S]*?account\.role\s*===\s*['"]mentor['"][\s\S]*?<AccountPasswordSecurity role=["']mentor["'][\s\S]*?: null/,
  )
  assert.match(passwordSecurity, /Keamanan akun/)
  assert.match(passwordSecurity, /Perbarui kata sandi untuk akun Mentor yang sedang masuk\./)
  assert.match(passwordSecurity, /Kata sandi baru/)
  assert.match(passwordSecurity, /Konfirmasi kata sandi/)
  assert.match(passwordSecurity, /Perbarui kata sandi/)
  assert.doesNotMatch(passwordSecurity, /Email baru|Perbarui email/)
  assert.match(adminSecurity, /Email baru/)
  assert.match(adminSecurity, /Perbarui email/)
})

test("Mentee receives no new password section and profile fields remain unchanged", async () => {
  const profile = await readFile("components/auth/profile-form.tsx", "utf8")

  assert.match(
    profile,
    /account\.role\s*===\s*['"]mentor['"][\s\S]*?<AccountPasswordSecurity role=["']mentor["'][\s\S]*?: null/,
  )
  assert.match(profile, /name=["']first_name["']/)
  assert.match(profile, /name=["']last_name["']/)
  assert.match(profile, /name=["']username["']/)
  assert.match(profile, /name=["']whatsapp_number["']/)
  assert.match(profile, /<label>Email<input value=\{account\.email \|\| ['"]['"]\} readOnly/)
  assert.match(profile, /ProfileAvatarEditor/)
})

test("Mentor dashboard keeps account and public profile management together", async () => {
  const secondary = await readFile(
    "components/mentor/dashboard/mentor-secondary-sections.tsx",
    "utf8",
  )

  assert.match(secondary, /mentor-profile-management-stack/)
  assert.match(secondary, /<ProfileForm \/>/)
  assert.match(secondary, /<MentorPublicProfileForm/)
})
