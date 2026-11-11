import type { Pool } from 'pg'

// Files are stored as bytea rows so the whole app needs only one service.
// The keys and the R2-style put/get/delete shape match what the routes expect.

export interface BucketObject {
  body: ReadableStream
  size: number
  httpMetadata?: { contentType?: string }
}

export function createFileBucket(pool: Pool) {
  return {
    async put(
      key: string,
      body: ReadableStream | ArrayBuffer | Uint8Array | string,
      options?: { httpMetadata?: { contentType?: string } },
    ) {
      let bytes: Uint8Array
      if (typeof body === 'string') bytes = new TextEncoder().encode(body)
      else if (body instanceof ArrayBuffer) bytes = new Uint8Array(body)
      else if (body instanceof Uint8Array) bytes = body
      else bytes = new Uint8Array(await new Response(body).arrayBuffer())

      const owner = key.split('/')[0] ?? 'owner'
      const mime = options?.httpMetadata?.contentType ?? 'application/octet-stream'
      await pool.query(
        `INSERT INTO file_blobs (key, owner_sub, data, mime, size, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, mime = EXCLUDED.mime, size = EXCLUDED.size`,
        [key, owner, Buffer.from(bytes), mime, bytes.byteLength, Date.now()],
      )
      return { key, size: bytes.byteLength }
    },

    async get(key: string): Promise<BucketObject | null> {
      const result = await pool.query('SELECT data, mime, size FROM file_blobs WHERE key = $1', [key])
      const row = result.rows[0] as { data: Buffer; mime: string; size: number } | undefined
      if (!row) return null
      return {
        body: new Blob([new Uint8Array(row.data)]).stream(),
        size: Number(row.size),
        httpMetadata: { contentType: row.mime },
      }
    },

    async delete(key: string) {
      await pool.query('DELETE FROM file_blobs WHERE key = $1', [key])
    },
  }
}
