import { Buffer } from 'node:buffer'

import type { ParsedSkinPackage } from './zip'
import type { ThemeCategory, ThemePalette, ThemeTarget } from './types'
import { getCloudflareBindings, getPayloadClient } from '@/lib/server'

export type ThemeSubmissionMetadata = {
  title: string
  summary: string
  version: string
  targets: ThemeTarget[]
  categories: ThemeCategory[]
  palette: ThemePalette[]
  authorDisplayName: string
  sourceType: 'manual' | 'github'
  sourceUrl?: string
  license?: string
  slug?: string
}

export async function saveThemeSubmission(parsed: ParsedSkinPackage, metadata: ThemeSubmissionMetadata, filename: string) {
  const payload = await getPayloadClient()
  const existing = await payload.find({ collection: 'theme-packages', where: { sha256: { equals: parsed.sha256 } }, limit: 1, overrideAccess: true })
  if (existing.docs.length > 0) throw new Error('This package has already been submitted.')
  const slug = metadata.slug ?? parsed.manifest!.id
  if (parsed.kind === 'paired' && slug !== parsed.manifest!.id) throw new Error('Paired package slug must match its bundle, theme, and Pet IDs.')
  const existingSkin = await payload.find({ collection: 'skins', where: { slug: { equals: slug } }, limit: 1, overrideAccess: true })
  if (existingSkin.docs.length > 0) throw new Error(`A skin with slug ${slug} already exists.`)

  const env = await getCloudflareBindings()
  const objectKey = `packages/${parsed.sha256}.zip`
  await env.R2.put(objectKey, parsed.bytes, { httpMetadata: { contentType: 'application/zip', contentDisposition: `attachment; filename="${filename}"` } })
  try {
    const packageDoc = await payload.create({
      collection: 'theme-packages',
      data: {
        originalFilename: filename,
        sha256: parsed.sha256,
        r2ObjectKey: objectKey,
        packageKind: parsed.kind,
        validatorVersion: parsed.report.validatorVersion,
        validationStatus: 'passed',
        validationReport: parsed.report as unknown as Record<string, unknown>,
        manifest: parsed.manifest as unknown as Record<string, unknown>,
        bundleManifest: parsed.bundleManifest as unknown as Record<string, unknown> | undefined,
        petManifest: parsed.petManifest as unknown as Record<string, unknown> | undefined,
        petContractVersion: parsed.petContract?.contractVersion,
      },
      file: { data: Buffer.from(parsed.bytes), mimetype: 'application/zip', name: filename, size: parsed.bytes.byteLength },
      overrideAccess: true,
      disableTransaction: true,
    })
    const heroPath = parsed.kind === 'paired' ? 'theme/hero.webp' : 'hero.webp'
    const hero = parsed.files.get(heroPath)
    if (!hero) throw new Error(`${heroPath} is missing from the validated package.`)
    const media = await payload.create({
      collection: 'media',
      data: { alt: `${metadata.title} hero`, isPublic: true },
      file: { data: Buffer.from(hero), mimetype: 'image/webp', name: `${parsed.manifest!.id}-hero.webp`, size: hero.byteLength },
      overrideAccess: true,
      disableTransaction: true,
    })
    const skin = await payload.create({
      collection: 'skins',
      data: {
        title: metadata.title,
        slug,
        summary: metadata.summary,
        status: 'pending_review',
        packageKind: parsed.kind,
        targets: metadata.targets,
        categories: metadata.categories,
        palette: metadata.palette,
        version: metadata.version,
        hero: media.id,
        package: packageDoc.id,
        petId: parsed.petManifest?.id,
        petDisplayName: parsed.petManifest?.displayName,
        petContractVersion: parsed.petContract?.contractVersion,
        authorDisplayName: metadata.authorDisplayName,
        sourceType: metadata.sourceType,
        sourceUrl: metadata.sourceUrl || undefined,
        license: metadata.license || undefined,
        art: 'paper',
      },
      overrideAccess: true,
      disableTransaction: true,
    })
    return { payload, packageDoc, media, skin, objectKey }
  } catch (error) {
    await env.R2.delete(objectKey)
    throw error
  }
}
