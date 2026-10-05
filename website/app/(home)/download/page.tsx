import Link from 'next/link';
import { releaseVersion, repository } from '@/lib/shared';
export const metadata = { title: 'Install Codeboard' };

export default function Download() {
  return <main className="site-main inner-page">
    <span className="section-label">Codeboard {releaseVersion}</span>
    <h1>Install.<br /><em>Then make a mark.</em></h1>
    <p className="page-lead">Install the CLI and JavaScript/TypeScript library from npm. Requires Node.js 22.22 or later and npm.</p>
    <section className="installer-section" aria-label="Install commands">
      <div><h2>CLI for your machine</h2><p>Use the same command on Windows, macOS, and Linux.</p><pre tabIndex={0}><code>{'npm install -g codeboard-studio\ncodeboard --version'}</code></pre><a className="text-link" href="https://www.npmjs.com/package/codeboard-studio">View the npm package</a></div>
      <div><h2>Dependency for your project</h2><p>Keep the library and CLI version in your project lockfile.</p><pre tabIndex={0}><code>{'npm install --save-exact codeboard-studio\nnpx codeboard --version'}</code></pre><Link className="text-link" href="/docs/install">Installation and updates</Link></div>
    </section>
    <section className="install-notes"><h2>Your first drawing</h2><p>With the global CLI installed, open a terminal in your artwork folder:</p><pre tabIndex={0}><code>{'codeboard init\ncodeboard run scene.mjs'}</code></pre><p>For a project installation, use <code>npx codeboard</code>. Open <code>output/first.png</code> to see the result. Keep <code>output/first.cboard</code> to continue editing.</p><Link className="button primary" href="/docs/quickstart">Follow the quickstart</Link></section>
    <div className="release-notes"><p><a href={`${repository}/blob/main/CHANGELOG.md`}>Changelog</a></p><p>FFmpeg is needed for movie export. Fonts are not bundled. Migrating from an older installer? Follow the <Link href="/docs/install#migrate-from-the-old-installer">npm migration guide</Link>.</p></div>
  </main>;
}
