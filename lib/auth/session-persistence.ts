import type { CookieOptions } from '@supabase/ssr'

export const AUTH_PERSISTENCE_COOKIE = 'strativate_auth_persistence'
export const AUTH_PERSISTENCE_MAX_AGE = 400 * 24 * 60 * 60

export type AuthPersistenceMode = 'persistent' | 'session'
export type AuthCookieToSet = { name: string; value: string; options: CookieOptions }

export function authPersistenceModeFromCookieValue(value?: string | null): AuthPersistenceMode {
  return value === 'session' ? 'session' : 'persistent'
}

export function applyAuthCookiePersistence<T extends AuthCookieToSet>(values: readonly T[], mode: AuthPersistenceMode): T[] {
  if (mode !== 'session') return [...values]
  return values.map(cookie => {
    if (!cookie.value || cookie.options.maxAge === 0) return cookie
    const options = { ...cookie.options }
    delete options.expires
    delete options.maxAge
    return { ...cookie, options } as T
  })
}

function sameSiteValue(value: CookieOptions['sameSite']) {
  if (value === true) return 'Strict'
  if (typeof value !== 'string') return null
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}

export function serializeBrowserCookie(name: string, value: string, options: CookieOptions = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`]
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.trunc(options.maxAge)}`)
  if (options.domain) parts.push(`Domain=${options.domain}`)
  if (options.path) parts.push(`Path=${options.path}`)
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`)
  if (options.httpOnly) parts.push('HttpOnly')
  if (options.secure) parts.push('Secure')
  const sameSite = sameSiteValue(options.sameSite)
  if (sameSite) parts.push(`SameSite=${sameSite}`)
  if (options.priority) parts.push(`Priority=${options.priority.charAt(0).toUpperCase()}${options.priority.slice(1)}`)
  if (options.partitioned) parts.push('Partitioned')
  return parts.join('; ')
}

export function serializeAuthPersistenceCookie(mode: AuthPersistenceMode, secure: boolean) {
  return serializeBrowserCookie(AUTH_PERSISTENCE_COOKIE, mode, {
    path: '/',
    sameSite: 'lax',
    secure,
    ...(mode === 'persistent' ? { maxAge: AUTH_PERSISTENCE_MAX_AGE } : {}),
  })
}

function browserIsSecure() {
  return typeof window !== 'undefined' && window.location.protocol === 'https:'
}

export function readBrowserCookies() {
  if (typeof document === 'undefined' || !document.cookie) return []
  return document.cookie.split(';').map(part => {
    const cookie = part.trim()
    const separator = cookie.indexOf('=')
    const name = separator >= 0 ? cookie.slice(0, separator) : cookie
    const rawValue = separator >= 0 ? cookie.slice(separator + 1) : ''
    try { return { name, value: decodeURIComponent(rawValue) } }
    catch { return { name, value: rawValue } }
  })
}

export function readBrowserAuthPersistenceMode() {
  const value = readBrowserCookies().find(cookie => cookie.name === AUTH_PERSISTENCE_COOKIE)?.value
  return authPersistenceModeFromCookieValue(value)
}

export function writeBrowserCookie(cookie: AuthCookieToSet) {
  document.cookie = serializeBrowserCookie(cookie.name, cookie.value, cookie.options)
}

export function setBrowserAuthPersistenceMode(mode: AuthPersistenceMode) {
  document.cookie = serializeAuthPersistenceCookie(mode, browserIsSecure())
}

export function clearBrowserAuthPersistenceMode() {
  document.cookie = serializeBrowserCookie(AUTH_PERSISTENCE_COOKIE, '', {
    path: '/', sameSite: 'lax', secure: browserIsSecure(), maxAge: 0,
  })
}
