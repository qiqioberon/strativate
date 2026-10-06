import assert from 'node:assert/strict'
import test from 'node:test'

test('replacement persists both files before deleting old objects; recrop keeps the source', async () => {
  const { persistAdminImage } = await import('../lib/media/admin-image-storage')
  const events: string[] = []
  const original = new File(['source'], 'logo.png', { type: 'image/png' })
  const derivative = new File(['crop'], 'logo.webp', { type: 'image/webp' })
  const saved = await persistAdminImage({
    original, derivative, sourcePrefix: 'trusted-partners/', derivativePrefix: 'partner-logos/',
    previous: { path: 'partner-logos/old.webp', sourcePath: 'trusted-partners/old.png' },
    upload: async (bucket, path) => { events.push(`upload:${bucket}:${path}`) },
    remove: async (bucket, path) => { events.push(`remove:${bucket}:${path}`) },
    persist: async refs => { events.push('persist'); assert.match(refs.sourcePath!, /^trusted-partners\/.+\.png$/); assert.match(refs.path!, /^partner-logos\/.+\.webp$/) },
    reconcile: async () => { throw new Error('Successful save must not reconcile') },
  })
  assert.equal(events.length, 5)
  assert.match(events[0], /^upload:marketing-photo-sources:/)
  assert.match(events[1], /^upload:marketing-editorial:/)
  assert.equal(events[2], 'persist')
  assert.equal(events[3], 'remove:marketing-editorial:partner-logos/old.webp')
  assert.equal(events[4], 'remove:marketing-photo-sources:trusted-partners/old.png')
  events.length = 0
  await persistAdminImage({
    original: null, derivative, sourcePrefix: 'trusted-partners/', derivativePrefix: 'partner-logos/', previous: saved,
    upload: async bucket => { events.push(`upload:${bucket}`) },
    remove: async bucket => { events.push(`remove:${bucket}`) },
    persist: async refs => { assert.equal(refs.sourcePath, saved.sourcePath) }, reconcile: async () => [],
  })
  assert.deepEqual(events, ['upload:marketing-editorial', 'remove:marketing-editorial'])
})

test('failed save reconciles before orphan cleanup and never deletes previous files', async () => {
  const { persistAdminImage } = await import('../lib/media/admin-image-storage')
  const events: string[] = []
  await assert.rejects(persistAdminImage({
    original: new File(['s'], 'logo.png', { type: 'image/png' }),
    derivative: new File(['d'], 'logo.webp', { type: 'image/webp' }),
    sourcePrefix: 'competition-recognitions/', derivativePrefix: 'recognition-logos/',
    previous: { path: 'recognition-logos/old.webp', sourcePath: null },
    upload: async () => {}, persist: async () => { throw new Error('DB failed') },
    reconcile: async () => { events.push('reconcile'); return [] },
    remove: async (_, path) => { assert.notEqual(path, 'recognition-logos/old.webp'); events.push('remove') },
  }), /DB failed/)
  assert.deepEqual(events, ['reconcile', 'remove', 'remove'])
})

test('uncertain database status preserves new objects; confirmed save performs old-file cleanup', async () => {
  const { persistAdminImage } = await import('../lib/media/admin-image-storage')
  let persisted: { path: string | null; sourcePath: string | null } = { path: null, sourcePath: null }
  const removed: string[] = []
  const options = {
    original: new File(['s'], 'logo.png', { type: 'image/png' }),
    derivative: new File(['d'], 'logo.webp', { type: 'image/webp' }),
    sourcePrefix: 'trusted-partners/', derivativePrefix: 'partner-logos/',
    previous: { path: 'partner-logos/old.webp', sourcePath: 'trusted-partners/old.png' },
    upload: async () => {}, remove: async (_: string, path: string) => { removed.push(path) },
    persist: async (refs: typeof persisted) => { persisted = refs; throw new Error('Lost response') },
  }
  await assert.rejects(persistAdminImage({ ...options, reconcile: async () => { throw new Error('Offline') } }), /preserved.*could not be confirmed/)
  assert.deepEqual(removed, [])
  const result = await persistAdminImage({ ...options, reconcile: async () => [persisted] })
  assert.equal(result.sourcePath, persisted.sourcePath)
  assert.deepEqual(removed, ['partner-logos/old.webp', 'trusted-partners/old.png'])
})
