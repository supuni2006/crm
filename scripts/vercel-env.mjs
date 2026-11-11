#!/usr/bin/env node
//
// Turns the scratch file .env.supabase into Vercel environment variables.
//
// Accepts either:
//   DATABASE_URL=postgresql://...            (a full connection string), or
//   SUPABASE_PROJECT_REF=... + SUPABASE_DB_PASSWORD=...
//
// For the password form it discovers which pooler region serves the project by
// trying the known pooler hosts in parallel, and only keeps the one that answers.
//
// Secrets are never printed, never written to disk, and never passed as command
// line arguments: they reach `vercel env add` on stdin.
//
// Usage:
//   node scripts/vercel-env.mjs            check the database, then push to Vercel
//   node scripts/vercel-env.mjs --check    check the database only
//   node scripts/vercel-env.mjs --dry-run  show what would be pushed, push nothing

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scratch = path.join(root, '.env.supabase');
const args = new Set(process.argv.slice(2));
const checkOnly = args.has('--check');
const dryRun = args.has('--dry-run');

const REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1', 'eu-central-2', 'eu-north-1',
  'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2',
  'ap-south-1', 'sa-east-1', 'ca-central-1',
];

function readScratch() {
  if (!fs.existsSync(scratch)) {
    fail(`missing ${path.relative(root, scratch)} — create it with DATABASE_URL= or SUPABASE_PROJECT_REF= plus SUPABASE_DB_PASSWORD=`);
  }
  const text = fs.readFileSync(scratch, 'utf8');
  const values = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const at = trimmed.indexOf('=');
    if (at < 1) continue;
    values[trimmed.slice(0, at).trim()] = trimmed.slice(at + 1).trim().replace(/^["']|["']$/g, '');
  }
  return values;
}

function fail(message) {
  console.error(`\n  ✗ ${message}\n`);
  process.exit(1);
}

function filled(value) {
  return typeof value === 'string' && value.length > 0 && !value.includes('REPLACE_WITH');
}

// `sslmode` in the URL overrides the ssl option below, which makes pg verify the
// managed certificate chain and fail with SELF_SIGNED_CERT_IN_CHAIN.
function withoutSslParams(url) {
  const parsed = new URL(url);
  parsed.searchParams.delete('sslmode');
  parsed.searchParams.delete('ssl');
  return parsed.toString();
}

async function tryConnect(connectionString) {
  const { default: pg } = await import('pg');
  const target = withoutSslParams(connectionString);
  const local = /(?:^|@)(?:localhost|127\.0\.0\.1)(?::|\/)/.test(target);
  const client = new pg.Client({
    connectionString: target,
    ssl: local ? undefined : { rejectUnauthorized: false },
    connectionTimeoutMillis: 6000,
    statement_timeout: 8000,
  });
  try {
    await client.connect();
    const { rows } = await client.query('select current_database() as db, current_user as usr, version() as v');
    return { ok: true, db: rows[0].db, user: rows[0].usr, version: String(rows[0].v).split(',')[0] };
  } catch (error) {
    return { ok: false, code: error.code || '', message: (error.message || '').split('\n')[0] };
  } finally {
    await client.end().catch(() => {});
  }
}

function candidatesFor(ref, password) {
  const encoded = encodeURIComponent(password);
  const user = `postgres.${ref}`;
  const query = '?sslmode=require&connect_timeout=6';
  const poolers = REGIONS.flatMap((region) => [
    `postgresql://${user}:${encoded}@aws-0-${region}.pooler.supabase.com:5432/postgres${query}`,
    `postgresql://${user}:${encoded}@aws-1-${region}.pooler.supabase.com:5432/postgres${query}`,
  ]);
  // Direct host last: IPv6-only on newer projects, so it usually fails locally.
  const direct = `postgresql://postgres:${encoded}@db.${ref}.supabase.co:5432/postgres${query}`;
  return [...poolers, direct];
}

/** Probes pooler regions a few at a time: the first endpoint that answers wins. */
async function discover(ref, password) {
  const candidates = candidatesFor(ref, password);
  console.log(`  probing ${candidates.length} Supabase endpoints, 6 at a time…`);
  const failures = [];
  // A pooler that recognises the project but rejects the password proves the
  // host is right: that is a very different problem from an unreachable project.
  const hostsThisProject = [];
  for (let start = 0; start < candidates.length; start += 6) {
    const batch = candidates.slice(start, start + 6);
    const results = await Promise.all(batch.map(async (url) => ({ url, result: await tryConnect(url) })));
    for (const { url, result } of results) {
      const label = describe(url).host.replace('.pooler.supabase.com', '');
      if (result.ok) {
        console.log(`  ✓ ${label} accepted the credentials`);
        return url;
      }
      if (result.code === '28P01' || /password authentication failed/i.test(result.message || '')) {
        if (!hostsThisProject.includes(label)) hostsThisProject.push(label);
        console.log(`  ✓ ${label} hosts this project — password rejected`);
        continue;
      }
      const reason = /timeout|ETIMEDOUT/i.test(`${result.code} ${result.message}`) ? 'connection timed out' : (result.message || result.code || 'refused');
      failures.push(reason);
      console.log(`  · ${label} — ${reason.slice(0, 90)}`);
    }
  }
  const tally = new Map();
  for (const reason of failures) tally.set(reason, (tally.get(reason) || 0) + 1);
  console.error('  no endpoint accepted the credentials:');
  for (const [reason, count] of [...tally.entries()].sort((a, b) => b[1] - a[1])) console.error(`    ${count}× ${reason}`);
  if (hostsThisProject.length) {
    fail(`the project is live and served by ${hostsThisProject[0]} — only SUPABASE_DB_PASSWORD is wrong.\n    Reset it in Supabase → Project Settings → Database, then re-run.`);
  }
  fail('cannot reach Supabase — check the project ref and that the project is running (not paused)');
}

function describe(connectionString) {
  const url = new URL(connectionString);
  const region = (url.hostname.match(/^aws-[01]-([a-z0-9-]+)\.pooler\./) || [])[1] || '(direct host)';
  return { host: url.hostname, port: url.port || '5432', user: url.username, db: url.pathname.replace(/^\//, ''), region };
}

function pushEnv(name, value) {
  if (dryRun) {
    console.log(`  • would set ${name} (${value.length} chars)`);
    return;
  }
  const run = (verb, input) => spawnSync('npx', ['--yes', 'vercel', 'env', verb, name, 'production', ...(verb === 'add' ? ['--force'] : ['--yes'])], {
    cwd: root,
    input,
    encoding: 'utf8',
  });
  const result = run('add', value);
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  if (result.status !== 0 || !/Added|Updated/.test(output)) {
    const safe = output.replace(new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '<redacted>').trim();
    fail(`could not set ${name} in Vercel:\n${safe}`);
  }
  console.log(`  ✓ ${name} set for Production (Secret)`);
}

const values = readScratch();
const password = values.SUPABASE_DB_PASSWORD;
const fullUrl = values.DATABASE_URL;
const appPassword = values.APP_PASSWORD;

let connectionString = null;
if (filled(fullUrl)) {
  connectionString = fullUrl;
} else if (filled(values.SUPABASE_PROJECT_REF) && filled(password)) {
  console.log('  assembling connection string from project ref + password');
  connectionString = await discover(values.SUPABASE_PROJECT_REF, password);
} else {
  const missing = [];
  if (!filled(fullUrl) && !filled(values.SUPABASE_PROJECT_REF)) missing.push('SUPABASE_PROJECT_REF');
  if (!filled(fullUrl) && !filled(password)) missing.push('SUPABASE_DB_PASSWORD');
  fail(`still unfilled in .env.supabase: ${missing.join(', ')}`);
}

const where = describe(connectionString);
console.log(`  endpoint  ${where.user}@${where.host}:${where.port}/${where.db}  (region ${where.region})`);

const probe = await tryConnect(connectionString);
if (!probe.ok) fail(`database rejected the connection: ${probe.code} ${probe.message}`);
console.log(`  ✓ database reachable — ${probe.db} as ${probe.user} (${probe.version})`);

if (checkOnly) {
  console.log('\n  check only: nothing pushed to Vercel\n');
  process.exit(0);
}

if (!filled(appPassword)) fail('APP_PASSWORD is still unfilled in .env.supabase — pick the sign-in password for the CRM');
if (appPassword.length < 8) fail('APP_PASSWORD must be at least 8 characters');

console.log('\n  pushing to Vercel (production):');
pushEnv('DATABASE_URL', connectionString);
pushEnv('APP_PASSWORD', appPassword);
console.log('\n  done — deploy production with: npx vercel deploy --prod --yes\n');
