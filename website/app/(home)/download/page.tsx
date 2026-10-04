import Link from 'next/link';
import { releaseVersion, repository } from '@/lib/shared';
export const metadata = { title: 'Install Codeboard' };
const builds = [
  ['Windows', 'x64', 'windows-x64.zip'],
  ['Linux', 'x64 · glibc', 'linux-x64.tar.gz'],
  ['macOS', 'Apple Silicon', 'macos-arm64.tar.gz'],
  ['macOS', 'Intel', 'macos-x64.tar.gz'],
];
export default function Download() {
  const release = `${repository}/releases/download/v${releaseVersion}`;
  return <main className="site-main inner-page">
    <span className="section-label">Codeboard {releaseVersion}</span>
    <h1>Install.<br /><em>Then make a mark.</em></h1>
    <p className="page-lead">One command installs Codeboard and its runtime. No npm account, separate Node installation, or administrator access.</p>
    <section className="installer-section" aria-label="Install commands">
      <div><h2>macOS / Linux</h2><p>Apple Silicon, Intel Mac, or Linux x64 with glibc.</p><pre tabIndex={0}><code>curl -fsSL https://codeboard.nonom.xyz/install.sh | sh</code></pre><a className="text-link" href="/install.sh">Read the shell installer</a></div>
      <div><h2>Windows</h2><p>Run in 64-bit PowerShell on Windows x64.</p><pre tabIndex={0}><code>{'& ([scriptblock]::Create((Invoke-RestMethod https://codeboard.nonom.xyz/install.ps1)))'}</code></pre><a className="text-link" href="/install.ps1">Read the PowerShell installer</a></div>
    </section>
    <section className="install-notes"><h2>Your first drawing</h2><p>Open a new terminal in your project folder. Create a script and run it:</p><pre tabIndex={0}><code>{'codeboard init\ncodeboard run scene.mjs'}</code></pre><p>Open <code>output/first.png</code> to see the result. Keep <code>output/first.cboard</code> to continue editing.</p><Link className="button primary" href="/docs/quickstart">Follow the quickstart</Link></section>
    <section className="manual-downloads"><h2>Portable archives</h2><p>Prefer to extract an archive yourself? Choose a package below.</p>
      <div className="download-table"><table><caption className="sr-only">Portable packages by operating system</caption><thead><tr><th>System</th><th>Architecture</th><th>Archive</th></tr></thead><tbody>{builds.map(([os,arch,file])=><tr key={file}><td>{os}</td><td>{arch}</td><td><a className="text-link" href={`${release}/codeboard-${releaseVersion}-${file}`}>{file.endsWith('.zip')?'ZIP':'tar.gz'}<span className="sr-only">{` for ${os} ${arch}`}</span></a></td></tr>)}</tbody></table></div>
    </section>
    <div className="release-notes"><p><a href={`${release}/SHA256SUMS`}>SHA-256 checksums</a> · <a href={`${repository}/releases/tag/v${releaseVersion}`}>Release notes</a></p><p>FFmpeg is needed for movie export. Fonts are not bundled. See <Link href="/docs/install">installation, updates, and troubleshooting</Link>.</p></div>
  </main>;
}
