import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

function productionFiles(directory: string): string[] {
  const absolute = join(root, directory)
  if (!existsSync(absolute)) return []
  return readdirSync(absolute).flatMap(name => {
    const relative = join(directory, name)
    const full = join(root, relative)
    return statSync(full).isDirectory() ? productionFiles(relative) : [relative]
  })
}

test('public mentor runtime has a server-only DB query source', () => {
  const path = join(root, 'lib/mentor/public-profile.ts')
  assert.equal(existsSync(path), true, 'DB-backed mentor public query helper must exist')
  const source = read('lib/mentor/public-profile.ts')
  assert.match(source, /import ['"]server-only['"]/)
  assert.match(source, /listPublishedMentors/)
  assert.match(source, /list_public_mentors/)
  assert.doesNotMatch(source, /createAdminClient|service_role/)
})

test('homepage and mentor directory load public mentors from the database helper', () => {
  const mentorPage = read('app/mentor/page.tsx')
  const homePage = read('app/page.tsx')
  assert.match(mentorPage, /listPublishedMentors/)
  assert.match(homePage, /listPublishedMentors/)
  assert.doesNotMatch(mentorPage, /@\/lib\/content\/mentors/)
  assert.doesNotMatch(homePage, /@\/lib\/content\/mentors/)
})

test('production runtime no longer imports the hardcoded mentor roster', () => {
  const files = ['app', 'components', 'lib'].flatMap(productionFiles)
    .filter(path => /\.(ts|tsx)$/.test(path))
    .filter(path => path !== 'lib/content/mentors.ts')
  const offenders = files.filter(path => read(path).includes('@/lib/content/mentors'))
  assert.deepEqual(offenders, [], `hardcoded mentor roster is still imported by: ${offenders.join(', ')}`)
})

test('mentor dashboard includes distinct public profile management', () => {
  const componentPath = join(root, 'components/mentor/mentor-public-profile-form.tsx')
  assert.equal(existsSync(componentPath), true, 'mentor public profile form must exist')
  const form = read('components/mentor/mentor-public-profile-form.tsx')
  const secondary = read('components/mentor/dashboard/mentor-secondary-sections.tsx')
  const page = read('app/mentor/dashboard/page.tsx')
  assert.match(form, /save_my_mentor_public_profile/)
  assert.match(form, /Move up|Naik/)
  assert.match(form, /Move down|Turun/)
  assert.match(secondary, /MentorPublicProfileForm/)
  assert.match(secondary, /ProfileForm/)
  assert.match(page, /loadMyMentorPublicProfile/)
})

test('admin exposes mentor expertise master data management', () => {
  const componentPath = join(root, 'components/admin/mentor-expertise-management.tsx')
  assert.equal(existsSync(componentPath), true, 'admin mentor expertise management must exist')
  const component = read('components/admin/mentor-expertise-management.tsx')
  const css = read('components/admin/mentor-expertise-management.module.css')
  const adminPage = read('app/admin/page.tsx')
  assert.match(component, /admin_upsert_mentor_expertise/)
  assert.match(component, /admin_reorder_mentor_expertise/)
  assert.match(component, /admin_delete_mentor_expertise/)
  assert.match(component, /No expertise has been configured yet\./)
  assert.match(adminPage, /Mentor Expertise/)
  assert.match(adminPage, /MentorExpertiseManagement/)
  assert.match(css, /width:\s*min\(520px,\s*calc\(100vw - 32px\)\)/)
  assert.match(css, /max-height:\s*calc\(100dvh - 32px\)/)
})

test('admin publication controls create and publish the selected mentor account profile', () => {
  const publicationPath = join(root, 'components/admin/mentor-publication-control.tsx')
  assert.equal(existsSync(publicationPath), true, 'admin mentor publication control must exist')
  const publication = read('components/admin/mentor-publication-control.tsx')
  const management = read('components/admin/mentor-management.tsx')
  assert.match(publication, /mentor_user_id/)
  assert.match(publication, /admin_ensure_mentor_public_profile/)
  assert.match(publication, /admin_set_mentor_publication/)
  assert.match(publication, /Belum memiliki profil publik/)
  assert.doesNotMatch(publication, /legacy public profiles|nama atau email/i)
  assert.match(management, /MentorPublicationControl/)
})
