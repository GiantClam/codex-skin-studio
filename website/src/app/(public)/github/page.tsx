import { GitHubSearch } from '@/components/GitHubSearch'
import { PublicWorkspace } from '@/components/PublicWorkspace'

export const dynamic = 'force-dynamic'

export default function GitHubPage() {
  return <PublicWorkspace current="github"><section className="screen workbench-screen screen-info is-visible"><section className="index-head"><div><span className="kicker">SOURCE DISCOVERY / GITHUB</span><h1>Find a package<br /><em>worth reviewing.</em></h1><p>Search public repositories, inspect their license and metadata, then import a snapshot into the human review queue.</p></div></section><GitHubSearch /></section></PublicWorkspace>
}
