import type { CollectionConfig } from 'payload'

import { hasRole } from './access'

export const GitHubSources: CollectionConfig = {
  slug: 'github-sources',
  access: { read: hasRole(['admin', 'editor', 'reviewer']), create: hasRole(['admin', 'editor']), update: hasRole(['admin', 'editor']), delete: hasRole(['admin']) },
  fields: [
    { name: 'repositoryUrl', type: 'text', required: true },
    { name: 'owner', type: 'text', required: true },
    { name: 'repository', type: 'text', required: true },
    { name: 'defaultBranch', type: 'text' },
    { name: 'licenseSpdxId', type: 'text' },
    { name: 'stars', type: 'number' },
    { name: 'sourceSnapshotUrl', type: 'text' },
    { name: 'matchedFiles', type: 'json' },
    { name: 'notes', type: 'textarea' },
    { name: 'status', type: 'select', defaultValue: 'found', options: ['found', 'reviewing', 'imported', 'ignored'] },
  ],
}
