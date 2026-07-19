import { PublicWorkspace } from '@/components/PublicWorkspace'

export const dynamic = 'force-dynamic'

export default function PrivacyPage() {
  return <PublicWorkspace current="privacy">
    <section className="screen workbench-screen screen-info is-visible">
      <div className="privacy-layout">
        <div className="privacy-intro">
          <span className="kicker">PRIVACY / LAST UPDATED 2026.07.18</span>
          <h1>Clear boundaries.<br /><em>Useful defaults.</em></h1>
          <p>Codex Theme Archive is a public library for Codex and ChatGPT Desktop themes. This page explains what the site receives, what becomes public, and how the skill upload flow keeps control with the person who created the theme.</p>
        </div>
        <div className="privacy-stamp">NO ACCOUNT<br />REQUIRED</div>
        <div className="privacy-grid">
          <article><span className="privacy-number">01</span><h2>Browsing</h2><p>You can browse published themes and download packages without creating an account. The site does not ask visitors for a name, email address, or profile.</p></article>
          <article><span className="privacy-number">02</span><h2>Skill uploads</h2><p>There is no public submit form. The Codex Skin Studio skill asks for explicit consent before it calls the signed upload API. The package is validated, rate-limited, and placed into a review queue; it is not published automatically.</p></article>
          <article><span className="privacy-number">03</span><h2>Public creator info</h2><p>Before upload, the creator can edit the title, slug, summary, display name, GitHub source, and license. Once approved, the selected information and package may appear on a public theme card. Do not upload private contact details.</p></article>
          <article><span className="privacy-number">04</span><h2>Safety records</h2><p>The service may process the package checksum, validation report, moderation decisions, download counts, request identifiers, and abuse-prevention signals such as an IP address supplied by the edge network. These records support deduplication, security, and moderation.</p></article>
          <article><span className="privacy-number">05</span><h2>Infrastructure</h2><p>The site runs on Cloudflare Workers, D1, R2, and related edge services. Theme packages and media are stored there so the archive can validate, review, serve, and count downloads.</p></article>
          <article><span className="privacy-number">06</span><h2>Your choices</h2><p>Do not consent to upload if you want to keep a theme private. For removal or privacy questions, contact the archive maintainer at <a href="mailto:privacy@codexskinstudio.com">privacy@codexskinstudio.com</a>. Replace this address before launch if the mailbox is managed elsewhere.</p></article>
        </div>
        <p className="privacy-note">This notice describes the current product behavior. It is not legal advice. The maintainer may update it when storage, moderation, or upload behavior changes.</p>
      </div>
    </section>
  </PublicWorkspace>
}
