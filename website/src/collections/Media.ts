import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  admin: { hidden: true },
  access: {
    read: ({ req }) => req.user ? true : { isPublic: { equals: true } },
  },
  upload: {
    mimeTypes: ['image/webp', 'image/png', 'image/jpeg'],
    imageSizes: [
      { name: 'card', width: 960, height: 640, position: 'centre' },
      { name: 'thumb', width: 480, height: 320, position: 'centre' },
    ],
  },
  fields: [
    { name: 'alt', type: 'text' },
    { name: 'isPublic', type: 'checkbox', defaultValue: false },
  ],
}
