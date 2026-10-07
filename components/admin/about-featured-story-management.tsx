'use client'

import {
  CircleAlert,
  ImageIcon,
  Images,
  RefreshCw,
  X,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'

import { AdminImageUploadField } from '@/components/admin/admin-image-upload-field'
import { useAdminImageUpload, type AdminImageUpload } from '@/components/admin/use-admin-image-upload'
import { formError } from '@/lib/auth/errors'
import {
  isAboutFeaturedStorySetupRequired,
  isCompleteAboutFeaturedStory,
  isFixedAboutFeaturedStory,
  validateAboutFeaturedStoryDraft,
  type AboutFeaturedStoryDraftErrors,
} from '@/lib/marketing/about-featured-story-admin'
import {
  ABOUT_FEATURED_STORY_BUCKET,
  ABOUT_FEATURED_STORY_ONE_TARGET,
  ABOUT_FEATURED_STORY_PREFIX,
  ABOUT_FEATURED_STORY_SLOTS,
  ABOUT_FEATURED_STORY_SOURCE_PREFIX,
  ABOUT_FEATURED_STORY_TWO_TARGET,
  type AboutFeaturedStorySlot,
} from '@/lib/marketing/about-featured-story-config'
import {
  PHOTO_SOURCE_BUCKET,
  cropRectFromJson,
  sourceExtension,
  type NormalizedCropRect,
} from '@/lib/media/image-crop'
import { createClient } from '@/lib/supabase/client'
import type { AboutFeaturedStory, Json } from '@/lib/supabase/database.types'

import dataStyles from './data-management.module.css'
import dialogStyles from './digital-product-dialog.module.css'
import styles from './about-featured-story-management.module.css'

const migrationName = '202610080003_about_featured_stories_fixed_slots.sql'

type Draft = {
  title: string
  quote: string
  attributionName: string
  attributionOrganization: string
  achievementText: string
  primaryAltText: string
  secondaryAltText: string
  isActive: boolean
}

type ImageRefs = {
  path: string | null
  sourcePath: string | null
  crop: NormalizedCropRect | null
}

type UploadedObject = { bucket: string; path: string }

const emptyDraft: Draft = {
  title: '',
  quote: '',
  attributionName: '',
  attributionOrganization: '',
  achievementText: '',
  primaryAltText: '',
  secondaryAltText: '',
  isActive: false,
}

function draftFromStory(story: AboutFeaturedStory): Draft {
  return {
    title: story.title ?? '',
    quote: story.quote ?? '',
    attributionName: story.attribution_name ?? '',
    attributionOrganization: story.attribution_organization ?? '',
    achievementText: story.achievement_text ?? '',
    primaryAltText: story.primary_image_alt_text ?? '',
    secondaryAltText: story.secondary_image_alt_text ?? '',
    isActive: story.is_active,
  }
}

function refsForPrimary(story: AboutFeaturedStory | null): ImageRefs {
  return {
    path: story?.primary_image_path ?? null,
    sourcePath: story?.primary_image_source_path ?? null,
    crop: cropRectFromJson(story?.primary_image_crop),
  }
}

function refsForSecondary(story: AboutFeaturedStory | null): ImageRefs {
  return {
    path: story?.secondary_image_path ?? null,
    sourcePath: story?.secondary_image_source_path ?? null,
    crop: cropRectFromJson(story?.secondary_image_crop),
  }
}

function cropsMatch(value: Json | null, expected: NormalizedCropRect | null) {
  const actual = cropRectFromJson(value)
  if (!actual || !expected) return actual === expected
  return (
    Math.abs(actual.x - expected.x) < 0.000001
    && Math.abs(actual.y - expected.y) < 0.000001
    && Math.abs(actual.width - expected.width) < 0.000001
    && Math.abs(actual.height - expected.height) < 0.000001
  )
}

function slotOrder(slot: AboutFeaturedStorySlot) {
  return slot === 'story_one' ? 1 : 2
}

export function AboutFeaturedStoryManagement() {
  const supabase = useMemo(() => createClient(), [])
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [stories, setStories] = useState<AboutFeaturedStory[]>([])
  const [selectedSlot, setSelectedSlot] = useState<AboutFeaturedStorySlot | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [fieldErrors, setFieldErrors] = useState<AboutFeaturedStoryDraftErrors>({})
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [setupRequired, setSetupRequired] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const selected = useMemo(
    () => stories.find(story => story.slot === selectedSlot) ?? null,
    [stories, selectedSlot],
  )
  const selectedMeta = ABOUT_FEATURED_STORY_SLOTS.find(item => item.slot === selectedSlot) ?? ABOUT_FEATURED_STORY_SLOTS[0]
  const primaryTarget = selectedSlot === 'story_two'
    ? ABOUT_FEATURED_STORY_TWO_TARGET
    : ABOUT_FEATURED_STORY_ONE_TARGET
  const primaryImage = useAdminImageUpload({ supabase, target: primaryTarget, onError: setError })
  const secondaryImage = useAdminImageUpload({ supabase, target: ABOUT_FEATURED_STORY_TWO_TARGET, onError: setError })
  const storedPrimary = refsForPrimary(selected)
  const storedSecondary = refsForSecondary(selected)
  const editorOpen = Boolean(selectedSlot && selected)
  const busy = busyAction !== null || primaryImage.loadingSource || secondaryImage.loadingSource

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setSetupRequired(false)
    setLoadFailed(false)

    const { data, error: loadError } = await supabase.rpc('admin_list_about_featured_stories')
    if (loadError) {
      if (isAboutFeaturedStorySetupRequired(loadError)) setSetupRequired(true)
      else {
        setLoadFailed(true)
        setError(formError(loadError, 'Featured Stories could not be loaded. Check the connection and try again.'))
      }
      setStories([])
      setLoading(false)
      return
    }

    const fixed = (data ?? []).filter(isFixedAboutFeaturedStory).sort((a, b) => slotOrder(a.slot) - slotOrder(b.slot))
    const validSlots = fixed.length === 2
      && fixed[0]?.slot === 'story_one'
      && fixed[1]?.slot === 'story_two'

    if (!validSlots) {
      setSetupRequired(true)
      setStories([])
      setLoading(false)
      return
    }

    setStories(fixed)
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (editorOpen && !dialog.open) dialog.showModal()
    else if (!editorOpen && dialog.open) dialog.close()
  }, [editorOpen])

  const publicUrl = useCallback((path: string | null) => (
    path ? supabase.storage.from(ABOUT_FEATURED_STORY_BUCKET).getPublicUrl(path).data.publicUrl : null
  ), [supabase])

  const resetEditor = () => {
    setSelectedSlot(null)
    setDraft(emptyDraft)
    primaryImage.reset()
    secondaryImage.reset()
    setFieldErrors({})
  }

  const beginEdit = (story: AboutFeaturedStory) => {
    setSelectedSlot(story.slot)
    setDraft(draftFromStory(story))
    primaryImage.reset(cropRectFromJson(story.primary_image_crop))
    secondaryImage.reset(cropRectFromJson(story.secondary_image_crop))
    setFieldErrors({})
    setError('')
    setNotice('')
  }

  async function stageImage(
    image: AdminImageUpload,
    previous: ImageRefs,
    uploaded: UploadedObject[],
  ): Promise<ImageRefs> {
    const next = { ...previous }

    if (image.originalFile) {
      const sourcePath = `${ABOUT_FEATURED_STORY_SOURCE_PREFIX}${crypto.randomUUID()}.${sourceExtension(image.originalFile)}`
      const { error: sourceError } = await supabase.storage
        .from(PHOTO_SOURCE_BUCKET)
        .upload(sourcePath, image.originalFile, {
          contentType: image.originalFile.type,
          cacheControl: '3600',
          upsert: false,
        })
      if (sourceError) throw sourceError
      uploaded.push({ bucket: PHOTO_SOURCE_BUCKET, path: sourcePath })
      next.sourcePath = sourcePath
    }

    if (image.processedFile) {
      const path = `${ABOUT_FEATURED_STORY_PREFIX}${crypto.randomUUID()}.webp`
      const { error: derivativeError } = await supabase.storage
        .from(ABOUT_FEATURED_STORY_BUCKET)
        .upload(path, image.processedFile, {
          contentType: 'image/webp',
          cacheControl: '3600',
          upsert: false,
        })
      if (derivativeError) throw derivativeError
      uploaded.push({ bucket: ABOUT_FEATURED_STORY_BUCKET, path })
      next.path = path
    }

    next.crop = image.crop ?? previous.crop
    return next
  }

  async function cleanupObjects(objects: UploadedObject[]) {
    let warning = ''
    for (const object of objects) {
      const { error: removeError } = await supabase.storage.from(object.bucket).remove([object.path])
      if (removeError) warning += ' A stored image needs manual Storage cleanup.'
    }
    return warning
  }

  async function cleanupSuperseded(previous: ImageRefs, next: ImageRefs) {
    const objects: UploadedObject[] = []
    if (previous.path && previous.path !== next.path && previous.path.startsWith(ABOUT_FEATURED_STORY_PREFIX)) {
      objects.push({ bucket: ABOUT_FEATURED_STORY_BUCKET, path: previous.path })
    }
    if (
      previous.sourcePath
      && previous.sourcePath !== next.sourcePath
      && previous.sourcePath.startsWith(ABOUT_FEATURED_STORY_SOURCE_PREFIX)
    ) {
      objects.push({ bucket: PHOTO_SOURCE_BUCKET, path: previous.sourcePath })
    }
    return cleanupObjects(objects)
  }

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy || !selected || !selectedSlot) return

    setError('')
    setNotice('')

    const hasPrimaryImage = Boolean(primaryImage.processedFile || storedPrimary.path)
    const hasSecondaryImage = selectedSlot === 'story_two'
      ? Boolean(secondaryImage.processedFile || storedSecondary.path)
      : true
    const errors = validateAboutFeaturedStoryDraft({
      slot: selectedSlot,
      ...draft,
      hasPrimaryImage,
      hasSecondaryImage,
    })
    setFieldErrors(errors)
    if (Object.keys(errors).length) return

    setBusyAction('save')
    const uploaded: UploadedObject[] = []
    const oldPrimary = refsForPrimary(selected)
    const oldSecondary = refsForSecondary(selected)
    let nextPrimary: ImageRefs | null = null
    let nextSecondary: ImageRefs | null = null

    try {
      nextPrimary = await stageImage(primaryImage, storedPrimary, uploaded)
      if (!nextPrimary.path || !nextPrimary.sourcePath || !nextPrimary.crop) {
        throw new Error('Primary story image is incomplete. Re-crop the image and try again.')
      }

      if (selectedSlot === 'story_two') {
        nextSecondary = await stageImage(secondaryImage, storedSecondary, uploaded)
        if (!nextSecondary.path || !nextSecondary.sourcePath || !nextSecondary.crop) {
          throw new Error('Secondary story image is incomplete. Re-crop the image and try again.')
        }
      }

      const payload = {
        title: draft.title.trim(),
        quote: draft.quote.trim(),
        attribution_name: draft.attributionName.trim(),
        attribution_organization: draft.attributionOrganization.trim(),
        achievement_text: draft.achievementText.trim(),
        primary_image_path: nextPrimary.path,
        primary_image_source_path: nextPrimary.sourcePath,
        primary_image_crop: nextPrimary.crop as unknown as Json,
        primary_image_alt_text: draft.primaryAltText.trim(),
        secondary_image_path: nextSecondary?.path ?? null,
        secondary_image_source_path: nextSecondary?.sourcePath ?? null,
        secondary_image_crop: nextSecondary?.crop ? nextSecondary.crop as unknown as Json : null,
        secondary_image_alt_text: selectedSlot === 'story_two' ? draft.secondaryAltText.trim() : null,
        is_active: draft.isActive,
      }

      const { error: updateError } = await supabase
        .from('about_featured_stories')
        .update(payload)
        .eq('slot', selectedSlot)
      if (updateError) throw updateError

      let warning = ''
      warning += await cleanupSuperseded(oldPrimary, nextPrimary)
      warning += await cleanupSuperseded(oldSecondary, nextSecondary ?? refsForSecondary(null))

      resetEditor()
      setNotice(`${selectedMeta.label} updated.` + warning)
      await load()
    } catch (saveError) {
      try {
        const { data, error: reconcileError } = await supabase.rpc('admin_list_about_featured_stories')
        if (reconcileError) throw reconcileError
        const persisted = (data ?? []).find(story => (
          isFixedAboutFeaturedStory(story)
          && story.slot === selectedSlot
          && story.title === draft.title.trim()
          && story.quote === draft.quote.trim()
          && story.attribution_name === draft.attributionName.trim()
          && story.attribution_organization === draft.attributionOrganization.trim()
          && story.achievement_text === draft.achievementText.trim()
          && story.primary_image_path === nextPrimary?.path
          && story.primary_image_source_path === nextPrimary?.sourcePath
          && cropsMatch(story.primary_image_crop, nextPrimary?.crop ?? null)
          && story.primary_image_alt_text === draft.primaryAltText.trim()
          && story.secondary_image_path === (nextSecondary?.path ?? null)
          && story.secondary_image_source_path === (nextSecondary?.sourcePath ?? null)
          && cropsMatch(story.secondary_image_crop, nextSecondary?.crop ?? null)
          && story.secondary_image_alt_text === (selectedSlot === 'story_two' ? draft.secondaryAltText.trim() : null)
          && story.is_active === draft.isActive
        ))

        if (persisted) {
          let warning = ''
          warning += await cleanupSuperseded(oldPrimary, nextPrimary ?? refsForPrimary(null))
          warning += await cleanupSuperseded(oldSecondary, nextSecondary ?? refsForSecondary(null))
          resetEditor()
          setNotice(`${selectedMeta.label} saved after write reconciliation.` + warning)
          await load()
        } else {
          const warning = await cleanupObjects(uploaded)
          setError(formError(saveError, 'The Featured Story could not be saved.') + warning)
        }
      } catch {
        setError(
          formError(saveError, 'The Featured Story could not be saved.')
          + ' New files were preserved because database status could not be confirmed. Review Storage before retrying.',
        )
      }
    } finally {
      setBusyAction(null)
    }
  }

  const pageHeader = (
    <header className={dataStyles.pageHeader}>
      <div className={dataStyles.pageHeaderCopy}>
        <p className="kicker">Content · About Us</p>
        <h2>Featured Stories</h2>
        <p>Manage the two fixed success-story placements used by the approved About Us layout.</p>
      </div>
      <span className={dataStyles.countPill}><Images aria-hidden="true" />2 fixed slots</span>
    </header>
  )

  if (loading) {
    return <section className={dataStyles.page} data-testid="about-featured-story-admin" aria-busy="true">
      {pageHeader}
      <div className={styles.stateCard} role="status"><RefreshCw className="animate-spin" aria-hidden="true" /><p>Loading Featured Stories…</p></div>
    </section>
  }

  if (setupRequired) {
    return <section className={dataStyles.page} data-testid="about-featured-story-admin">
      {pageHeader}
      <div className={styles.stateCard} role="alert">
        <CircleAlert aria-hidden="true" />
        <strong>Database setup required</strong>
        <p>Database migration <code>{migrationName}</code> needs to be applied before the two fixed Featured Story slots can be managed.</p>
        <button type="button" className="button button-outline" onClick={() => void load()}>Retry connection</button>
      </div>
    </section>
  }

  if (loadFailed) {
    return <section className={dataStyles.page} data-testid="about-featured-story-admin">
      {pageHeader}
      <div className={styles.stateCard} role="alert">
        <CircleAlert aria-hidden="true" />
        <strong>Featured Stories could not be loaded.</strong>
        <p>{error}</p>
        <button type="button" className="button button-outline" onClick={() => void load()}>Try again</button>
      </div>
    </section>
  }

  return (
    <section className={dataStyles.page} data-testid="about-featured-story-admin" aria-busy={busy}>
      {pageHeader}
      {error ? <p className={dataStyles.feedback + ' ' + dataStyles.errorFeedback} role="alert">{error}</p> : null}
      {notice ? <p className={dataStyles.feedback + ' ' + dataStyles.successFeedback} role="status">{notice}</p> : null}

      <div className={dataStyles.surface}>
        <div className={dataStyles.surfaceHeader}>
          <div className={dataStyles.surfaceHeaderCopy}>
            <p className="kicker">Fixed editorial placements</p>
            <h3>2 Featured Story slots</h3>
            <p>Story 1 is always landscape-left / quote-right. Story 2 is always quote-left / two portrait images-right.</p>
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Slot</th><th>Media</th><th>Story</th><th>Fixed layout</th><th>Status</th><th className={styles.actionCell}>Action</th></tr></thead>
            <tbody>
              {stories.map(story => {
                const meta = ABOUT_FEATURED_STORY_SLOTS.find(item => item.slot === story.slot)!
                const complete = isCompleteAboutFeaturedStory(story)
                const status = story.is_active ? 'Active' : complete ? 'Inactive' : 'Empty'
                return (
                  <tr key={story.slot} data-testid="about-featured-story-row">
                    <td data-label="Slot"><strong className={styles.slotName}>{meta.label}</strong></td>
                    <td data-label="Media">
                      <div className={styles.thumbnailStack} data-slot={story.slot}>
                        {story.primary_image_path ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={publicUrl(story.primary_image_path) ?? undefined} alt="" />
                        ) : <span><ImageIcon aria-hidden="true" /></span>}
                        {story.slot === 'story_two' ? story.secondary_image_path ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={publicUrl(story.secondary_image_path) ?? undefined} alt="" />
                        ) : <span><ImageIcon aria-hidden="true" /></span> : null}
                      </div>
                    </td>
                    <td data-label="Story" className={styles.storyCell}>
                      <strong>{story.title || 'Not configured yet'}</strong>
                      <small>{story.attribution_name && story.attribution_organization ? `${story.attribution_name} · ${story.attribution_organization}` : 'Add approved copy and attribution in Manage.'}</small>
                    </td>
                    <td data-label="Fixed layout"><span className={styles.layoutPill}>{meta.layoutLabel}</span></td>
                    <td data-label="Status">
                      <span className={dataStyles.badge + ' ' + (story.is_active ? dataStyles.successBadge : dataStyles.mutedBadge)}>{status}</span>
                    </td>
                    <td data-label="Action" className={styles.actionCell}>
                      <button type="button" className={styles.manageButton} onClick={() => beginEdit(story)} disabled={busy}>Manage</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <dialog
        ref={dialogRef}
        className={dialogStyles.dialog}
        data-testid="about-featured-story-editor-dialog"
        aria-labelledby="about-featured-story-editor-heading"
        onCancel={event => { if (busy) event.preventDefault(); else resetEditor() }}
        onClose={() => { if (!busy && editorOpen) resetEditor() }}
        onClick={event => { if (event.target === event.currentTarget && !busy) resetEditor() }}
      >
        <div className={dialogStyles.panel}>
          <header className={dialogStyles.header}>
            <div>
              <p className="kicker">{selectedMeta.label}</p>
              <h2 id="about-featured-story-editor-heading">Manage {selectedMeta.label}</h2>
              <p className={styles.dialogLayoutHint}>{selectedMeta.layoutLabel}</p>
            </div>
            <button type="button" className={'role-close ' + dialogStyles.closeButton} onClick={resetEditor} disabled={busy} aria-label="Close Featured Story editor"><X aria-hidden="true" /></button>
          </header>
          <div className={dialogStyles.body}>
            <form className={styles.form} onSubmit={save} noValidate>
              <div className={styles.formGrid}>
                <label className={styles.fullField}>
                  Story title / headline
                  <input value={draft.title} maxLength={240} onChange={event => { setDraft(current => ({ ...current, title: event.target.value })); setFieldErrors(current => ({ ...current, title: undefined })) }} aria-invalid={Boolean(fieldErrors.title)} />
                  {fieldErrors.title ? <small className="form-error">{fieldErrors.title}</small> : null}
                </label>
                <label className={styles.fullField}>
                  Testimonial / quote
                  <textarea value={draft.quote} maxLength={3000} rows={6} onChange={event => { setDraft(current => ({ ...current, quote: event.target.value })); setFieldErrors(current => ({ ...current, quote: undefined })) }} aria-invalid={Boolean(fieldErrors.quote)} />
                  {fieldErrors.quote ? <small className="form-error">{fieldErrors.quote}</small> : null}
                </label>
                <label>
                  Team / person name
                  <input value={draft.attributionName} maxLength={180} onChange={event => { setDraft(current => ({ ...current, attributionName: event.target.value })); setFieldErrors(current => ({ ...current, attributionName: undefined })) }} aria-invalid={Boolean(fieldErrors.attributionName)} />
                  {fieldErrors.attributionName ? <small className="form-error">{fieldErrors.attributionName}</small> : null}
                </label>
                <label>
                  Institution / organization
                  <input value={draft.attributionOrganization} maxLength={240} onChange={event => { setDraft(current => ({ ...current, attributionOrganization: event.target.value })); setFieldErrors(current => ({ ...current, attributionOrganization: undefined })) }} aria-invalid={Boolean(fieldErrors.attributionOrganization)} />
                  {fieldErrors.attributionOrganization ? <small className="form-error">{fieldErrors.attributionOrganization}</small> : null}
                </label>
                <label className={styles.fullField}>
                  Achievement / result
                  <input value={draft.achievementText} maxLength={300} onChange={event => { setDraft(current => ({ ...current, achievementText: event.target.value })); setFieldErrors(current => ({ ...current, achievementText: undefined })) }} aria-invalid={Boolean(fieldErrors.achievementText)} />
                  {fieldErrors.achievementText ? <small className="form-error">{fieldErrors.achievementText}</small> : null}
                </label>
                <label className={styles.activeToggle}>
                  <span><strong>Active</strong><small>Publish this fixed slot on the About Us page.</small></span>
                  <input type="checkbox" checked={draft.isActive} onChange={event => setDraft(current => ({ ...current, isActive: event.target.checked }))} />
                </label>
              </div>

              <div className={styles.mediaSection} data-slot={selectedSlot ?? undefined}>
                <div className={styles.mediaSlot}>
                  <div>
                    <strong>{selectedSlot === 'story_two' ? 'Image 1' : 'Story image'}</strong>
                    <span>{selectedSlot === 'story_two' ? 'Locked 3:4 crop · 900 × 1200 WebP' : 'Locked 4:3 crop · 1200 × 900 WebP'}</span>
                  </div>
                  <AdminImageUploadField
                    image={primaryImage}
                    target={primaryTarget}
                    storedUrl={publicUrl(storedPrimary.path)}
                    sourcePath={storedPrimary.sourcePath}
                    alt={draft.primaryAltText || 'Featured Story image preview'}
                    disabled={busy}
                    onApplied={() => setFieldErrors(current => ({ ...current, primaryImage: undefined }))}
                  />
                  <label>
                    {selectedSlot === 'story_two' ? 'Image 1 alt text' : 'Image alt text'}
                    <input value={draft.primaryAltText} maxLength={300} onChange={event => { setDraft(current => ({ ...current, primaryAltText: event.target.value })); setFieldErrors(current => ({ ...current, primaryAltText: undefined })) }} aria-invalid={Boolean(fieldErrors.primaryAltText)} />
                  </label>
                  {fieldErrors.primaryImage ? <small className="form-error">{fieldErrors.primaryImage}</small> : null}
                  {fieldErrors.primaryAltText ? <small className="form-error">{fieldErrors.primaryAltText}</small> : null}
                </div>

                {selectedSlot === 'story_two' ? (
                  <div className={styles.mediaSlot}>
                    <div><strong>Image 2</strong><span>Locked 3:4 crop · 900 × 1200 WebP</span></div>
                    <AdminImageUploadField
                      image={secondaryImage}
                      target={ABOUT_FEATURED_STORY_TWO_TARGET}
                      storedUrl={publicUrl(storedSecondary.path)}
                      sourcePath={storedSecondary.sourcePath}
                      alt={draft.secondaryAltText || 'Featured Story second image preview'}
                      disabled={busy}
                      onApplied={() => setFieldErrors(current => ({ ...current, secondaryImage: undefined }))}
                    />
                    <label>
                      Image 2 alt text
                      <input value={draft.secondaryAltText} maxLength={300} onChange={event => { setDraft(current => ({ ...current, secondaryAltText: event.target.value })); setFieldErrors(current => ({ ...current, secondaryAltText: undefined })) }} aria-invalid={Boolean(fieldErrors.secondaryAltText)} />
                    </label>
                    {fieldErrors.secondaryImage ? <small className="form-error">{fieldErrors.secondaryImage}</small> : null}
                    {fieldErrors.secondaryAltText ? <small className="form-error">{fieldErrors.secondaryAltText}</small> : null}
                  </div>
                ) : null}
              </div>

              <div className={styles.formActions}>
                <button type="button" className="button button-outline" onClick={resetEditor} disabled={busy}>Cancel</button>
                <button type="submit" className="button button-primary" disabled={busy}>{busyAction === 'save' ? 'Saving…' : 'Save changes'}</button>
              </div>
            </form>
          </div>
        </div>
      </dialog>
    </section>
  )
}
