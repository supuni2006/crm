import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

// Password sessions for the Vercel build. Sign in with Freebuff is bound to the
// Freebuff Sites origin, so a vercel.app deployment needs its own sign-in.
const COOKIE = 'crm_session'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30

export interface Session {
  sub: string
  exp: number
}

const digest = (value: string) => createHash('sha256').update(value).digest()

/** Constant-time comparison, so a wrong password leaks nothing by timing. */
export function checkPassword(input: string, expected: string): boolean {
  if (!expected) return false
  return timingSafeEqual(digest(input), digest(expected))
}

const sign = (payload: string, secret: string) => createHmac('sha256', secret).update(payload).digest('base64url')

export function createSessionToken(secret: string, sub = 'owner'): string {
  const payload = Buffer.from(JSON.stringify({ sub, exp: Date.now() + MAX_AGE_SECONDS * 1000 })).toString('base64url')
  return `${payload}.${sign(payload, secret)}`
}

export function readSession(request: Request, secret: string | undefined): Session | null {
  if (!secret) return null
  const header = request.headers.get('cookie')
  if (!header) return null
  const raw = header
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE}=`))
  if (!raw) return null

  const token = raw.slice(COOKIE.length + 1)
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null

  const given = Buffer.from(signature)
  const wanted = Buffer.from(sign(payload, secret))
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return null

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Session
    if (!parsed.sub || typeof parsed.exp !== 'number' || parsed.exp < Date.now()) return null
    return parsed
  } catch {
    return null
  }
}

export function sessionCookie(token: string, secure: boolean): string {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}${secure ? '; Secure' : ''}`
}

export function clearCookie(secure: boolean): string {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`
}
