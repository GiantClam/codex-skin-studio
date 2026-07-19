'use client'

import { FormEvent, useState } from 'react'

type Repository = { repositoryUrl: string; fullName?: string; description?: string | null; defaultBranch?: string; licenseSpdxId?: string | null; stars?: number; updatedAt?: string }

export function GitHubSearch() {
  const [query, setQuery] = useState('codex theme')
  const [items, setItems] = useState<Repository[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function search(event?: FormEvent) {
    event?.preventDefault()
    setBusy(true)
    setMessage('')
    const response = await fetch(`/api/github/search?q=${encodeURIComponent(query)}`)
    const result = await response.json().catch(() => ({})) as { items?: Repository[]; error?: string }
    setItems(result.items ?? [])
    setMessage(response.ok ? `${result.items?.length ?? 0} repositories found.` : result.error ?? 'GitHub search failed.')
    setBusy(false)
  }

  async function importRepository(repositoryUrl: string) {
    setBusy(true)
    setMessage('Downloading repository snapshot and checking package…')
    const response = await fetch('/api/github/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repositoryUrl }) })
    const result = await response.json().catch(() => ({})) as { slug?: string; error?: string }
    setMessage(response.ok ? `Imported ${result.slug ?? 'repository'} into the review queue.` : result.error ?? 'Repository import failed.')
    setBusy(false)
  }

  return <div className="github-workbench"><form className="search-form" onSubmit={search}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search GitHub repositories…" /><button type="submit" disabled={busy}>Search ↗</button></form>{message && <p className="submit-form__status" role="status">{message}</p>}<div className="github-results">{items.map((item) => <article className="github-result" key={item.repositoryUrl}><div><span className="eyebrow">{item.licenseSpdxId ?? 'LICENSE UNDECLARED'} · {item.stars ?? 0} STARS</span><h2>{item.fullName}</h2><p>{item.description ?? 'No repository description.'}</p></div><div className="github-result__actions"><a href={item.repositoryUrl} target="_blank" rel="noreferrer">Open ↗</a><button type="button" onClick={() => importRepository(item.repositoryUrl)} disabled={busy}>Import for review</button></div></article>)}</div></div>
}
