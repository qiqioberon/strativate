import { ArrowRight, Award } from 'lucide-react'
import type { CSSProperties } from 'react'

import { getAsset } from '@/lib/content/asset-registry'
import type { PublicMentor } from '@/lib/mentor/public-profile-types'

import { DecorRing, NeoSticker } from './decor/decor-shapes'
import { FluentIcon, type FluentIconName } from './decor/fluent-icon'
import { MentorPortraitMedia } from './mentor-portrait-media'

// Homepage marquee card: a portrait tile at rest that opens into a detail panel on hover or keyboard focus.
// Every visible fact (tier, name, title, achievements, expertise) is the mentor's published profile data.

export type MentorRole = 'student' | 'professional' | 'mentor'

/** Maps the free-text tier name from mentor_tiers to a visual treatment only; the label itself is never rewritten. */
export function mentorRole(tier: string | null): MentorRole {
  const value = (tier ?? '').toLowerCase()
  if (value.includes('student')) return 'student'
  if (value.includes('professional')) return 'professional'
  return 'mentor'
}

const roleStyles: Record<MentorRole, { icon: FluentIconName; tone: 'amber' | 'ink' | 'cream' }> = {
  student: { icon: 'graduation-cap', tone: 'amber' },
  professional: { icon: 'briefcase', tone: 'ink' },
  mentor: { icon: 'sparkles', tone: 'cream' },
}

/** Registry URL of the role's 3D icon, for decorating markup this component does not render (the shared dialog). */
export function mentorRoleIconSrc(role: MentorRole) {
  return getAsset(`decor.icon.${roleStyles[role].icon}`).src
}

/** Only an approved, published photo counts; registry fallbacks and placeholders get a monogram instead. */
export function hasPublishedPortrait(mentor: PublicMentor) {
  if (mentor.portraitUrl) return true
  return mentor.portrait ? getAsset(mentor.portrait).status === 'ready' : false
}

/** Initials shown in place of a missing portrait (first and last word of the name). */
export function mentorInitials(name: string) {
  const words = name
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}]/gu, ''))
    .filter(Boolean)
  if (!words.length) return name.trim().charAt(0).toUpperCase()
  const first = words[0].charAt(0)
  const last = words.length > 1 ? words[words.length - 1].charAt(0) : ''
  return `${first}${last}`.toUpperCase()
}

export function MentorMarqueeCardBody({ mentor, index }: { mentor: PublicMentor; index: number }) {
  const role = mentorRole(mentor.tier)
  const { icon, tone } = roleStyles[role]
  const tierLabel = mentor.tier ?? 'Strativate mentor'
  const credentials = mentor.credentials.slice(0, 2)
  const expertise = mentor.expertise.slice(0, 2)
  const hasPhoto = hasPublishedPortrait(mentor)

  return (
    <>
      <div
        className="marketing-mentor-marquee__portrait"
        data-photo={hasPhoto ? 'ready' : 'missing'}
        style={{ '--halo-shift': `${(index % 3) - 1}` } as CSSProperties}
      >
        <span className="marketing-mentor-marquee__halo" aria-hidden="true" />
        <DecorRing className="marketing-mentor-marquee__ring" />
        {hasPhoto ? (
          <MentorPortraitMedia mentor={mentor} sizes="(max-width: 640px) 176px, 248px" priority={index < 8} />
        ) : (
          <span className="marketing-mentor-marquee__monogram" aria-hidden="true">{mentorInitials(mentor.name)}</span>
        )}
        <span className="marketing-mentor-marquee__mark" aria-hidden="true">
          <FluentIcon name={icon} size={24} />
        </span>
        <span className="marketing-mentor-marquee__caption" aria-hidden="true">
          <b>{mentor.name}</b>
          <i>{tierLabel}</i>
        </span>
      </div>
      <div className="marketing-mentor-marquee__content">
        <div className="marketing-mentor-marquee__identity">
          <NeoSticker className="marketing-mentor-marquee__tier" tone={tone} icon={<FluentIcon name={icon} size={20} />}>
            {tierLabel}
          </NeoSticker>
          <strong className="marketing-mentor-marquee__name">{mentor.name}</strong>
          {mentor.title ? <small className="marketing-mentor-marquee__title">{mentor.title}</small> : null}
        </div>
        <div className="marketing-mentor-marquee__details">
          {credentials.length ? (
            <ul className="marketing-mentor-marquee__credentials">
              {credentials.map((credential, credentialIndex) => (
                <li key={`${credentialIndex}-${credential}`}>
                  <span className="marketing-mentor-marquee__award" aria-hidden="true">
                    <Award size={13} strokeWidth={2.4} />
                  </span>
                  <span className="marketing-mentor-marquee__credential">{credential}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="marketing-mentor-marquee__footer">
            {expertise.length ? (
              <div className="marketing-mentor-marquee__expertise">
                {expertise.map((item) => <span key={item}>{item}</span>)}
              </div>
            ) : null}
            <span className="marketing-mentor-marquee__cue">
              View profile <ArrowRight aria-hidden="true" size={15} strokeWidth={2.4} />
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
