import Link from 'next/link';
import { releaseVersion, repository } from '@/lib/shared';
export const metadata = { title: 'Download' };
const builds = [
  ['Windows', 'x64', 'windows-x64.zip', '%LOCALAPPDATA%\\Programs\\Codeboard', 'codeboard.cmd'],
  ['Linux', 'x64 · glibc', 'linux-x64.tar.gz', '~/.local/opt/codeboard', 'codeboard'],
  ['macOS', 'Apple Silicon', 'macos-arm64.tar.gz', '~/.local/opt/codeboard', 'codeboard'],
  ['macOS', 'Intel', 'macos-x64.tar.gz', '~/.local/opt/codeboard', 'codeboard'],
];
export default function Download() {
  const release = `${repository}/releases/download/v${releaseVersion}`;
  return <main className="site-main inner-page"><span className="section-label">Codeboard {releaseVersion}</span><h1>Your studio.<br /><em>On your machine.</em></h1><p className="page-lead">Portable packages include Node and native drawing dependencies. Pick your OS, extract the archive, and run the launcher. No npm account or separate Node installation.</p>
    <div className="download-table"><table><caption className="sr-only">Downloads for each supported operating system</caption><thead><tr><th>System</th><th>Architecture</th><th>Download</th></tr></thead><tbody>{builds.map(([os,arch,file])=><tr key={file}><td>{os}</td><td>{arch}</td><td><a className="button secondary" href={`${release}/codeboard-${releaseVersion}-${file}`}>Download {file.endsWith('.zip')?'ZIP':'tar.gz'}<span className="sr-only"> for {os} {arch}</span></a></td></tr>)}</tbody></table></div>
    <section className="install-notes"><h2>Extract. Add to PATH. Draw.</h2><p>Keep the complete extracted directory together. Put your projects in a separate working folder.</p><dl>{builds.filter((_,i)=>i!==3).map(([os,,file,path,launcher])=><div key={file}><dt>{os}</dt><dd><code>{path}</code><span>Launcher: <code>{launcher}</code></span></dd></div>)}</dl><Link className="button primary" href="/docs/install">Installation instructions</Link></section>
    <div className="release-notes"><p><a href={`${release}/SHA256SUMS`}>SHA-256 checksums</a> · <a href={`${repository}/releases/tag/v${releaseVersion}`}>Release notes and SDK archive</a></p><p>FFmpeg is required separately for movie export. Fonts are not bundled. These are portable archives, not signed or notarized installers. See <Link href="/docs/install">tested platforms and setup details</Link>.</p></div>
  </main>;
}
