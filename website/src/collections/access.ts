import type { Access, Where } from 'payload'

export const isAdmin: Access = ({ req }) => Boolean(req.user && ['admin', 'editor', 'reviewer'].includes(req.user.role))
export const isReviewer: Access = ({ req }) => Boolean(req.user && ['admin', 'reviewer'].includes(req.user.role))

export const publishedOnly: Access = (): Where => ({ status: { equals: 'published' } })

export const hasRole = (roles: string[]): Access => ({ req }) => Boolean(req.user && roles.includes(req.user.role))
