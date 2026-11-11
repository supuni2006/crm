// Bundles the API entry into a single file for Vercel. Vercel's zero-config
// function build emits ESM imports untouched, so a function that imports from
// src/ fails at runtime with ERR_MODULE_NOT_FOUND. One self-contained file
// avoids that entirely.
import { mkdirSync } from 'node:fs'
import { build } from 'esbuild'

const root = new URL('../', import.meta.url).pathname
mkdirSync(`${root}api`, { recursive: true })

await build({
  entryPoints: [`${root}src/vercel/server.ts`],
  outfile: `${root}api/handler.mjs`,
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  // pg loads this optional native add-on inside a try/catch.
  external: ['pg-native'],
  // pg is CommonJS and calls require() for Node built-ins at runtime; without a
  // real require in scope esbuild's ESM shim throws "Dynamic require ... is not
  // supported". This banner hands the bundle Node's own require.
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  logLevel: 'warning',
})

console.log('bundled api/handler.mjs')
