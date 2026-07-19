export const THEME_SCHEMA_VERSION = 1 as const
export const PET_CONTRACT_VERSION = 'codex-v2-hatch-pet' as const

export type SkinPackageKind = 'theme' | 'paired'

export const THEME_TARGETS = ['codex', 'chatgpt'] as const
export const THEME_CATEGORIES = ['anime-2d', 'cyber-ui', 'editorial', 'minimal', 'cozy', 'mystic'] as const
export const THEME_PALETTES = ['blue', 'cyan', 'green', 'orange', 'paper', 'mixed'] as const

export type ThemeTarget = (typeof THEME_TARGETS)[number]
export type ThemeCategory = (typeof THEME_CATEGORIES)[number]
export type ThemePalette = (typeof THEME_PALETTES)[number]

export interface ThemeColors {
  accent: string
  secondary: string
  surface: string
  text: string
}

export interface ThemeCopy {
  brand?: string
  headline?: string
  tagline?: string
  brandStyle?: { preset: string }
}

export interface ThemeManifest {
  schemaVersion: typeof THEME_SCHEMA_VERSION
  id: string
  name: string
  hero: string
  logo?: string | null
  polaroid?: string | null
  copy?: ThemeCopy | null
  colors: ThemeColors
}

export interface PairedBundleManifest {
  schemaVersion: typeof THEME_SCHEMA_VERSION
  id: string
  displayName: string
  themeId: string
  petId: string
  themePath: 'theme'
  petPath: 'pet'
  contractVersion: typeof PET_CONTRACT_VERSION
  createdAt?: string
  selection?: string
}

export interface PetManifest {
  id: string
  displayName: string
  description?: string
  spriteVersionNumber: 2
  spritesheetPath: 'spritesheet.png' | 'spritesheet.webp'
}

export interface PetContract {
  schemaVersion: typeof THEME_SCHEMA_VERSION
  contractVersion: typeof PET_CONTRACT_VERSION
  spriteVersionNumber: 2
  grid: { columns: 8; rows: 11 }
  frame: { width: 192; height: 208 }
  spritesheet: {
    format: Array<'png' | 'webp'>
    colorMode: 'rgba'
    maxBytes?: number
  }
  [key: string]: unknown
}

export interface ThemePackageEntry {
  path: string
  compressedSize?: number
  uncompressedSize?: number
  isDirectory?: boolean
  isSymlink?: boolean
  isEncrypted?: boolean
}

export interface ThemeValidationReport {
  valid: boolean
  kind: SkinPackageKind
  validatorVersion: string
  errors: string[]
  warnings: string[]
  totalBytes: number
  entryCount: number
  manifest?: ThemeManifest
  bundleManifest?: PairedBundleManifest
  petManifest?: PetManifest
  petContract?: PetContract
}
