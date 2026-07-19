import type { CollectionConfig } from 'payload'

import { hasRole } from './access'

export const ModerationLogs: CollectionConfig = {
  slug: 'moderation-logs',
  access: { read: hasRole(['admin', 'reviewer']), create: hasRole(['admin', 'reviewer']) },
  admin: { defaultColumns: ['action', 'skin', 'actor', 'createdAt'] },
  fields: [
    { name: 'skin', type: 'relationship', relationTo: 'skins', required: true },
    { name: 'actor', type: 'relationship', relationTo: 'users', required: true },
    { name: 'action', type: 'select', required: true, options: ['submitted', 'validated', 'approved', 'rejected', 'published', 'unpublished', 'archived'] },
    { name: 'note', type: 'textarea' },
    { name: 'validationReport', type: 'json' },
  ],
}
