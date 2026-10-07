import { notificationMetadata, type KnownNotificationType } from '@/lib/realtime/operational-invalidation'
import type { Notification } from '@/lib/supabase/database.types'

export const notificationCategoryLabels = {
  all: 'All categories',
  commerce: 'Orders & payments',
  mentoring: 'Mentoring',
  meeting: 'Zoom & calendar',
  account: 'Account updates',
} as const

// Historical records retain their original content. Translate known events at
// display time, so both notification surfaces use the same English wording.
const eventCopy = {
  order_pending: { title: 'Payment pending', message: 'An order is waiting for payment.' },
  payment_paid: { title: 'Payment successful', message: 'Your purchased products or mentoring are now available.' },
  competition_updated: { title: 'Competition updated', message: 'Competition details for this mentoring program have changed.' },
  competition_reviewed: { title: 'Competition reviewed', message: 'The Strativate team updated your competition details.' },
  mentor_assigned: { title: 'Mentor assigned', message: 'A mentor has been assigned to your mentoring session.' },
  mentoring_attention: { title: 'Mentoring review needed', message: 'Session preferences are waiting for review.' },
  topic_reviewed: { title: 'Session topic confirmed', message: 'The Strativate team confirmed your session topic and scope.' },
  topic_resolved: { title: 'Session focus confirmed', message: 'The Strativate team confirmed the focus for your Intensive Mentoring session.' },
  scope_updated: { title: 'Session scope updated', message: 'The confirmed topic and scope for this session have changed.' },
  session_scheduled: { title: 'Mentoring schedule updated', message: 'Your session has been scheduled or its schedule has changed. View the current details.' },
  session_cancelled: { title: 'Session cancelled', message: 'This mentoring session has been cancelled.' },
  meeting_url_changed: { title: 'Meeting link available', message: 'Your session meeting link is available or has changed. View the current link.' },
  zoom_failed: { title: 'Meeting needs attention', message: 'Check the current meeting link in your session details.' },
  calendar_failed: { title: 'Calendar sync needs attention', message: 'Check your Google Calendar connection and try again.' },
  recording_failed: { title: 'Recording needs attention', message: 'Contact the Strativate team about this session recording.' },
} satisfies Record<KnownNotificationType, { title: string; message: string }>

export function presentNotification(item: Notification): { category: string; title: string; message: string } {
  const known = Object.prototype.hasOwnProperty.call(eventCopy, item.type)
  if (!known) {
    return { category: notificationCategoryLabels.account, title: item.title || 'Account update', message: item.message || 'View related details for this update.' }
  }
  const type = item.type as KnownNotificationType
  const copy = eventCopy[type]
  let message = copy.message
  if (item.type === 'mentor_assigned') {
    message = item.recipient_role === 'mentor'
      ? 'You have been assigned to a mentoring session.'
      : item.related_entity === 'intensive_mentoring_engagement'
        ? 'Your dedicated Intensive Mentoring mentor has been assigned.'
        : 'A mentor has been assigned to your mentoring session.'
  } else if (item.recipient_role === 'admin' && item.type === 'payment_paid') {
    message = 'Payment has been verified for this order.'
  } else if (item.recipient_role === 'mentor' && item.type === 'session_scheduled') {
    message = 'A session assigned to you has been scheduled or its schedule has changed.'
  }
  return { category: notificationCategoryLabels[notificationMetadata[type].category], title: copy.title, message }
}

export function notificationDate(value: string, locale = 'en-GB') {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
