'use client'

import { useState } from 'react'

export function DownloadButton({ slug, label }: { slug: string; label: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function requestDownload() {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/skins/${encodeURIComponent(slug)}/download-grant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ confirm: true }),
      })
      const result = await response.json().catch(() => null) as { downloadUrl?: string; error?: string } | null
      if (!response.ok || !result?.downloadUrl) throw new Error(result?.error || 'Download could not be prepared.')
      window.location.assign(result.downloadUrl)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Download could not be prepared.')
      setBusy(false)
    }
  }

  return <div className="download-action-wrap">
    <button className="primary-action" type="button" onClick={requestDownload} disabled={busy}>
      {busy ? 'Preparing…' : label} <span aria-hidden="true">↓</span>
    </button>
    {error && <p className="download-action-error" role="alert">{error}</p>}
  </div>
}
