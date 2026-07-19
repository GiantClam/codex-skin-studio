import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { CSSProperties } from 'react'

import { PublicWorkspace } from '@/components/PublicWorkspace'
import { SkinArt } from '@/components/SkinCard'
import { getPublicSkin } from '@/lib/skins/catalog'

export const dynamic = 'force-dynamic'

export default async function SkinDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const skin = await getPublicSkin((await params).slug)
  if (!skin) notFound()
 return <PublicWorkspace current="featured"><section className="screen workbench-screen screen-detail is-visible"><div className="detail-top"><Link className="back-action" href="/skins">← Back to archive</Link><span className="detail-number">{skin.hasPet ? 'THEME + PET' : 'THEME'} / {skin.slug.toUpperCase()}</span></div><div className="detail-layout"><div className="detail-art art-arcana large-art detail-visual"><SkinArt skin={skin} /></div><div className="detail-copy"><div className="kicker">CODEX + CHATGPT DESKTOP / {skin.hasPet ? 'PAIRED PACKAGE' : 'PUBLISHED PACKAGE'}</div><h1>{skin.title.split(' ').map((word, index) => <span key={word}>{index === 0 ? word : <><br /><em>{word}</em></>}</span>)}</h1><p className="detail-lede">{skin.summary}</p><div className="swatches"><span style={{ '--swatch': '#173247' } as CSSProperties} /><span style={{ '--swatch': '#d4c3a2' } as CSSProperties} /><span style={{ '--swatch': '#b43d2a' } as CSSProperties} /><span style={{ '--swatch': '#2b5268' } as CSSProperties} /></div><dl className="spec-list"><div><dt>Targets</dt><dd>{skin.targets.map((target) => target === 'chatgpt' ? 'ChatGPT Desktop' : 'Codex').join(' + ')}</dd></div><div><dt>Version</dt><dd>{skin.version} / stable</dd></div>{skin.pet && <div><dt>Pet</dt><dd>{skin.pet.displayName}</dd></div>}<div><dt>Downloads</dt><dd>{skin.downloads.toLocaleString()}</dd></div><div><dt>Author</dt><dd>{skin.authorDisplayName}</dd></div></dl><div className="detail-actions"><Link className="primary-action" href={`/download/${skin.slug}`}>Download {skin.hasPet ? 'pair' : 'theme'} <span>↓</span></Link><Link className="secondary-action" href="/about">How it works ↗</Link></div><p className="checksum">PACKAGE / <code>{skin.hasPet ? 'bundle.json + theme/ + pet/' : 'theme.json + hero.webp'}</code></p></div></div><div className="detail-bottom"><div><span className="kicker">IN THIS PACKAGE</span>{skin.hasPet ? <><span>bundle.json</span><span>theme/</span><span>pet/</span></> : <><span>theme.json</span><span>hero.webp</span><span>logo.webp / optional</span></>}</div><div><span className="kicker">SOURCE</span>{skin.sourceUrl ? <a href={skin.sourceUrl} target="_blank" rel="noreferrer noopener nofollow">{skin.sourceType === 'github' ? 'GitHub source ↗' : 'Creator link ↗'}</a> : <span>{skin.sourceType === 'github' ? 'GitHub source' : 'Manual upload'}</span>}<span>reviewed before publish</span></div></div></section></PublicWorkspace>
}
