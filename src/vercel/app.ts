import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'

import type { AppContext, Env } from '../worker/env'
import { activities } from '../worker/routes/activities'
import { companies } from '../worker/routes/companies'
import { contacts } from '../worker/routes/contacts'
import { deals } from '../worker/routes/deals'
import { files } from '../worker/routes/files'
import { tasks } from '../worker/routes/tasks'
import { workspace } from '../worker/routes/workspace'
import { checkPassword, clearCookie, createSessionToken, readSession, sessionCookie } from './auth'
import { createFileBucket } from './blob'
import { ensureSchema, getDatabase } from './pg'

// The Vercel build reuses every route from src/worker unchanged; only the
// environment around them differs (Postgres instead of D1/R2, password
// sessions instead of Sign in with Freebuff).

const originOf = (request: Request) => new URL(request.url).origin

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (origin) return origin === originOf(request)
  const referer = request.headers.get('referer')
  if (referer) {
    try {
      return new URL(referer).origin === originOf(request)
    } catch {
      return false
    }
  }
  return true
}

/** Environment built from the Vercel project's environment variables. */
export function appEnv(): Env {
  const url = process.env.DATABASE_URL
  const db = url ? getDatabase(url) : undefined
  return {
    DATABASE_URL: url,
    APP_PASSWORD: process.env.APP_PASSWORD,
    APP_SECRET: process.env.APP_SECRET,
    DB: db as unknown as D1Database,
    FILES: db ? (createFileBucket(db.pool) as unknown as R2Bucket) : undefined,
  } as unknown as Env
}

const requireSignedIn: MiddlewareHandler<AppContext> = async (c, next) => {
  const request = c.req.raw
  if (request.method !== 'GET' && request.method !== 'HEAD' && !sameOrigin(request)) {
    return c.json({ error: 'Cross-origin request refused.' }, 403)
  }
  if (!c.env.APP_SECRET) {
    return c.json({ error: 'auth_misconfigured', message: 'APP_SECRET is not set for this deployment.' }, 503)
  }
  const session = readSession(request, c.env.APP_SECRET)
  if (!session) return c.json({ error: 'Sign in required.' }, 401)
  if (!c.env.DATABASE_URL) {
    return c.json({ error: 'database_missing', message: 'DATABASE_URL is not set for this deployment.' }, 503)
  }
  const db = getDatabase(c.env.DATABASE_URL)
  await ensureSchema(db)
  c.set('db', db as unknown as D1Database)
  c.set('user', { sub: session.sub, name: 'Your Company', email: 'owner@yourcompany.com', email_verified: true } as never)
  await next()
}

export function createApp() {
  const app = new Hono<AppContext>()

  // Public: tells the app which sign-in screen to show.
  app.get('/api/auth/status', (c) => {
    c.header('Cache-Control', 'private, no-store')
    return c.json({
      mode: c.env.APP_PASSWORD ? 'password' : 'off',
      database: Boolean(c.env.DATABASE_URL),
      files: Boolean(c.env.DATABASE_URL),
    })
  })

  app.post('/api/auth/signin', async (c) => {
    if (!sameOrigin(c.req.raw)) return c.json({ error: 'Cross-origin request refused.' }, 403)
    const body = await c.req.json<{ password?: string }>().catch(() => ({}) as { password?: string })
    if (!c.env.APP_PASSWORD || !c.env.APP_SECRET) {
      return c.json({ error: 'auth_misconfigured', message: 'APP_PASSWORD and APP_SECRET must be set.' }, 503)
    }
    if (!body.password || !checkPassword(body.password, c.env.APP_PASSWORD)) {
      return c.json({ error: 'Wrong password.' }, 401)
    }
    const secure = new URL(c.req.url).protocol === 'https:'
    c.header('Set-Cookie', sessionCookie(createSessionToken(c.env.APP_SECRET), secure))
    return c.json({ ok: true })
  })

  app.post('/api/auth/signout', (c) => {
    c.header('Set-Cookie', clearCookie(new URL(c.req.url).protocol === 'https:'))
    return c.json({ ok: true })
  })

  app.get('/api/health', (c) => c.json({ ok: true }))

  const api = new Hono<AppContext>()
  api.use('*', requireSignedIn)
  api.route('/', workspace)
  api.route('/contacts', contacts)
  api.route('/companies', companies)
  api.route('/deals', deals)
  api.route('/tasks', tasks)
  api.route('/activities', activities)
  api.route('/files', files)
  app.route('/api', api)

  app.onError((error, c) => {
    console.error(error)
    return c.json({ error: 'Something went wrong.' }, 500)
  })
  app.notFound((c) => c.json({ error: 'Not found.' }, 404))

  return app
}
