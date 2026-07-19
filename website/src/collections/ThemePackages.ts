import type { CollectionConfig } from 'payload'

import { isAdmin } from './access'

export const ThemePackages: CollectionConfig = {
  slug: 'theme-packages',
  access: {
    create: isAdmin,
    read: ({ req }) => Boolean(req.user),
    update: isAdmin,
    delete: ({ req }) => Boolean(req.user?.role === 'admin'),
  },
  upload: {
    mimeTypes: ['application/zip', 'application/x-zip-compressed'],
  },
  hooks: {
    beforeOperation: [
      ({ operation, req }) => {
        if (operation === 'create' && req.file && req.file.size > 50 * 1024 * 1024) throw new Error('Theme package exceeds the 50 MB upload limit.')
      },
    ],
  },
  fields: [
    { name: 'originalFilename', type: 'text' },
    { name: 'sha256', type: 'text', required: true },
    { name: 'r2ObjectKey', type: 'text' },
    {
      name: 'packageKind',
      type: 'select',
      required: true,
      defaultValue: 'theme',
      options: ['theme', 'paired'],
    },
    { name: 'validatorVersion', type: 'text', required: true },
    {
      name: 'validationStatus',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: ['pending', 'passed', 'failed'],
    },
    { name: 'validationReport', type: 'json' },
    { name: 'manifest', type: 'json' },
    { name: 'bundleManifest', type: 'json' },
    { name: 'petManifest', type: 'json' },
    { name: 'petContractVersion', type: 'text' },
    { name: 'uploadedBy', type: 'relationship', relationTo: 'users' },
  ],
}
