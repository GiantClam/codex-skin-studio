export const VALIDATOR_VERSION = 'codex-skin-archive/v2'
export const MAX_ARCHIVE_BYTES = 50 * 1024 * 1024
export const MAX_ENTRY_COUNT = 20
export const MAX_UNCOMPRESSED_BYTES = 150 * 1024 * 1024
export const MAX_COMPRESSION_RATIO = 100

const THEME_FILES = new Set(['theme.json', 'hero.webp', 'logo.webp', 'polaroid.webp'])
const PAIRED_FILES = new Set([
  'bundle.json',
  'pet-contract.json',
  'theme/theme.json',
  'theme/hero.webp',
  'theme/logo.webp',
  'theme/polaroid.webp',
  'pet/pet.json',
  'pet/spritesheet.png',
  'pet/spritesheet.webp',
])
const COLOR_KEYS = ['accent', 'secondary', 'surface', 'text']
const HEX_COLOR = /^#[0-9a-f]{6}$/i
const THEME_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const PET_CONTRACT_VERSION = 'codex-v2-hatch-pet'
const ATLAS_WIDTH = 1536
const ATLAS_HEIGHT = 2288

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

function hasUnsafePath(path) {
  return path.startsWith('/') || path.includes('\\') || path.split('/').some((part) => part === '..' || part === '')
}

function validateManifest(manifest, entries, prefix = '') {
  const errors = []
  const manifestPath = `${prefix}theme.json`
  if (!isObject(manifest)) return [`${manifestPath} must contain a JSON object`]
  if (manifest.schemaVersion !== 1) errors.push('schemaVersion must be 1')
  if (typeof manifest.id !== 'string' || !THEME_ID.test(manifest.id)) errors.push('id must use lowercase letters, numbers, and hyphens')
  if (typeof manifest.name !== 'string' || !manifest.name.trim() || manifest.name.length > 80) errors.push('name must be a non-empty string with at most 80 characters')
  if (manifest.hero !== 'hero.webp') errors.push('hero must be hero.webp')
  for (const key of ['logo', 'polaroid']) {
    if (manifest[key] !== undefined && manifest[key] !== null && manifest[key] !== `${key}.webp`) errors.push(`${key} must point to ${key}.webp`)
  }
  if (!isObject(manifest.colors)) {
    errors.push('colors must be an object')
  } else {
    for (const key of COLOR_KEYS) {
      if (typeof manifest.colors[key] !== 'string' || !HEX_COLOR.test(manifest.colors[key])) errors.push(`colors.${key} must be a six-digit hex color`)
    }
  }
  if (manifest.copy !== undefined && manifest.copy !== null && !isObject(manifest.copy)) errors.push('copy must be an object or null')

  const entryPaths = new Set(entries.map((entry) => entry.path))
  if (!entryPaths.has(manifestPath)) errors.push(`${manifestPath} is required`)
  if (!entryPaths.has(`${prefix}hero.webp`)) errors.push(`${prefix}hero.webp is required`)
  for (const key of ['logo', 'polaroid']) {
    if (manifest[key] && !entryPaths.has(`${prefix}${manifest[key]}`)) errors.push(`${prefix}${manifest[key]} is missing from the archive`)
  }
  return errors
}

function validateBundleManifest(bundleManifest) {
  if (!isObject(bundleManifest)) return ['bundle.json must contain a JSON object']
  const errors = []
  if (bundleManifest.schemaVersion !== 1) errors.push('bundle schemaVersion must be 1')
  if (typeof bundleManifest.id !== 'string' || !THEME_ID.test(bundleManifest.id)) errors.push('bundle id must use lowercase letters, numbers, and hyphens')
  if (typeof bundleManifest.themeId !== 'string' || !THEME_ID.test(bundleManifest.themeId)) errors.push('bundle themeId is required and must use lowercase letters, numbers, and hyphens')
  if (typeof bundleManifest.petId !== 'string' || !THEME_ID.test(bundleManifest.petId)) errors.push('bundle petId is required and must use lowercase letters, numbers, and hyphens')
  if (typeof bundleManifest.displayName !== 'string' || !bundleManifest.displayName.trim() || bundleManifest.displayName.length > 80) errors.push('bundle displayName must be a non-empty string with at most 80 characters')
  if (bundleManifest.themePath !== 'theme') errors.push('bundle themePath must be theme')
  if (bundleManifest.petPath !== 'pet') errors.push('bundle petPath must be pet')
  if (bundleManifest.contractVersion !== PET_CONTRACT_VERSION) errors.push(`bundle contractVersion must be ${PET_CONTRACT_VERSION}`)
  return errors
}

function validatePetManifest(petManifest, entries) {
  if (!isObject(petManifest)) return ['pet/pet.json must contain a JSON object']
  const errors = []
  if (typeof petManifest.id !== 'string' || !THEME_ID.test(petManifest.id)) errors.push('Pet id must use lowercase letters, numbers, and hyphens')
  if (typeof petManifest.displayName !== 'string' || !petManifest.displayName.trim() || petManifest.displayName.length > 80) errors.push('Pet displayName must be a non-empty string with at most 80 characters')
  if (petManifest.spriteVersionNumber !== 2) errors.push('Pet spriteVersionNumber must be 2')
  if (petManifest.spritesheetPath !== 'spritesheet.png' && petManifest.spritesheetPath !== 'spritesheet.webp') errors.push('Pet spritesheetPath must be spritesheet.png or spritesheet.webp')
  const atlasPath = typeof petManifest.spritesheetPath === 'string' ? `pet/${petManifest.spritesheetPath}` : ''
  const entryPaths = new Set(entries.map((entry) => entry.path))
  if (atlasPath && !entryPaths.has(atlasPath)) errors.push(`${atlasPath} is required`)
  for (const candidate of ['pet/spritesheet.png', 'pet/spritesheet.webp']) {
    if (entryPaths.has(candidate) && candidate !== atlasPath) errors.push(`unsupported archive entry: ${candidate}`)
  }
  return errors
}

function validatePetContract(petContract, atlasExtension) {
  if (!isObject(petContract)) return ['pet-contract.json must contain a JSON object']
  const errors = []
  if (petContract.schemaVersion !== 1) errors.push('Pet contract schemaVersion must be 1')
  if (petContract.contractVersion !== PET_CONTRACT_VERSION) errors.push(`Pet contractVersion must be ${PET_CONTRACT_VERSION}`)
  if (petContract.spriteVersionNumber !== 2) errors.push('Pet contract spriteVersionNumber must be 2')
  if (!isObject(petContract.grid) || petContract.grid.columns !== 8 || petContract.grid.rows !== 11) errors.push('Pet contract grid must be 8x11')
  if (!isObject(petContract.frame) || petContract.frame.width !== 192 || petContract.frame.height !== 208) errors.push('Pet contract frame must be 192x208')
  if (!isObject(petContract.spritesheet) || petContract.spritesheet.colorMode !== 'rgba') errors.push('Pet contract spritesheet colorMode must be rgba')
  if (atlasExtension && (!Array.isArray(petContract.spritesheet?.format) || !petContract.spritesheet.format.includes(atlasExtension))) errors.push(`Pet contract must allow ${atlasExtension} spritesheets`)
  return errors
}

function readUint24LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16)
}

function readUint32LE(bytes, offset) {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0
}

function ascii(bytes, offset, length) {
  return String.fromCharCode(...bytes.slice(offset, offset + length))
}

export function inspectPng(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 29) return null
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (!signature.every((byte, index) => bytes[index] === byte) || ascii(bytes, 12, 4) !== 'IHDR' || view.getUint32(8) !== 13) return null
  return { width: view.getUint32(16), height: view.getUint32(20), alpha: bytes[25] === 6, colorType: bytes[25] }
}

export function inspectWebP(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 20 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') return null
  if (readUint32LE(bytes, 4) + 8 > bytes.length) return null
  let cursor = 12
  let dimensions = null
  let alpha = false
  while (cursor + 8 <= bytes.length) {
    const type = ascii(bytes, cursor, 4)
    const size = readUint32LE(bytes, cursor + 4)
    const data = cursor + 8
    if (data + size > bytes.length) return null
    if (type === 'VP8X' && size >= 10) {
      alpha ||= Boolean(bytes[data] & 0x10)
      dimensions = { width: readUint24LE(bytes, data + 4) + 1, height: readUint24LE(bytes, data + 7) + 1 }
    } else if (type === 'VP8L' && size >= 5 && bytes[data] === 0x2f) {
      const bits = readUint32LE(bytes, data + 1)
      alpha ||= Boolean(bits & 0x10000000)
      dimensions ??= { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 }
    } else if (type === 'VP8 ' && size >= 10 && bytes[data + 3] === 0x9d && bytes[data + 4] === 0x01 && bytes[data + 5] === 0x2a) {
      dimensions ??= { width: (bytes[data + 6] | (bytes[data + 7] << 8)) & 0x3fff, height: (bytes[data + 8] | (bytes[data + 9] << 8)) & 0x3fff }
    } else if (type === 'ALPH') {
      alpha = true
    }
    cursor = data + size + (size % 2)
  }
  return dimensions ? { ...dimensions, alpha } : null
}

function validateImageFiles(kind, files, petManifest) {
  if (!(files instanceof Map)) return []
  const errors = []
  const themePrefix = kind === 'paired' ? 'theme/' : ''
  for (const file of ['hero.webp', 'logo.webp', 'polaroid.webp']) {
    const path = `${themePrefix}${file}`
    if (files.has(path) && !inspectWebP(files.get(path))) errors.push(`${path} must be a valid WebP image`)
  }
  if (kind !== 'paired' || !isObject(petManifest) || typeof petManifest.spritesheetPath !== 'string') return errors
  const atlasPath = `pet/${petManifest.spritesheetPath}`
  const atlas = files.get(atlasPath)
  if (!atlas) return errors
  const image = atlasPath.endsWith('.png') ? inspectPng(atlas) : inspectWebP(atlas)
  if (!image) errors.push(`${atlasPath} must be a valid ${atlasPath.endsWith('.png') ? 'PNG' : 'WebP'} image`)
  else {
    if (image.width !== ATLAS_WIDTH || image.height !== ATLAS_HEIGHT) errors.push(`${atlasPath} must be exactly ${ATLAS_WIDTH}x${ATLAS_HEIGHT}`)
    if (!image.alpha) errors.push(`${atlasPath} must provide RGBA alpha`)
  }
  return errors
}

export function validateThemePackage({ manifest, bundleManifest = null, petManifest = null, petContract = null, entries = [], totalBytes = 0, files, expectedSlug }) {
  const errors = []
  const warnings = []
  const kind = bundleManifest !== null || entries.some((entry) => entry.path === 'bundle.json') ? 'paired' : 'theme'
  const allowedFiles = kind === 'paired' ? PAIRED_FILES : THEME_FILES
  const uncompressedBytes = entries.reduce((sum, entry) => sum + (entry.uncompressedSize ?? 0), 0)

  if (!Number.isSafeInteger(totalBytes) || totalBytes < 0) errors.push('archive size must be a non-negative integer')
  if (totalBytes > MAX_ARCHIVE_BYTES) errors.push(`archive exceeds ${MAX_ARCHIVE_BYTES} byte limit`)
  if (entries.length > MAX_ENTRY_COUNT) errors.push(`archive has more than ${MAX_ENTRY_COUNT} entries`)
  if (uncompressedBytes > MAX_UNCOMPRESSED_BYTES) errors.push(`uncompressed content exceeds ${MAX_UNCOMPRESSED_BYTES} byte limit`)
  if (totalBytes > 0 && uncompressedBytes / totalBytes > MAX_COMPRESSION_RATIO) errors.push('archive compression ratio is suspicious')

  const seenPaths = new Set()
  for (const entry of entries) {
    if (!entry.path || hasUnsafePath(entry.path)) errors.push(`unsafe archive path: ${entry.path || '<empty>'}`)
    if (entry.isDirectory) errors.push(`directories are not allowed: ${entry.path}`)
    if (entry.isSymlink) errors.push(`symlinks are not allowed: ${entry.path}`)
    if (entry.isEncrypted) errors.push(`encrypted entries are not allowed: ${entry.path}`)
    if (seenPaths.has(entry.path)) errors.push(`duplicate archive entry: ${entry.path}`)
    seenPaths.add(entry.path)
    if (!allowedFiles.has(entry.path)) errors.push(`unsupported archive entry: ${entry.path}`)
    if ((entry.uncompressedSize ?? 0) > MAX_ARCHIVE_BYTES) errors.push(`entry is too large: ${entry.path}`)
    if (entry.path.toLowerCase().endsWith('.zip')) errors.push(`nested archives are not allowed: ${entry.path}`)
  }

  if (kind === 'theme') {
    errors.push(...validateManifest(manifest, entries))
  } else {
    const entryPaths = new Set(entries.map((entry) => entry.path))
    for (const path of ['bundle.json', 'pet-contract.json', 'theme/theme.json', 'theme/hero.webp', 'pet/pet.json']) {
      if (!entryPaths.has(path)) errors.push(`${path} is required`)
    }
    errors.push(...validateManifest(manifest, entries, 'theme/'))
    errors.push(...validateBundleManifest(bundleManifest))
    errors.push(...validatePetManifest(petManifest, entries))
    const atlasExtension = typeof petManifest?.spritesheetPath === 'string' ? petManifest.spritesheetPath.split('.').pop() : undefined
    errors.push(...validatePetContract(petContract, atlasExtension))
    const ids = [bundleManifest?.id, bundleManifest?.themeId, bundleManifest?.petId, manifest?.id, petManifest?.id, expectedSlug].filter((value) => value !== undefined)
    if (ids.some((id) => typeof id !== 'string') || new Set(ids).size !== 1) errors.push('bundle, theme, Pet, and slug IDs must match')
  }
  errors.push(...validateImageFiles(kind, files, petManifest))
  if (manifest?.colors?.secondary && /^#(8|9|a|b)/i.test(manifest.colors.secondary)) warnings.push('secondary color is low-luminance; preview contrast should be checked manually')

  return {
    valid: errors.length === 0,
    kind,
    validatorVersion: VALIDATOR_VERSION,
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
    totalBytes,
    entryCount: entries.length,
    ...(errors.length === 0 ? {
      manifest,
      ...(kind === 'paired' ? { bundleManifest, petManifest, petContract } : {}),
    } : {}),
  }
}

export async function sha256Hex(input) {
  const bytes = input instanceof ArrayBuffer ? input : await input.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
