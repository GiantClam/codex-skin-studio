import type { Metadata } from 'next'

import '../globals.css'
import '../skin-layout-fixes.css'
import '../workbench-fidelity.css'

export const metadata: Metadata = {
  title: 'Codex Theme Archive',
  description: 'Verified visual themes for Codex and ChatGPT Desktop.',
}

export default function PublicLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>
}
