import Link from 'next/link'

import type { SkinSummary } from '@/lib/skins/catalog'

export function SkinArt({ skin, compact = false }: { skin: SkinSummary; compact?: boolean }) {
  return (
    <div className={`skin-art skin-art--${skin.art}${compact ? ' skin-art--compact' : ''}`} style={skin.heroUrl ? { backgroundImage: `url("${skin.heroUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined} aria-label={`${skin.title} preview`}>
      <span className="art-grid" />
      {skin.art === 'arcana' && <><span className="art-orb" /><span className="art-constellation">✦ · · ✦</span><span className="art-label">ARCANA / 001</span></>}
      {skin.art === 'oxide' && <><span className="art-oxide-mark">07</span><span className="art-label">OXIDE / FIELD</span></>}
      {skin.art === 'green' && <><span className="art-green-circle" /><span className="art-label">GREEN / ROOM</span></>}
      {skin.art === 'miku' && <><span className="art-signal">/// 39</span><span className="art-label">SIGNAL / 2D</span></>}
      {skin.art === 'paper' && <><span className="art-paper-line" /><span className="art-label">PAPER / PROTOCOL</span></>}
    </div>
  )
}

export function SkinCard({ skin }: { skin: SkinSummary }) {
  return (
    <article className="skin-card theme-card">
      <Link href={`/skins/${skin.slug}`} className="skin-card__visual-link theme-card__visual-link">
        <SkinArt skin={skin} />
        <span className="skin-card__badge theme-card__badge">{skin.targets.length === 2 ? 'CODEX + CHATGPT' : skin.targets[0] === 'codex' ? 'CODEX' : 'CHATGPT'}</span>
        {skin.hasPet && <span className="skin-card__pet-badge theme-card__pet-badge">INCLUDES PET</span>}
        <span className="skin-card__quick">View theme ↗</span>
      </Link>
      <div className="skin-card__body theme-card__body card-body">
        <div><h3>{skin.title}</h3><p>{skin.targets.map((target) => target === 'codex' ? 'Codex' : 'ChatGPT').join(' + ')} · {skin.categories[0] ?? 'desktop'}</p></div>
        <span className="card-arrow" aria-hidden="true">↗</span>
      </div>
    </article>
  )
}
