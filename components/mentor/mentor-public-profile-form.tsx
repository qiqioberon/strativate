'use client'

import { ArrowDown, ArrowUp, Award, CheckCircle2, CircleDot, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { useAccount } from '@/components/auth/account-provider'
import { displayName } from '@/lib/auth/rules'
import {
  emptyMentorPublicProfileData,
  type MentorExpertiseOption,
  type MentorPublicAchievementView,
  type MentorPublicProfileView,
  type MyMentorPublicProfileData,
} from '@/lib/mentor/public-profile-types'
import { createClient } from '@/lib/supabase/client'

import styles from './mentor-public-profile.module.css'

type Draft = {
  displayName: string
  headline: string
  linkedinUrl: string
  portraitUrl: string
  shortBio: string
  expertiseIds: string[]
  achievements: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function normalizeSavedPayload(value: unknown): MyMentorPublicProfileData {
  if (!isRecord(value)) return emptyMentorPublicProfileData
  return {
    profile: isRecord(value.profile) ? value.profile as MentorPublicProfileView : null,
    achievements: Array.isArray(value.achievements) ? value.achievements as MentorPublicAchievementView[] : [],
    expertise_ids: Array.isArray(value.expertise_ids) ? value.expertise_ids.filter((item): item is string => typeof item === 'string') : [],
    expertise_options: Array.isArray(value.expertise_options) ? value.expertise_options as MentorExpertiseOption[] : [],
  }
}

function toDraft(data: MyMentorPublicProfileData, fallbackName: string): Draft {
  return {
    displayName: data.profile?.display_name || fallbackName,
    headline: data.profile?.headline || '',
    linkedinUrl: data.profile?.linkedin_url || '',
    portraitUrl: data.profile?.portrait_url || '',
    shortBio: data.profile?.short_bio || '',
    expertiseIds: [...data.expertise_ids],
    achievements: data.achievements.map(item => item.achievement),
  }
}

function publicationLabel(status: 'draft' | 'published' | undefined) {
  return status === 'published' ? 'Published' : 'Draft'
}

function normalizeLoadError(loadError: string | null) {
  return loadError ? 'Public profile could not be loaded.' : null
}

export function MentorPublicProfileForm({ initialData, loadError }: { initialData: MyMentorPublicProfileData; loadError: string | null }) {
  const account = useAccount()
  const fallbackName = displayName(account, 'en')
  const [data, setData] = useState(initialData)
  const [draft, setDraft] = useState(() => toDraft(initialData, fallbackName))
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(normalizeLoadError(loadError))
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    setData(initialData)
    setDraft(toDraft(initialData, fallbackName))
    setError(normalizeLoadError(loadError))
  }, [fallbackName, initialData, loadError])

  const expertiseById = useMemo(() => new Map(data.expertise_options.map(option => [option.id, option])), [data.expertise_options])
  const selectedExpertise = draft.expertiseIds.map(id => expertiseById.get(id)).filter((value): value is MentorExpertiseOption => Boolean(value))

  function startEditing() {
    setDraft(toDraft(data, fallbackName))
    setError(normalizeLoadError(loadError))
    setNotice(null)
    setEditing(true)
  }

  function cancelEditing() {
    setDraft(toDraft(data, fallbackName))
    setError(normalizeLoadError(loadError))
    setNotice(null)
    setEditing(false)
  }

  function toggleExpertise(id: string) {
    setDraft(current => ({
      ...current,
      expertiseIds: current.expertiseIds.includes(id)
        ? current.expertiseIds.filter(value => value !== id)
        : [...current.expertiseIds, id],
    }))
  }

  function updateAchievement(index: number, value: string) {
    setDraft(current => ({
      ...current,
      achievements: current.achievements.map((item, itemIndex) => itemIndex === index ? value : item),
    }))
  }

  function moveAchievement(index: number, direction: -1 | 1) {
    setDraft(current => {
      const next = index + direction
      if (next < 0 || next >= current.achievements.length) return current
      const achievements = [...current.achievements]
      ;[achievements[index], achievements[next]] = [achievements[next], achievements[index]]
      return { ...current, achievements }
    })
  }

  function removeAchievement(index: number) {
    setDraft(current => ({ ...current, achievements: current.achievements.filter((_, itemIndex) => itemIndex !== index) }))
  }

  async function save() {
    if (!draft.displayName.trim()) {
      setError('Display name is required.')
      return
    }
    setSaving(true)
    setError(null)
    setNotice(null)
    const supabase = createClient()
    const { data: saved, error: saveError } = await supabase.rpc('save_my_mentor_public_profile', {
      p_display_name: draft.displayName.trim(),
      p_headline: draft.headline.trim() || null,
      p_linkedin_url: draft.linkedinUrl.trim() || null,
      p_short_bio: draft.shortBio.trim() || null,
      p_portrait_url: draft.portraitUrl.trim() || null,
      p_expertise_ids: draft.expertiseIds,
      p_achievements: draft.achievements.map(item => item.trim()).filter(Boolean),
    })
    setSaving(false)
    if (saveError) {
      setError('Public profile could not be saved.')
      return
    }
    const normalized = normalizeSavedPayload(saved)
    setData(normalized)
    setDraft(toDraft(normalized, fallbackName))
    setEditing(false)
    setNotice('Public profile saved.')
  }

  const profile = data.profile
  const published = profile?.publication_status === 'published'

  return (
    <section className={`workspace-card ${styles.card}`} data-testid="mentor-public-profile-card">
      <div className={styles.header}>
        <h2>Public profile</h2>
        {!editing ? (
          <button type="button" className={`button button-outline ${styles.editButton}`} onClick={startEditing} data-testid="mentor-public-profile-edit-button">
            {profile ? 'Edit public profile' : 'Set up public profile'}
          </button>
        ) : null}
      </div>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {notice ? <p className={styles.notice} role="status">{notice}</p> : null}

      {!editing ? (
        <div className={styles.readOnly} data-testid="mentor-public-profile-readonly">
          <div className={styles.statusRow}>
            <span className={`${styles.statusChip} ${published ? styles.published : styles.draft}`}>
              {published ? <CheckCircle2 aria-hidden="true" /> : <CircleDot aria-hidden="true" />}
              {publicationLabel(profile?.publication_status)}
            </span>
            <span className={`${styles.statusChip} ${styles.tier}`}>
              <Award aria-hidden="true" />
              {profile?.tier_name || 'Tier not assigned'}
            </span>
          </div>

          <dl className={styles.summaryGrid}>
            <div><dt>Display name</dt><dd>{profile?.display_name || fallbackName}</dd></div>
            <div><dt>Headline</dt><dd>{profile?.headline || 'Not provided'}</dd></div>
            <div><dt>LinkedIn</dt><dd>{profile?.linkedin_url ? <a href={profile.linkedin_url} target="_blank" rel="noreferrer">{profile.linkedin_url}</a> : 'Not provided'}</dd></div>
            <div><dt>Portrait</dt><dd>{profile?.portrait_url ? 'Public URL saved' : profile?.portrait_asset_key ? 'Roster portrait available' : 'Not available'}</dd></div>
          </dl>

          <div className={styles.section}>
            <h3>Expertise</h3>
            {data.expertise_ids.length ? (
              <div className={styles.chips}>
                {data.expertise_ids.map(id => {
                  const option = expertiseById.get(id)
                  return option ? (
                    <span className={styles.expertiseChip} key={id}>
                      {option.name}
                      {!option.is_active ? <small>Inactive</small> : null}
                    </span>
                  ) : null
                })}
              </div>
            ) : <p>No expertise selected</p>}
          </div>

          <div className={styles.section}>
            <h3>Short bio</h3>
            <p>{profile?.short_bio || 'No short bio added'}</p>
          </div>

          <div className={styles.section}>
            <h3>Achievements</h3>
            {data.achievements.length ? (
              <ol className={styles.achievementList}>
                {data.achievements.map(item => <li key={item.id}>{item.achievement}</li>)}
              </ol>
            ) : <p>No achievements added</p>}
          </div>
        </div>
      ) : (
        <div className={styles.form} data-testid="mentor-public-profile-edit-form">
          <div className={styles.fieldGrid}>
            <label><span>Display name</span><input value={draft.displayName} maxLength={120} onChange={event => setDraft(current => ({ ...current, displayName: event.target.value }))} /></label>
            <label><span>Professional headline</span><input value={draft.headline} maxLength={180} onChange={event => setDraft(current => ({ ...current, headline: event.target.value }))} /></label>
            <label><span>LinkedIn</span><input type="url" value={draft.linkedinUrl} placeholder="https://www.linkedin.com/in/..." onChange={event => setDraft(current => ({ ...current, linkedinUrl: event.target.value }))} /></label>
            <label><span>Public portrait URL</span><input type="url" value={draft.portraitUrl} placeholder="https://..." onChange={event => setDraft(current => ({ ...current, portraitUrl: event.target.value }))} /></label>
          </div>

          <label className={styles.fullField}><span>Short bio</span><textarea rows={4} maxLength={1200} value={draft.shortBio} onChange={event => setDraft(current => ({ ...current, shortBio: event.target.value }))} /></label>

          <fieldset className={styles.fieldset}>
            <legend>Expertise</legend>
            <p>Choose the areas you want shown on your public profile.</p>
            {data.expertise_options.length ? <div className={styles.expertiseGrid}>{data.expertise_options.map(option => {
              const checked = draft.expertiseIds.includes(option.id)
              return <label className={styles.expertiseOption} key={option.id}><input type="checkbox" checked={checked} onChange={() => toggleExpertise(option.id)} /><span>{option.name}{!option.is_active ? <small>Inactive</small> : null}</span></label>
            })}</div> : <p>No expertise has been configured yet.</p>}
          </fieldset>

          <fieldset className={styles.fieldset}>
            <legend>Achievements</legend>
            <div className={styles.fieldsetHeader}><p>Use the controls to set the display order.</p><button type="button" className={`button button-outline ${styles.addAchievement}`} onClick={() => setDraft(current => ({ ...current, achievements: [...current.achievements, ''] }))} disabled={draft.achievements.length >= 30}><Plus aria-hidden="true" />Add achievement</button></div>
            {draft.achievements.length ? <div className={styles.achievementEditor}>{draft.achievements.map((achievement, index) => (
              <div className={styles.achievementRow} key={`achievement-${index}`}>
                <textarea aria-label={`Achievement ${index + 1}`} rows={2} maxLength={500} value={achievement} onChange={event => updateAchievement(index, event.target.value)} />
                <div className={styles.achievementActions}>
                  <button type="button" onClick={() => moveAchievement(index, -1)} disabled={index === 0} aria-label={`Move achievement ${index + 1} up`}><ArrowUp aria-hidden="true" />Move up</button>
                  <button type="button" onClick={() => moveAchievement(index, 1)} disabled={index === draft.achievements.length - 1} aria-label={`Move achievement ${index + 1} down`}><ArrowDown aria-hidden="true" />Move down</button>
                  <button type="button" className={styles.removeAchievement} onClick={() => removeAchievement(index)} aria-label={`Remove achievement ${index + 1}`}><Trash2 aria-hidden="true" />Remove</button>
                </div>
              </div>
            ))}</div> : <p>No achievements added</p>}
          </fieldset>

          <div className={styles.actions}>
            <button type="button" className="button button-outline" onClick={cancelEditing} disabled={saving}>Cancel</button>
            <button type="button" className="button button-primary" onClick={save} disabled={saving} data-testid="mentor-public-profile-save-button">{saving ? 'Saving…' : 'Save public profile'}</button>
          </div>
          {selectedExpertise.some(item => !item.is_active) ? <p className={styles.helper}>Inactive expertise remains linked until you remove it.</p> : null}
        </div>
      )}
    </section>
  )
}
