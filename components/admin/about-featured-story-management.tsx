'use client'

import {
  ArrowDown,
  ArrowUp,
  CircleAlert,
  Images,
  Plus,
  RefreshCw,
  Trash2,
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

import { AdminDeleteConfirmation } from '@/components/admin/admin-delete-confirmation'
import { AdminImageUploadField } from '@/components/admin/admin-image-upload-field'
import { useAdminImageUpload, type AdminImageUpload } from '@/components/admin/use-admin-image-upload'
import { formError } from '@/lib/auth/errors'
import {
  getNextAboutFeaturedStoryOrder,
  isAboutFeaturedStorySetupRequired,
  reorderAboutFeaturedStoryIds,
  validateAboutFeaturedStoryDraft,
  type AboutFeaturedStoryDraftErrors,
} from '@/lib/marketing/about-featured-story-admin'
import {
  ABOUT_FEATURED_STORY_BUCKET,
  ABOUT_FEATURED_STORY_PAIR_TARGET,
  ABOUT_FEATURED_STORY_PREFIX,
  ABOUT_FEATURED_STORY_SINGLE_TARGET,
  ABOUT_FEATURED_STORY_SOURCE_PREFIX,
  type AboutFeaturedStoryMediaLayout,
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

const migrationName = '202610080001_about_featured_stories.sql'

type Draft = {
  title: string
  quote: string
  attributionName: string
  attributionOrganization: string
  achievementText: string
  mediaLayout: AboutFeaturedStoryMediaLayout
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
  mediaLayout: 'single',
  primaryAltText: '',
  secondaryAltText: '',
  isActive: true,
}

function draftFromStory(story: AboutFeaturedStory): Draft {
  return {
    title: story.title,
    quote: story.quote,
    attributionName: story.attribution_name,
    attributionOrganization: story.attribution_organization,
    achievementText: story.achievement_text,
    mediaLayout: story.media_layout,
    primaryAltText: story.primary_image_alt_text,
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

export function AboutFeaturedStoryManagement() {
  const supabase = useMemo(() => createClient(), [])
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [stories, setStories] = useState<AboutFeaturedStory[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AboutFeaturedStory | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [fieldErrors, setFieldErrors] = useState<AboutFeaturedStoryDraftErrors>({})
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [setupRequired, setSetupRequired] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const primaryTarget = draft.mediaLayout === 'single'
    ? ABOUT_FEATURED_STORY_SINGLE_TARGET
    : ABOUT_FEATURED_STORY_PAIR_TARGET
  const primaryImage = useAdminImageUpload({ supabase, target: primaryTarget, onError: setError })
  const secondaryImage = useAdminImageUpload({ supabase, target: ABOUT_FEATURED_STORY_PAIR_TARGET, onError: setError })

  const selected = useMemo(
    () => stories.find(story => story.id === selectedId) ?? null,
    [stories, selectedId],
  )
  const editorOpen = creating || Boolean(selected)
  const sameLayout = Boolean(selected && selected.media_layout === draft.mediaLayout)
  const storedPrimary = sameLayout ? refsForPrimary(selected) : refsForPrimary(null)
  const storedSecondary = sameLayout && draft.mediaLayout === 'pair'
    ? refsForSecondary(selected)
    : refsForSecondary(null)
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
    setStories(data ?? [])
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
    setCreating(false)
    setSelectedId(null)
    setDraft(emptyDraft)
    primaryImage.reset()
    secondaryImage.reset()
    setFieldErrors({})
  }

  const beginCreate = () => {
    setSelectedId(null)
    setDraft(emptyDraft)
    primaryImage.reset()
    secondaryImage.reset()
    setFieldErrors({})
    setError('')
    setNotice('')
    setCreating(true)
  }

  const beginEdit = (story: AboutFeaturedStory) => {
    setCreating(false)
    setSelectedId(story.id)
    setDraft(draftFromStory(story))
    primaryImage.reset(cropRectFromJson(story.primary_image_crop))
    secondaryImage.reset(cropRectFromJson(story.secondary_image_crop))
    setFieldErrors({})
    setError('')
    setNotice('')
  }

  const setMediaLayout = (mediaLayout: AboutFeaturedStoryMediaLayout) => {
    setDraft(current => ({
      ...current,
      mediaLayout,
      secondaryAltText: mediaLayout === 'single' ? '' : current.secondaryAltText,
    }))
    if (selected && selected.media_layout === mediaLayout) {
      primaryImage.reset(cropRectFromJson(selected.primary_image_crop))
      secondaryImage.reset(cropRectFromJson(selected.secondary_image_crop))
    } else {
      primaryImage.reset()
      secondaryImage.reset()
    }
    setFieldErrors(current => ({
      ...current,
      mediaLayout: undefined,
      primaryImage: undefined,
      secondaryImage: undefined,
    }))
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
    if (busy) return
    setError('')
    setNotice('')

    const hasPrimaryImage = Boolean(primaryImage.processedFile || storedPrimary.path)
    const hasSecondaryImage = draft.mediaLayout === 'pair'
      ? Boolean(secondaryImage.processedFile || storedSecondary.path)
      : true
    const errors = validateAboutFeaturedStoryDraft({
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

      if (draft.mediaLayout === 'pair') {
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
        media_layout: draft.mediaLayout,
        primary_image_path: nextPrimary.path,
        primary_image_source_path: nextPrimary.sourcePath,
        primary_image_crop: nextPrimary.crop as unknown as Json,
        primary_image_alt_text: draft.primaryAltText.trim(),
        secondary_image_path: nextSecondary?.path ?? null,
        secondary_image_source_path: nextSecondary?.sourcePath ?? null,
        secondary_image_crop: nextSecondary?.crop ? nextSecondary.crop as unknown as Json : null,
        secondary_image_alt_text: draft.mediaLayout === 'pair' ? draft.secondaryAltText.trim() : null,
        is_active: draft.isActive,
      }

      const result = selected
        ? await supabase.from('about_featured_stories').update(payload).eq('id', selected.id)
        : await supabase.from('about_featured_stories').insert({
          ...payload,
          display_order: getNextAboutFeaturedStoryOrder(stories),
        })
      if (result.error) throw result.error

      let warning = ''
      warning += await cleanupSuperseded(oldPrimary, nextPrimary)
      warning += await cleanupSuperseded(oldSecondary, nextSecondary ?? refsForSecondary(null))

      const wasEditing = Boolean(selected)
      resetEditor()
      setNotice((wasEditing ? 'Featured Story updated.' : 'Featured Story added.') + warning)
      await load()
    } catch (saveError) {
      try {
        const { data, error: reconcileError } = await supabase.rpc('admin_list_about_featured_stories')
        if (reconcileError) throw reconcileError
        const persisted = (data ?? []).find(story => (
          (selected ? story.id === selected.id : story.primary_image_path === nextPrimary?.path)
          && story.title === draft.title.trim()
          && story.quote === draft.quote.trim()
          && story.attribution_name === draft.attributionName.trim()
          && story.attribution_organization === draft.attributionOrganization.trim()
          && story.achievement_text === draft.achievementText.trim()
          && story.media_layout === draft.mediaLayout
          && story.primary_image_path === nextPrimary?.path
          && story.primary_image_source_path === nextPrimary?.sourcePath
          && cropsMatch(story.primary_image_crop, nextPrimary?.crop ?? null)
          && story.primary_image_alt_text === draft.primaryAltText.trim()
          && story.secondary_image_path === (nextSecondary?.path ?? null)
          && story.secondary_image_source_path === (nextSecondary?.sourcePath ?? null)
          && cropsMatch(story.secondary_image_crop, nextSecondary?.crop ?? null)
          && story.secondary_image_alt_text === (draft.mediaLayout === 'pair' ? draft.secondaryAltText.trim() : null)
          && story.is_active === draft.isActive
        ))
        if (persisted) {
          let warning = ''
          warning += await cleanupSuperseded(oldPrimary, nextPrimary ?? refsForPrimary(null))
          warning += await cleanupSuperseded(oldSecondary, nextSecondary ?? refsForSecondary(null))
          resetEditor()
          setNotice('Featured Story saved after write reconciliation.' + warning)
          await load()
        } else {
          const warning = await cleanupObjects(uploaded)
          setError(formError(saveError, 'The Featured Story could not be saved.') + warning)
        }
      } catch {
        setError(formError(
          saveError,
          'The Featured Story could not be saved.',
        ) + ' New files were preserved because database status could not be confirmed. Review Storage before retrying.')
      }
    } finally {
      setBusyAction(null)
    }
  }

  const toggleActive = async (story: AboutFeaturedStory) => {
    if (busy) return
    setError('')
    setNotice('')
    setBusyAction('toggle-' + story.id)
    const { error: updateError } = await supabase
      .from('about_featured_stories')
      .update({ is_active: !story.is_active })
      .eq('id', story.id)
    if (updateError) setError(formError(updateError, 'Story visibility could not be updated.'))
    else {
      setNotice(story.is_active ? 'Story hidden from About Us.' : 'Story shown on About Us.')
      await load()
    }
    setBusyAction(null)
  }

  const move = async (index: number, direction: -1 | 1) => {
    if (busy) return
    const ids = reorderAboutFeaturedStoryIds(stories, index, direction)
    if (ids.every((id, position) => id === stories[position]?.id)) return
    setBusyAction('move-' + stories[index].id)
    setError('')
    setNotice('')
    const { error: reorderError } = await supabase.rpc('reorder_about_featured_stories', { p_ids: ids })
    if (reorderError) setError(formError(reorderError, 'Story order could not be updated.'))
    else {
      setNotice('Featured Story display order updated.')
      await load()
    }
    setBusyAction(null)
  }

  const remove = async (story: AboutFeaturedStory) => {
    if (busy) return
    setBusyAction('delete-' + story.id)
    setError('')
    setNotice('')
    const { error: deleteError } = await supabase.from('about_featured_stories').delete().eq('id', story.id)
    if (deleteError) {
      setError(formError(deleteError, 'The Featured Story could not be deleted.'))
      setBusyAction(null)
      return
    }

    let warning = ''
    const remaining = stories.filter(item => item.id !== story.id)
    if (remaining.length) {
      const { error: reorderError } = await supabase.rpc('reorder_about_featured_stories', {
        p_ids: remaining.map(item => item.id),
      })
      if (reorderError) warning += ' Remaining positions need review.'
    }
    const objects: UploadedObject[] = [
      { bucket: ABOUT_FEATURED_STORY_BUCKET, path: story.primary_image_path },
      { bucket: PHOTO_SOURCE_BUCKET, path: story.primary_image_source_path },
    ]
    if (story.secondary_image_path) objects.push({ bucket: ABOUT_FEATURED_STORY_BUCKET, path: story.secondary_image_path })
    if (story.secondary_image_source_path) objects.push({ bucket: PHOTO_SOURCE_BUCKET, path: story.secondary_image_source_path })
    warning += await cleanupObjects(objects)

    setDeleteTarget(null)
    setNotice(`Deleted Featured Story “${story.title}”.` + warning)
    await load()
    setBusyAction(null)
  }

  const pageHeader = (
    <header className={dataStyles.pageHeader}>
      <div className={dataStyles.pageHeaderCopy}>
        <p className="kicker">Content · About Us</p>
        <h2>Featured Stories</h2>
        <p>Manage approved success stories displayed after Our Expertise on the public About Us page.</p>
      </div>
      <span className={dataStyles.countPill}><Images aria-hidden="true" />{stories.length} stories</span>
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
        <p>Database migration <code>{migrationName}</code> needs to be applied before Featured Stories can be managed.</p>
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
            <p className="kicker">Editorial success stories</p>
            <h3>{stories.length} stories</h3>
            <p>Only active stories are public. Single images use 4:3; paired images use locked 4:5 crops.</p>
          </div>
          <button type="button" className="button button-primary" onClick={beginCreate} disabled={busy}>
            <Plus aria-hidden="true" /> Add Story
          </button>
        </div>

        {!stories.length ? (
          <div className={dataStyles.empty}>No Featured Stories yet. The public About page will omit this section until approved stories are added.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Media</th><th>Story</th><th>Layout</th><th>Position</th><th>Status</th><th className={styles.actionCell}>Actions</th></tr></thead>
              <tbody>
                {stories.map((story, index) => (
                  <tr key={story.id} data-testid="about-featured-story-row">
                    <td data-label="Media">
                      <div className={styles.thumbnailStack} data-layout={story.media_layout}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={publicUrl(story.primary_image_path) ?? undefined} alt="" />
                        {story.secondary_image_path ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={publicUrl(story.secondary_image_path) ?? undefined} alt="" />
                        ) : null}
                      </div>
                    </td>
                    <td data-label="Story" className={styles.storyCell}><strong>{story.title}</strong><small>{story.attribution_name} · {story.attribution_organization}</small></td>
                    <td data-label="Layout"><span className={styles.layoutPill}>{story.media_layout === 'single' ? 'Single 4:3' : 'Pair 4:5'}</span></td>
                    <td data-label="Position">
                      <span className={styles.orderControls}>
                        <span>{index + 1}</span>
                        <button type="button" className={styles.iconButton} onClick={() => void move(index, -1)} disabled={busy || index === 0} aria-label={`Move ${story.title} up`}><ArrowUp aria-hidden="true" size={15} /></button>
                        <button type="button" className={styles.iconButton} onClick={() => void move(index, 1)} disabled={busy || index === stories.length - 1} aria-label={`Move ${story.title} down`}><ArrowDown aria-hidden="true" size={15} /></button>
                      </span>
                    </td>
                    <td data-label="Status">
                      <span className={styles.statusStack}>
                        <span className={dataStyles.badge + ' ' + (story.is_active ? dataStyles.successBadge : dataStyles.mutedBadge)}>{story.is_active ? 'Active' : 'Inactive'}</span>
                        <button type="button" className={styles.statusButton} role="switch" aria-checked={story.is_active} onClick={() => void toggleActive(story)} disabled={busy}>{story.is_active ? 'Hide' : 'Show'}</button>
                      </span>
                    </td>
                    <td data-label="Actions" className={styles.actionCell}>
                      <span className={styles.actions}>
                        <button type="button" className={styles.manageButton} onClick={() => beginEdit(story)} disabled={busy}>Manage</button>
                        <button type="button" className={styles.deleteButton} onClick={() => setDeleteTarget(story)} disabled={busy}><Trash2 aria-hidden="true" size={15} /> Delete</button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <dialog
        ref={dialogRef}
        className={dialogStyles.dialog}
        aria-labelledby="about-featured-story-editor-heading"
        onCancel={event => { if (busy) event.preventDefault(); else resetEditor() }}
        onClose={() => { if (!busy && editorOpen) resetEditor() }}
        onClick={event => { if (event.target === event.currentTarget && !busy) resetEditor() }}
      >
        <div className={dialogStyles.panel}>
          <header className={dialogStyles.header}>
            <div>
              <p className="kicker">{creating ? 'New Featured Story' : 'Manage Featured Story'}</p>
              <h2 id="about-featured-story-editor-heading">{creating ? 'Add Featured Story' : selected?.title}</h2>
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
                <label>
                  Media layout
                  <select value={draft.mediaLayout} onChange={event => setMediaLayout(event.target.value as AboutFeaturedStoryMediaLayout)}>
                    <option value="single">Single editorial image · 4:3</option>
                    <option value="pair">Two portrait images · 4:5</option>
                  </select>
                </label>
                <label className={styles.activeToggle}>
                  <span><strong>Active</strong><small>Show this approved story publicly.</small></span>
                  <input type="checkbox" checked={draft.isActive} onChange={event => setDraft(current => ({ ...current, isActive: event.target.checked }))} />
                </label>
              </div>

              <div className={styles.mediaSection}>
                <div className={styles.mediaSlot}>
                  <div><strong>Primary image</strong><span>{draft.mediaLayout === 'single' ? 'Locked 4:3 crop · 1200 × 900 WebP' : 'Locked 4:5 crop · 1000 × 1250 WebP'}</span></div>
                  <AdminImageUploadField
                    image={primaryImage}
                    target={primaryTarget}
                    storedUrl={publicUrl(storedPrimary.path)}
                    sourcePath={storedPrimary.sourcePath}
                    alt={draft.primaryAltText || 'Primary Featured Story image preview'}
                    disabled={busy}
                    onApplied={() => setFieldErrors(current => ({ ...current, primaryImage: undefined }))}
                  />
                  <label>
                    Primary image alt text
                    <input value={draft.primaryAltText} maxLength={300} onChange={event => { setDraft(current => ({ ...current, primaryAltText: event.target.value })); setFieldErrors(current => ({ ...current, primaryAltText: undefined })) }} aria-invalid={Boolean(fieldErrors.primaryAltText)} />
                  </label>
                  {fieldErrors.primaryImage ? <small className="form-error">{fieldErrors.primaryImage}</small> : null}
                  {fieldErrors.primaryAltText ? <small className="form-error">{fieldErrors.primaryAltText}</small> : null}
                </div>

                {draft.mediaLayout === 'pair' ? (
                  <div className={styles.mediaSlot}>
                    <div><strong>Secondary image</strong><span>Locked 4:5 crop · 1000 × 1250 WebP</span></div>
                    <AdminImageUploadField
                      image={secondaryImage}
                      target={ABOUT_FEATURED_STORY_PAIR_TARGET}
                      storedUrl={publicUrl(storedSecondary.path)}
                      sourcePath={storedSecondary.sourcePath}
                      alt={draft.secondaryAltText || 'Secondary Featured Story image preview'}
                      disabled={busy}
                      onApplied={() => setFieldErrors(current => ({ ...current, secondaryImage: undefined }))}
                    />
                    <label>
                      Secondary image alt text
                      <input value={draft.secondaryAltText} maxLength={300} onChange={event => { setDraft(current => ({ ...current, secondaryAltText: event.target.value })); setFieldErrors(current => ({ ...current, secondaryAltText: undefined })) }} aria-invalid={Boolean(fieldErrors.secondaryAltText)} />
                    </label>
                    {fieldErrors.secondaryImage ? <small className="form-error">{fieldErrors.secondaryImage}</small> : null}
                    {fieldErrors.secondaryAltText ? <small className="form-error">{fieldErrors.secondaryAltText}</small> : null}
                  </div>
                ) : null}
              </div>

              <div className={styles.formActions}>
                <button type="button" className="button button-outline" onClick={resetEditor} disabled={busy}>Cancel</button>
                <button type="submit" className="button button-primary" disabled={busy}>{busyAction === 'save' ? 'Saving…' : creating ? 'Add Story' : 'Save changes'}</button>
              </div>
            </form>
          </div>
        </div>
      </dialog>

      <AdminDeleteConfirmation
        open={Boolean(deleteTarget)}
        title={deleteTarget ? `Delete “${deleteTarget.title}”?` : 'Delete Featured Story?'}
        description="This removes the story and its managed image files. This action cannot be undone."
        busy={Boolean(deleteTarget && busyAction === 'delete-' + deleteTarget.id)}
        onCancel={() => { if (!busy) setDeleteTarget(null) }}
        onConfirm={() => { if (deleteTarget) void remove(deleteTarget) }}
      />
    </section>
  )
}
