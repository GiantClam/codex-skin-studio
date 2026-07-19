import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migrationsDir = path.join(root, 'src', 'migrations')

function wrangler(args, options = {}) {
  return execFileSync('npx', ['wrangler', ...args], {
    cwd: root,
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  })
}

function readRemoteMigrations() {
  try {
    const output = wrangler(['d1', 'execute', 'D1', '--remote', '--command', 'SELECT name, batch FROM payload_migrations ORDER BY id', '--json'], { capture: true })
    const payload = JSON.parse(output)
    return new Map((payload[0]?.results ?? []).map((row) => [row.name, Number(row.batch) || 0]))
  } catch (error) {
    const message = `${error?.stdout ?? ''}\n${error?.stderr ?? ''}\n${error instanceof Error ? error.message : ''}`
    if (/no such table.*payload_migrations/i.test(message)) return new Map()
    throw error
  }
}

function migrationSql(name, batch) {
  const source = fs.readFileSync(path.join(migrationsDir, `${name}.ts`), 'utf8').split('export async function down', 1)[0]
  const statements = [...source.matchAll(/sql`((?:\\`|[^`])*)`\)/g)].map((match) => match[1].replaceAll('\\`', '`'))
  if (statements.length === 0) throw new Error(`No SQL statements found in ${name}`)
  return [
    'PRAGMA foreign_keys=OFF;',
    ...statements,
    'PRAGMA foreign_keys=ON;',
    `INSERT INTO payload_migrations (name, batch) VALUES ("${name}", ${batch});`,
    '',
  ].join('\n')
}

const applied = readRemoteMigrations()
let nextBatch = Math.max(0, ...applied.values()) + 1
const migrationNames = fs.readdirSync(migrationsDir).filter((name) => /^\d+.*\.ts$/.test(name)).map((name) => name.slice(0, -3)).sort()

for (const name of migrationNames) {
  if (applied.has(name)) continue
  const tempFile = path.join(os.tmpdir(), `codex-skin-archive-${name}.sql`)
  fs.writeFileSync(tempFile, migrationSql(name, nextBatch))
  try {
    wrangler(['d1', 'execute', 'D1', '--remote', `--file=${tempFile}`])
  } finally {
    fs.rmSync(tempFile, { force: true })
  }
  nextBatch += 1
}

wrangler(['d1', 'execute', 'D1', '--remote', '--command', 'PRAGMA optimize'])
