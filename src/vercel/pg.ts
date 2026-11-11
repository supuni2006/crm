import { Pool, types } from 'pg'

// Postgres hands BIGINT back as a string; the app treats every *_at column and
// count as a number, so parse int8 as one.
types.setTypeParser(types.builtins.INT8, (value) => (value === null ? null : Number(value)))

/** Postgres schema for the same tables the D1 build creates. */
export const PG_SCHEMA = `
CREATE TABLE IF NOT EXISTS workspaces (
  owner_sub TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  seeded_at BIGINT,
  created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  owner_sub TEXT NOT NULL,
  name TEXT NOT NULL,
  domain TEXT,
  industry TEXT,
  size TEXT,
  location TEXT,
  hue INTEGER NOT NULL DEFAULT 220,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS companies_owner ON companies(owner_sub, name);
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  owner_sub TEXT NOT NULL,
  company_id TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'lead',
  avatar_key TEXT,
  hue INTEGER NOT NULL DEFAULT 220,
  last_activity_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS contacts_owner ON contacts(owner_sub, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS contacts_company ON contacts(owner_sub, company_id);
CREATE TABLE IF NOT EXISTS deals (
  id TEXT PRIMARY KEY,
  owner_sub TEXT NOT NULL,
  title TEXT NOT NULL,
  company_id TEXT,
  contact_id TEXT,
  value BIGINT NOT NULL DEFAULT 0,
  stage TEXT NOT NULL DEFAULT 'lead',
  position DOUBLE PRECISION NOT NULL DEFAULT 0,
  close_date TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS deals_owner ON deals(owner_sub, stage, position);
CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  owner_sub TEXT NOT NULL,
  kind TEXT NOT NULL,
  body TEXT NOT NULL,
  contact_id TEXT,
  deal_id TEXT,
  company_id TEXT,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS activities_owner ON activities(owner_sub, created_at DESC);
CREATE INDEX IF NOT EXISTS activities_contact ON activities(owner_sub, contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activities_deal ON activities(owner_sub, deal_id, created_at DESC);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  owner_sub TEXT NOT NULL,
  title TEXT NOT NULL,
  due_at BIGINT,
  done_at BIGINT,
  contact_id TEXT,
  deal_id TEXT,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS tasks_owner ON tasks(owner_sub, done_at, due_at);
CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  owner_sub TEXT NOT NULL,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  size BIGINT NOT NULL,
  mime TEXT NOT NULL,
  contact_id TEXT,
  deal_id TEXT,
  company_id TEXT,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS files_owner ON files(owner_sub, created_at DESC);
-- File bytes live beside their row, so one database holds everything.
CREATE TABLE IF NOT EXISTS file_blobs (
  key TEXT PRIMARY KEY,
  owner_sub TEXT NOT NULL,
  data BYTEA NOT NULL,
  mime TEXT NOT NULL,
  size BIGINT NOT NULL,
  created_at BIGINT NOT NULL
);
`

type PgValue = string | number | boolean | Buffer | null

/**
 * Rewrites SQLite/D1 `?` placeholders to Postgres `$1..$n`, leaving any
 * question mark inside a quoted literal alone.
 */
export function toPlaceholders(sql: string): string {
  let out = ''
  let index = 0
  let quoted = false
  for (const char of sql) {
    if (char === "'") quoted = !quoted
    if (char === '?' && !quoted) {
      index += 1
      out += `$${index}`
      continue
    }
    out += char
  }
  return out
}

function normalise(value: unknown): PgValue {
  if (value === undefined || value === null) return null
  if (value instanceof Uint8Array) return Buffer.from(value)
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') return value
  return JSON.stringify(value)
}

/** A prepared statement with the slice of the D1 API the routes use. */
export class Statement {
  constructor(
    readonly pool: Pool,
    readonly sql: string,
    readonly values: PgValue[] = [],
  ) {}

  bind(...values: unknown[]) {
    return new Statement(
      this.pool,
      this.sql,
      values.map((value) => normalise(value)),
    )
  }

  async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
    const result = await this.pool.query(toPlaceholders(this.sql), this.values)
    return { results: result.rows as T[] }
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const { results } = await this.all<T>()
    return results[0] ?? null
  }

  async run(): Promise<{ success: true; rowCount: number }> {
    const result = await this.pool.query(toPlaceholders(this.sql), this.values)
    return { success: true, rowCount: result.rowCount ?? 0 }
  }
}

/** D1-shaped facade over a Postgres pool: prepare/bind/all/first/run/batch. */
export class PostgresDatabase {
  constructor(readonly pool: Pool) {}

  prepare(sql: string) {
    return new Statement(this.pool, sql)
  }

  async batch(statements: Statement[]): Promise<{ results: Record<string, unknown>[] }[]> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const out: { results: Record<string, unknown>[] }[] = []
      for (const statement of statements) {
        const result = await client.query(toPlaceholders(statement.sql), statement.values)
        out.push({ results: result.rows })
      }
      await client.query('COMMIT')
      return out
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw error
    } finally {
      client.release()
    }
  }
}

let cached: { url: string; pool: Pool; db: PostgresDatabase } | undefined
let schema: Promise<void> | undefined

/** One pool per warm serverless instance, created on first use. */
export function getDatabase(url: string): PostgresDatabase {
  if (cached?.url !== url) {
    const pool = new Pool({
      connectionString: url,
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      ssl: url.includes('localhost') || url.includes('127.0.0.1') ? undefined : { rejectUnauthorized: false },
    })
    cached = { url, pool, db: new PostgresDatabase(pool) }
    schema = undefined
  }
  schema ??= cached.pool.query(PG_SCHEMA).then(
    () => undefined,
    (error) => {
      schema = undefined
      throw error
    },
  )
  return cached.db
}

export function ensureSchema(db: PostgresDatabase): Promise<void> {
  schema ??= db.pool.query(PG_SCHEMA).then(
    () => undefined,
    (error) => {
      schema = undefined
      throw error
    },
  )
  return schema
}
