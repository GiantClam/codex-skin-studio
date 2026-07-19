'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import styles from './ThemePackageManager.module.css'

type Media = {
  id: number | string
  url?: string
  alt?: string
  sizes?: { card?: { url?: string }; thumb?: { url?: string } }
}

type Skin = {
  id: number | string
  title: string
  slug: string
  summary: string
  status: 'draft' | 'pending_review' | 'published' | 'rejected' | 'archived'
  version: string
  authorDisplayName?: string
  hero?: Media | number | string
  package?: { id: number | string } | number | string
}

type ThemePackage = {
  id: number | string
  filename?: string
  url?: string
  originalFilename?: string
  sha256: string
  packageKind: 'theme' | 'paired'
  validatorVersion: string
  validationStatus: 'pending' | 'passed' | 'failed'
  createdAt?: string
}

type PackageRow = { package: ThemePackage; skins: Skin[] }

type EditState = {
  packageId: string
  skinId?: string
  originalFilename: string
  packageKind: ThemePackage['packageKind']
  validationStatus: ThemePackage['validationStatus']
  validatorVersion: string
  title: string
  slug: string
  summary: string
  version: string
  authorDisplayName: string
  status: 'pending_review' | 'published' | 'archived'
}

type CreateState = {
  file: File | null
  title: string
  slug: string
  summary: string
  version: string
  authorDisplayName: string
  targets: string
  categories: string
  palette: string
}

const statusLabels: Record<EditState['status'], string> = {
  pending_review: '待审核',
  published: '已发布',
  archived: '已下架',
}

const packageStatusLabels: Record<ThemePackage['validationStatus'], string> = {
  pending: '待校验',
  passed: '校验通过',
  failed: '校验失败',
}

const emptyCreate: CreateState = {
  file: null,
  title: '',
  slug: '',
  summary: '',
  version: '1.0.0',
  authorDisplayName: 'Community contributor',
  targets: 'codex',
  categories: 'minimal',
  palette: 'paper',
}

function getID(value: unknown) {
  if (typeof value === 'number' || typeof value === 'string') return String(value)
  if (value && typeof value === 'object' && 'id' in value) return String((value as { id: number | string }).id)
  return ''
}

function heroURL(skin?: Skin) {
  if (!skin || !skin.hero || typeof skin.hero !== 'object') return ''
  return skin.hero.sizes?.card?.url ?? skin.hero.sizes?.thumb?.url ?? skin.hero.url ?? ''
}

function formatDate(value?: string) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
}

async function readJSON(response: Response) {
  const body = await response.json().catch(() => ({})) as { error?: string; errors?: Array<{ message?: string }> }
  if (!response.ok) throw new Error(body.error ?? body.errors?.[0]?.message ?? `请求失败（${response.status}）`)
  return body
}

export default function ThemePackageManager() {
  const [rows, setRows] = useState<PackageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | EditState['status']>('all')
  const [edit, setEdit] = useState<EditState | null>(null)
  const [create, setCreate] = useState<CreateState | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/admin/theme-packages?limit=100', { cache: 'no-store' })
      const data = await readJSON(response) as { packages: ThemePackage[]; skins: Skin[] }
      const grouped = new Map<string, Skin[]>()
      for (const skin of data.skins) {
        const packageID = getID(skin.package)
        if (!packageID) continue
        grouped.set(packageID, [...(grouped.get(packageID) ?? []), skin])
      }
      setRows(data.packages.map((item) => ({ package: item, skins: grouped.get(String(item.id)) ?? [] })))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '数据加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const filteredRows = useMemo(() => rows.filter(({ package: item, skins }) => {
    const skin = skins[0]
    const haystack = [item.originalFilename, item.sha256, item.packageKind, skin?.title, skin?.slug, skin?.authorDisplayName].join(' ').toLowerCase()
    const matchesQuery = !query.trim() || haystack.includes(query.trim().toLowerCase())
    const matchesStatus = statusFilter === 'all' || skins.some((candidate) => candidate.status === statusFilter)
    return matchesQuery && matchesStatus
  }), [query, rows, statusFilter])

  function openEdit(row: PackageRow) {
    const skin = row.skins[0]
    setEdit({
      packageId: String(row.package.id),
      skinId: skin ? String(skin.id) : undefined,
      originalFilename: row.package.originalFilename ?? row.package.filename ?? '',
      packageKind: row.package.packageKind,
      validationStatus: row.package.validationStatus,
      validatorVersion: row.package.validatorVersion,
      title: skin?.title ?? '',
      slug: skin?.slug ?? '',
      summary: skin?.summary ?? '',
      version: skin?.version ?? '',
      authorDisplayName: skin?.authorDisplayName ?? '',
      status: skin?.status === 'published' ? 'published' : skin?.status === 'archived' ? 'archived' : 'pending_review',
    })
  }

  async function saveEdit() {
    if (!edit) return
    setSaving(true)
    setError('')
    try {
      await readJSON(await fetch(`/api/admin/theme-packages/${edit.packageId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(edit),
      }))
      setEdit(null)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function removeRow(row: PackageRow) {
    if (!window.confirm(`确定删除「${row.skins[0]?.title ?? row.package.originalFilename ?? '此主题包'}」吗？关联的 Skin 和未复用的 Media 也会删除。`)) return
    setSaving(true)
    setError('')
    try {
      await readJSON(await fetch(`/api/admin/theme-packages/${row.package.id}`, { method: 'DELETE' }))
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '删除失败')
    } finally {
      setSaving(false)
    }
  }

  async function createPackage() {
    if (!create?.file) return
    setSaving(true)
    setError('')
    try {
      const form = new FormData()
      form.set('package', create.file)
      for (const field of ['title', 'slug', 'summary', 'version', 'authorDisplayName', 'targets', 'categories', 'palette'] as const) form.set(field, create[field])
      await readJSON(await fetch('/api/admin/theme-packages', { method: 'POST', body: form }))
      setCreate(null)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '新增失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>CONTENT OPERATIONS</p>
          <h1>Theme Packages</h1>
          <p className={styles.subtitle}>集中管理主题压缩包、预览素材与皮肤发布状态。</p>
        </div>
        <button className={styles.primaryButton} onClick={() => setCreate({ ...emptyCreate })}>新增 Theme Package</button>
      </header>

      <section className={styles.toolbar} aria-label="Theme Package filters">
        <input className={styles.search} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、文件名或 SHA-256" />
        <div className={styles.filters}>
          {(['all', 'pending_review', 'published', 'archived'] as const).map((value) => <button key={value} className={`${styles.filterButton} ${statusFilter === value ? styles.filterActive : ''}`} onClick={() => setStatusFilter(value)}>{value === 'all' ? '全部' : statusLabels[value]}</button>)}
        </div>
        <span className={styles.count}>{filteredRows.length} / {rows.length}</span>
      </section>

      {error && <div className={styles.error} role="alert">{error}</div>}
      {loading ? <div className={styles.empty}>正在加载 Theme Packages…</div> : filteredRows.length === 0 ? <div className={styles.empty}>没有匹配的 Theme Package。</div> : <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Preview</th><th>Skin</th><th>Package</th><th>状态</th><th>校验</th><th>更新时间</th><th aria-label="操作" /></tr></thead>
          <tbody>{filteredRows.map((row) => {
            const skin = row.skins[0]
            const image = heroURL(skin)
            const status = skin?.status === 'published' ? 'published' : skin?.status === 'archived' ? 'archived' : 'pending_review'
            return <tr key={String(row.package.id)}>
              <td><div className={styles.preview}>{image ? <img src={image} alt={skin?.title ?? 'Skin preview'} /> : <span>NO MEDIA</span>}</div></td>
              <td><strong>{skin?.title ?? '未关联 Skin'}</strong><small>{skin?.slug ?? '—'}</small><span className={styles.muted}>{skin?.summary ?? '此主题包尚未关联皮肤信息。'}</span></td>
              <td><strong>{row.package.originalFilename ?? row.package.filename ?? `package-${row.package.id}.zip`}</strong><small>{row.package.packageKind} · {row.package.validatorVersion}</small><code>{row.package.sha256.slice(0, 18)}…</code></td>
              <td><span className={`${styles.status} ${styles[`status_${status}`]}`}>{statusLabels[status]}</span>{row.skins.length > 1 && <small>+ {row.skins.length - 1} 个 Skin</small>}</td>
              <td><span className={`${styles.validation} ${styles[`validation_${row.package.validationStatus}`]}`}>{packageStatusLabels[row.package.validationStatus]}</span></td>
              <td className={styles.date}>{formatDate(row.package.createdAt)}</td>
              <td><div className={styles.actions}><button className={styles.editButton} onClick={() => openEdit(row)} disabled={saving}>编辑</button><button className={styles.deleteButton} onClick={() => void removeRow(row)} disabled={saving}>删除</button></div></td>
            </tr>
          })}</tbody>
        </table>
      </div>}

      {edit && <div className={styles.backdrop} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setEdit(null)}><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="edit-theme-package"><div className={styles.modalHeader}><div><p className={styles.kicker}>EDIT RECORD</p><h2 id="edit-theme-package">编辑 Theme Package</h2></div><button className={styles.close} onClick={() => setEdit(null)} aria-label="关闭">×</button></div><div className={styles.formGrid}><Field label="Package 文件名"><input value={edit.originalFilename} onChange={(event) => setEdit({ ...edit, originalFilename: event.target.value })} /></Field><Field label="Skin 标题"><input value={edit.title} onChange={(event) => setEdit({ ...edit, title: event.target.value })} /></Field><Field label="Slug"><input value={edit.slug} onChange={(event) => setEdit({ ...edit, slug: event.target.value })} /></Field><Field label="版本"><input value={edit.version} onChange={(event) => setEdit({ ...edit, version: event.target.value })} /></Field><Field label="作者"><input value={edit.authorDisplayName} onChange={(event) => setEdit({ ...edit, authorDisplayName: event.target.value })} /></Field><Field label="Package 类型"><select value={edit.packageKind} onChange={(event) => setEdit({ ...edit, packageKind: event.target.value as EditState['packageKind'] })}><option value="theme">theme</option><option value="paired">paired</option></select></Field><Field label="校验状态"><select value={edit.validationStatus} onChange={(event) => setEdit({ ...edit, validationStatus: event.target.value as EditState['validationStatus'] })}><option value="pending">待校验</option><option value="passed">校验通过</option><option value="failed">校验失败</option></select></Field><Field label="皮肤状态"><select value={edit.status} onChange={(event) => setEdit({ ...edit, status: event.target.value as EditState['status'] })}><option value="pending_review">待审核</option><option value="published">已发布</option><option value="archived">已下架</option></select></Field><Field label="校验器版本"><input value={edit.validatorVersion} onChange={(event) => setEdit({ ...edit, validatorVersion: event.target.value })} /></Field><Field label="简介" wide><textarea value={edit.summary} onChange={(event) => setEdit({ ...edit, summary: event.target.value })} rows={4} /></Field></div><div className={styles.modalFooter}><button className={styles.secondaryButton} onClick={() => setEdit(null)}>取消</button><button className={styles.primaryButton} onClick={() => void saveEdit()} disabled={saving}>{saving ? '保存中…' : '保存修改'}</button></div></section></div>}

      {create && <div className={styles.backdrop} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setCreate(null)}><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="create-theme-package"><div className={styles.modalHeader}><div><p className={styles.kicker}>NEW RECORD</p><h2 id="create-theme-package">新增 Theme Package</h2></div><button className={styles.close} onClick={() => setCreate(null)} aria-label="关闭">×</button></div><div className={styles.formGrid}><Field label="ZIP 文件" wide><input type="file" accept=".zip,application/zip" onChange={(event) => setCreate({ ...create, file: event.target.files?.[0] ?? null })} />{create.file && <small>{create.file.name}</small>}</Field><Field label="Skin 标题"><input value={create.title} onChange={(event) => setCreate({ ...create, title: event.target.value })} placeholder="必填" /></Field><Field label="Slug"><input value={create.slug} onChange={(event) => setCreate({ ...create, slug: event.target.value })} placeholder="可选" /></Field><Field label="简介" wide><textarea value={create.summary} onChange={(event) => setCreate({ ...create, summary: event.target.value })} rows={3} /></Field><Field label="版本"><input value={create.version} onChange={(event) => setCreate({ ...create, version: event.target.value })} /></Field><Field label="作者"><input value={create.authorDisplayName} onChange={(event) => setCreate({ ...create, authorDisplayName: event.target.value })} /></Field><Field label="目标平台"><input value={create.targets} onChange={(event) => setCreate({ ...create, targets: event.target.value })} placeholder="codex,chatgpt" /></Field><Field label="分类"><input value={create.categories} onChange={(event) => setCreate({ ...create, categories: event.target.value })} placeholder="minimal" /></Field><Field label="配色"><input value={create.palette} onChange={(event) => setCreate({ ...create, palette: event.target.value })} placeholder="paper" /></Field></div><div className={styles.modalFooter}><button className={styles.secondaryButton} onClick={() => setCreate(null)}>取消</button><button className={styles.primaryButton} onClick={() => void createPackage()} disabled={saving || !create.file}>{saving ? '上传中…' : '上传并创建'}</button></div></section></div>}
    </main>
  )
}

function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={`${styles.field} ${wide ? styles.wide : ''}`}><span>{label}</span>{children}</label>
}
