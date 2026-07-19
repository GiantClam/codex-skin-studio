import type { PairedBundleManifest, PetContract, PetManifest, ThemeManifest, ThemePackageEntry, ThemeValidationReport } from './types'

export const VALIDATOR_VERSION: string
export const MAX_ARCHIVE_BYTES: number
export const MAX_ENTRY_COUNT: number
export const MAX_UNCOMPRESSED_BYTES: number
export const MAX_COMPRESSION_RATIO: number
export function inspectPng(input: Uint8Array): { width: number; height: number; alpha: boolean; colorType: number } | null
export function inspectWebP(input: Uint8Array): { width: number; height: number; alpha: boolean } | null
export function validateThemePackage(input: {
  manifest: ThemeManifest | null | unknown
  bundleManifest?: PairedBundleManifest | null | unknown
  petManifest?: PetManifest | null | unknown
  petContract?: PetContract | null | unknown
  entries?: ThemePackageEntry[]
  totalBytes?: number
  files?: Map<string, Uint8Array>
  expectedSlug?: string
}): ThemeValidationReport
export function sha256Hex(input: ArrayBuffer | Blob): Promise<string>
