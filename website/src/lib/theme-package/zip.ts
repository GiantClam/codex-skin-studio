import {
  MAX_ARCHIVE_BYTES,
  MAX_COMPRESSION_RATIO,
  MAX_ENTRY_COUNT,
  MAX_UNCOMPRESSED_BYTES,
  validateThemePackage,
  sha256Hex,
} from './validator.mjs'
import type { PairedBundleManifest, PetContract, PetManifest, ThemeManifest, ThemePackageEntry, ThemeValidationReport } from './types'

const EOCD_SIGNATURE = 0x06054b50
const CENTRAL_SIGNATURE = 0x02014b50
const LOCAL_SIGNATURE = 0x04034b50

export type ParsedZipEntry = ThemePackageEntry & {
  compression: number
  compressedSize: number
  uncompressedSize: number
  dataOffset: number
}

type ParsedPackageBase = {
  bytes: Uint8Array
  files: Map<string, Uint8Array>
  entries: ParsedZipEntry[]
  report: ThemeValidationReport
  sha256: string
}

export type ParsedThemePackage = ParsedPackageBase & {
  kind: 'theme'
  manifest: ThemeManifest | null
  bundleManifest: null
  petManifest: null
  petContract: null
}

export type ParsedPairedPackage = ParsedPackageBase & {
  kind: 'paired'
  manifest: ThemeManifest | null
  bundleManifest: PairedBundleManifest | null
  petManifest: PetManifest | null
  petContract: PetContract | null
}

export type ParsedSkinPackage = ParsedThemePackage | ParsedPairedPackage

function readUint16(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8)
}

function readUint32(bytes: Uint8Array, offset: number) {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0
}

function decode(bytes: Uint8Array) {
  return new TextDecoder().decode(bytes)
}

function hasBytes(bytes: Uint8Array, offset: number, length: number) {
  return offset >= 0 && length >= 0 && offset + length <= bytes.length
}

function findEndOfCentralDirectory(bytes: Uint8Array) {
  const start = Math.max(0, bytes.length - 65_557)
  for (let offset = bytes.length - 22; offset >= start; offset -= 1) {
    if (hasBytes(bytes, offset, 22) && readUint32(bytes, offset) === EOCD_SIGNATURE) return offset
  }
  throw new Error('ZIP end-of-central-directory record is missing')
}

function normalizeEntryPaths(entries: ParsedZipEntry[]) {
  const paths = entries.map((entry) => entry.path).filter(Boolean)
  const topLevel = new Set(paths.map((entry) => entry.split('/')[0]))
  if (topLevel.size !== 1) return entries
  const prefix = `${[...topLevel][0]}/`
  if (!paths.every((entry) => entry.startsWith(prefix))) return entries
  return entries.map((entry) => ({ ...entry, path: entry.path.slice(prefix.length) }))
}

function isSymlink(bytes: Uint8Array, offset: number) {
  const unixMode = readUint32(bytes, offset + 38) >>> 16
  return (unixMode & 0o170000) === 0o120000
}

export function listZipEntries(input: Uint8Array) {
  const eocd = findEndOfCentralDirectory(input)
  const entryCount = readUint16(input, eocd + 10)
  const centralSize = readUint32(input, eocd + 12)
  const centralOffset = readUint32(input, eocd + 16)
  if (!hasBytes(input, centralOffset, centralSize)) throw new Error('ZIP central directory is outside the archive')

  const entries: ParsedZipEntry[] = []
  let cursor = centralOffset
  for (let index = 0; index < entryCount; index += 1) {
    if (!hasBytes(input, cursor, 46) || readUint32(input, cursor) !== CENTRAL_SIGNATURE) throw new Error('ZIP central directory entry is invalid')
    const compression = readUint16(input, cursor + 10)
    const flags = readUint16(input, cursor + 8)
    const compressedSize = readUint32(input, cursor + 20)
    const uncompressedSize = readUint32(input, cursor + 24)
    const filenameLength = readUint16(input, cursor + 28)
    const extraLength = readUint16(input, cursor + 30)
    const commentLength = readUint16(input, cursor + 32)
    const localHeaderOffset = readUint32(input, cursor + 42)
    if (!hasBytes(input, cursor + 46, filenameLength + extraLength + commentLength)) throw new Error('ZIP filename record is invalid')
    const path = decode(input.slice(cursor + 46, cursor + 46 + filenameLength))
    if (!hasBytes(input, localHeaderOffset, 30) || readUint32(input, localHeaderOffset) !== LOCAL_SIGNATURE) throw new Error(`ZIP local header is invalid: ${path}`)
    const localFilenameLength = readUint16(input, localHeaderOffset + 26)
    const localExtraLength = readUint16(input, localHeaderOffset + 28)
    const localPath = decode(input.slice(localHeaderOffset + 30, localHeaderOffset + 30 + localFilenameLength))
    if (localPath !== path) throw new Error(`ZIP local filename does not match central metadata: ${path}`)
    const dataOffset = localHeaderOffset + 30 + localFilenameLength + localExtraLength
    if (!hasBytes(input, dataOffset, compressedSize)) throw new Error(`ZIP data is outside the archive: ${path}`)
    entries.push({
      path,
      compressedSize,
      uncompressedSize,
      compression,
      dataOffset,
      isDirectory: path.endsWith('/'),
      isSymlink: isSymlink(input, cursor),
      isEncrypted: Boolean(flags & 0x1),
    })
    cursor += 46 + filenameLength + extraLength + commentLength
  }
  return normalizeEntryPaths(entries)
}

async function inflateRaw(bytes: Uint8Array, maxBytes: number) {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const stream = new Blob([copy.buffer]).stream().pipeThrough(new DecompressionStream('deflate-raw' as CompressionFormat))
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = value instanceof Uint8Array ? value : new Uint8Array(value)
    total += chunk.byteLength
    if (total > maxBytes) {
      await reader.cancel('ZIP entry exceeds its declared size')
      throw new Error('ZIP entry exceeds its declared size')
    }
    chunks.push(chunk)
  }
  const output = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength }
  return output
}

async function readEntry(input: Uint8Array, entry: ParsedZipEntry) {
  const compressed = input.slice(entry.dataOffset, entry.dataOffset + entry.compressedSize)
  let output: Uint8Array
  if (entry.compression === 0) output = compressed
  else if (entry.compression === 8) output = await inflateRaw(compressed, Math.min(entry.uncompressedSize, MAX_ARCHIVE_BYTES))
  else throw new Error(`Unsupported ZIP compression method: ${entry.compression}`)
  if (output.byteLength !== entry.uncompressedSize) throw new Error(`ZIP size metadata does not match: ${entry.path}`)
  return output
}

function assertExtractionLimits(bytes: Uint8Array, entries: ParsedZipEntry[]) {
  if (bytes.byteLength > MAX_ARCHIVE_BYTES) throw new Error(`archive exceeds ${MAX_ARCHIVE_BYTES} byte limit`)
  if (entries.length > MAX_ENTRY_COUNT) throw new Error(`archive has more than ${MAX_ENTRY_COUNT} entries`)
  let total = 0
  for (const entry of entries) {
    if (![0, 8].includes(entry.compression)) throw new Error(`Unsupported ZIP compression method: ${entry.compression}`)
    if (entry.isDirectory || entry.isSymlink || entry.isEncrypted) throw new Error(`ZIP entry cannot be extracted safely: ${entry.path}`)
    if (entry.uncompressedSize > MAX_ARCHIVE_BYTES) throw new Error(`entry is too large: ${entry.path}`)
    if (entry.compressedSize === 0 && entry.uncompressedSize > 0) throw new Error(`ZIP compression metadata is invalid: ${entry.path}`)
    if (entry.compressedSize > 0 && entry.uncompressedSize / entry.compressedSize > MAX_COMPRESSION_RATIO) throw new Error(`ZIP compression ratio is suspicious: ${entry.path}`)
    total += entry.uncompressedSize
    if (total > MAX_UNCOMPRESSED_BYTES) throw new Error(`uncompressed content exceeds ${MAX_UNCOMPRESSED_BYTES} byte limit`)
  }
}

function parseJson<T>(files: Map<string, Uint8Array>, path: string): T | null {
  const bytes = files.get(path)
  if (!bytes) return null
  try {
    return JSON.parse(decode(bytes)) as T
  } catch {
    return null
  }
}

export async function parseThemePackage(input: Uint8Array): Promise<ParsedSkinPackage> {
  const bytes = input.slice()
  const entries = listZipEntries(bytes)
  assertExtractionLimits(bytes, entries)
  const files = new Map<string, Uint8Array>()
  for (const entry of entries) {
    if (!entry.isDirectory && !entry.isSymlink) files.set(entry.path, await readEntry(bytes, entry))
  }

  const kind = files.has('bundle.json') ? 'paired' : 'theme'
  const manifest = parseJson<ThemeManifest>(files, kind === 'paired' ? 'theme/theme.json' : 'theme.json')
  const bundleManifest = kind === 'paired' ? parseJson<PairedBundleManifest>(files, 'bundle.json') : null
  const petManifest = kind === 'paired' ? parseJson<PetManifest>(files, 'pet/pet.json') : null
  const petContract = kind === 'paired' ? parseJson<PetContract>(files, 'pet-contract.json') : null
  const report = validateThemePackage({ manifest, bundleManifest, petManifest, petContract, entries, totalBytes: bytes.byteLength, files })
  const sha256 = await sha256Hex(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
  return { kind, bytes, files, entries, manifest, bundleManifest, petManifest, petContract, report, sha256 } as ParsedSkinPackage
}

function crc32(input: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of input) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function writeUint16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true)
}

function writeUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, true)
}

export function createStoredZip(files: Record<string, Uint8Array>) {
  const encoder = new TextEncoder()
  const names = Object.keys(files)
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let localOffset = 0
  for (const name of names) {
    const nameBytes = encoder.encode(name)
    const data = files[name]
    const local = new Uint8Array(30 + nameBytes.length + data.length)
    const localView = new DataView(local.buffer)
    writeUint32(localView, 0, LOCAL_SIGNATURE)
    writeUint16(localView, 4, 20)
    writeUint16(localView, 6, 0)
    writeUint16(localView, 8, 0)
    writeUint16(localView, 10, 0)
    writeUint16(localView, 12, 0)
    writeUint32(localView, 14, crc32(data))
    writeUint32(localView, 18, data.length)
    writeUint32(localView, 22, data.length)
    writeUint16(localView, 26, nameBytes.length)
    writeUint16(localView, 28, 0)
    local.set(nameBytes, 30)
    local.set(data, 30 + nameBytes.length)
    localParts.push(local)

    const central = new Uint8Array(46 + nameBytes.length)
    const centralView = new DataView(central.buffer)
    writeUint32(centralView, 0, CENTRAL_SIGNATURE)
    writeUint16(centralView, 4, 20)
    writeUint16(centralView, 6, 20)
    writeUint16(centralView, 8, 0)
    writeUint16(centralView, 10, 0)
    writeUint16(centralView, 12, 0)
    writeUint16(centralView, 14, 0)
    writeUint32(centralView, 16, crc32(data))
    writeUint32(centralView, 20, data.length)
    writeUint32(centralView, 24, data.length)
    writeUint16(centralView, 28, nameBytes.length)
    writeUint16(centralView, 30, 0)
    writeUint16(centralView, 32, 0)
    writeUint16(centralView, 34, 0)
    writeUint16(centralView, 36, 0)
    writeUint32(centralView, 38, 0)
    writeUint32(centralView, 42, localOffset)
    central.set(nameBytes, 46)
    centralParts.push(central)
    localOffset += local.length
  }

  const localSize = localParts.reduce((sum, part) => sum + part.length, 0)
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0)
  const output = new Uint8Array(localSize + centralSize + 22)
  let cursor = 0
  for (const part of localParts) { output.set(part, cursor); cursor += part.length }
  for (const part of centralParts) { output.set(part, cursor); cursor += part.length }
  const end = new DataView(output.buffer, cursor, 22)
  writeUint32(end, 0, EOCD_SIGNATURE)
  writeUint16(end, 4, 0)
  writeUint16(end, 6, 0)
  writeUint16(end, 8, names.length)
  writeUint16(end, 10, names.length)
  writeUint32(end, 12, centralSize)
  writeUint32(end, 16, localSize)
  writeUint16(end, 20, 0)
  return output
}
