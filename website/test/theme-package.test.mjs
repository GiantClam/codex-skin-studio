import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MAX_ARCHIVE_BYTES,
  sha256Hex,
  validateThemePackage,
} from '../src/lib/theme-package/validator.mjs'
import { createStoredZip, parseThemePackage } from '../src/lib/theme-package/zip.ts'

const manifest = {
  schemaVersion: 1,
  id: 'midnight-arcana',
  name: 'Midnight Arcana',
  hero: 'hero.webp',
  logo: null,
  polaroid: null,
  colors: {
    accent: '#25D9FF',
    secondary: '#FF8A3D',
    surface: '#102033',
    text: '#FFFFFF',
  },
}

const validEntries = [
  { path: 'theme.json', uncompressedSize: 300 },
  { path: 'hero.webp', uncompressedSize: 1000 },
]

const pairedId = 'neon-companion'
const pairedThemeManifest = {
  ...manifest,
  id: pairedId,
  name: 'Neon Companion',
}
const bundleManifest = {
  schemaVersion: 1,
  id: pairedId,
  displayName: 'Neon Companion',
  themeId: pairedId,
  petId: pairedId,
  themePath: 'theme',
  petPath: 'pet',
  contractVersion: 'codex-v2-hatch-pet',
}
const petManifest = {
  id: pairedId,
  displayName: 'Neon Companion Pet',
  spriteVersionNumber: 2,
  spritesheetPath: 'spritesheet.png',
}
const petContract = {
  schemaVersion: 1,
  contractVersion: 'codex-v2-hatch-pet',
  spriteVersionNumber: 2,
  grid: { columns: 8, rows: 11 },
  frame: { width: 192, height: 208 },
  spritesheet: { format: ['webp', 'png'], colorMode: 'rgba', maxBytes: 20 * 1024 * 1024 },
}
const pairedEntries = [
  { path: 'bundle.json', uncompressedSize: 300 },
  { path: 'pet-contract.json', uncompressedSize: 600 },
  { path: 'theme/theme.json', uncompressedSize: 300 },
  { path: 'theme/hero.webp', uncompressedSize: 1000 },
  { path: 'pet/pet.json', uncompressedSize: 200 },
  { path: 'pet/spritesheet.png', uncompressedSize: 2000 },
]

function pngHeader(width, height, colorType = 6) {
  const bytes = new Uint8Array(33)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const view = new DataView(bytes.buffer)
  view.setUint32(8, 13)
  bytes.set(new TextEncoder().encode('IHDR'), 12)
  view.setUint32(16, width)
  view.setUint32(20, height)
  bytes[24] = 8
  bytes[25] = colorType
  return bytes
}

function webpVp8xHeader(width, height, alpha = true) {
  const bytes = new Uint8Array(30)
  const view = new DataView(bytes.buffer)
  bytes.set(new TextEncoder().encode('RIFF'), 0)
  view.setUint32(4, bytes.length - 8, true)
  bytes.set(new TextEncoder().encode('WEBPVP8X'), 8)
  view.setUint32(16, 10, true)
  bytes[20] = alpha ? 0x10 : 0
  const writeUint24 = (offset, value) => {
    bytes[offset] = value & 0xff
    bytes[offset + 1] = (value >>> 8) & 0xff
    bytes[offset + 2] = (value >>> 16) & 0xff
  }
  writeUint24(24, width - 1)
  writeUint24(27, height - 1)
  return bytes
}

function validatePaired(overrides = {}) {
  return validateThemePackage({
    manifest: pairedThemeManifest,
    bundleManifest,
    petManifest,
    petContract,
    entries: pairedEntries,
    totalBytes: 4200,
    files: new Map([
      ['theme/hero.webp', webpVp8xHeader(1600, 900, false)],
      ['pet/spritesheet.png', pngHeader(1536, 2288)],
    ]),
    expectedSlug: pairedId,
    ...overrides,
  })
}

test('accepts a canonical theme package', () => {
  const result = validateThemePackage({ manifest, entries: validEntries, totalBytes: 900 })
  assert.equal(result.valid, true)
  assert.deepEqual(result.errors, [])
  assert.equal(result.manifest.id, 'midnight-arcana')
})

test('rejects traversal and unsupported script entries', () => {
  const result = validateThemePackage({
    manifest,
    entries: [...validEntries, { path: '../install.js', uncompressedSize: 20 }],
    totalBytes: 900,
  })
  assert.equal(result.valid, false)
  assert.match(result.errors.join('\n'), /unsafe archive path/)
  assert.match(result.errors.join('\n'), /unsupported archive entry/)
})

test('rejects packages that omit hero.webp', () => {
  const result = validateThemePackage({ manifest: { ...manifest, hero: 'hero.png' }, entries: [{ path: 'theme.json' }], totalBytes: 100 })
  assert.equal(result.valid, false)
  assert.match(result.errors.join('\n'), /hero must be hero.webp/)
  assert.match(result.errors.join('\n'), /hero.webp is required/)
})

test('rejects oversized archives', () => {
  const result = validateThemePackage({ manifest, entries: validEntries, totalBytes: MAX_ARCHIVE_BYTES + 1 })
  assert.equal(result.valid, false)
  assert.match(result.errors.join('\n'), /archive exceeds/)
})

test('calculates a stable SHA-256 checksum', async () => {
  assert.equal(await sha256Hex(new TextEncoder().encode('codex').buffer), '57de4cf40144bdf7d00010f2f5557a7d642c2b9705309bfade167dd313e2ca93')
})

test('accepts a canonical paired theme and Pet package', () => {
  const result = validatePaired()
  assert.equal(result.valid, true)
  assert.equal(result.kind, 'paired')
  assert.equal(result.manifest.id, pairedId)
  assert.equal(result.petManifest.id, pairedId)
})

test('accepts an alpha-capable paired WebP atlas with canonical dimensions', () => {
  const entries = pairedEntries.map((entry) => entry.path === 'pet/spritesheet.png' ? { ...entry, path: 'pet/spritesheet.webp' } : entry)
  const result = validatePaired({
    entries,
    petManifest: { ...petManifest, spritesheetPath: 'spritesheet.webp' },
    files: new Map([
      ['theme/hero.webp', webpVp8xHeader(1600, 900, false)],
      ['pet/spritesheet.webp', webpVp8xHeader(1536, 2288, true)],
    ]),
  })
  assert.equal(result.valid, true)
})

test('rejects paired packages whose bundle, theme, Pet, or expected slug IDs differ', () => {
  const result = validatePaired({
    manifest: { ...pairedThemeManifest, id: 'other-theme' },
    petManifest: { ...petManifest, id: 'other-pet' },
    expectedSlug: 'other-slug',
  })
  assert.equal(result.valid, false)
  assert.match(result.errors.join('\n'), /bundle, theme, Pet, and slug IDs must match/)
})

test('rejects paired packages that omit declared themeId or petId relationships', () => {
  const withoutThemeId = { ...bundleManifest }
  delete withoutThemeId.themeId
  const missingTheme = validatePaired({ bundleManifest: withoutThemeId })
  assert.equal(missingTheme.valid, false)
  assert.match(missingTheme.errors.join('\n'), /bundle themeId is required/)

  const withoutPetId = { ...bundleManifest }
  delete withoutPetId.petId
  const missingPet = validatePaired({ bundleManifest: withoutPetId })
  assert.equal(missingPet.valid, false)
  assert.match(missingPet.errors.join('\n'), /bundle petId is required/)
})

test('rejects paired packages missing pet-contract.json', () => {
  const result = validatePaired({
    entries: pairedEntries.filter((entry) => entry.path !== 'pet-contract.json'),
    petContract: null,
  })
  assert.equal(result.valid, false)
  assert.match(result.errors.join('\n'), /pet-contract.json is required/)
})

test('rejects paired atlases with wrong dimensions', () => {
  const result = validatePaired({
    files: new Map([
      ['theme/hero.webp', webpVp8xHeader(1600, 900, false)],
      ['pet/spritesheet.png', pngHeader(1536, 1872)],
    ]),
  })
  assert.equal(result.valid, false)
  assert.match(result.errors.join('\n'), /1536x2288/)
})

test('rejects paired PNG atlases without an alpha-capable RGBA color type', () => {
  const result = validatePaired({
    files: new Map([
      ['theme/hero.webp', webpVp8xHeader(1600, 900, false)],
      ['pet/spritesheet.png', pngHeader(1536, 2288, 2)],
    ]),
  })
  assert.equal(result.valid, false)
  assert.match(result.errors.join('\n'), /RGBA alpha/)
})

test('rejects undeclared files in a paired package', () => {
  const result = validatePaired({
    entries: [...pairedEntries, { path: 'pet/readme.txt', uncompressedSize: 20 }],
  })
  assert.equal(result.valid, false)
  assert.match(result.errors.join('\n'), /unsupported archive entry/)
})

test('parses canonical legacy and paired ZIP packages into a discriminated union', async () => {
  const json = (value) => new TextEncoder().encode(JSON.stringify(value))
  const legacy = await parseThemePackage(createStoredZip({
    'theme.json': json(manifest),
    'hero.webp': webpVp8xHeader(1600, 900, false),
  }))
  assert.equal(legacy.report.valid, true)
  assert.equal(legacy.kind, 'theme')
  assert.equal(legacy.bundleManifest, null)

  const paired = await parseThemePackage(createStoredZip({
    'bundle.json': json(bundleManifest),
    'pet-contract.json': json(petContract),
    'theme/theme.json': json(pairedThemeManifest),
    'theme/hero.webp': webpVp8xHeader(1600, 900, false),
    'pet/pet.json': json(petManifest),
    'pet/spritesheet.png': pngHeader(1536, 2288),
  }))
  assert.equal(paired.report.valid, true)
  assert.equal(paired.kind, 'paired')
  assert.equal(paired.bundleManifest.id, pairedId)
  assert.equal(paired.petManifest.id, pairedId)
})

test('rejects ZIP entries whose extracted size disagrees with central metadata', async () => {
  const archive = createStoredZip({
    'theme.json': new TextEncoder().encode(JSON.stringify(manifest)),
    'hero.webp': webpVp8xHeader(1600, 900, false),
  })
  const central = archive.findIndex((byte, index) => byte === 0x50 && archive[index + 1] === 0x4b && archive[index + 2] === 0x01 && archive[index + 3] === 0x02)
  assert.ok(central > 0)
  new DataView(archive.buffer).setUint32(central + 24, 1, true)
  await assert.rejects(parseThemePackage(archive), /ZIP size metadata does not match/)
})
