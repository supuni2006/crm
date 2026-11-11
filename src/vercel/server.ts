import { getRequestListener } from '@hono/node-server'

import { appEnv, createApp } from './app'

// Bundled by scripts/build-api.mjs into a single file, because Vercel's
// zero-config function build keeps ESM imports unbundled and cannot resolve
// them outside api/. The bundle is what actually runs (see vercel.json).
const app = createApp()

export const config = { maxDuration: 30 }

export default getRequestListener(async (request: Request) => app.fetch(request, appEnv(), {} as never))
