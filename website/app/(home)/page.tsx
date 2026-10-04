import Link from 'next/link';
import { basePath, releaseVersion, repository } from '@/lib/shared';

const example = `const panel = project.addScene('Night')
  .addShot('The last light').addPanel();

const ink = panel.addRasterLayer('Rough ink');
ink.rasterStroke(gesture, myBrush, { seed: 12 });

await project.save('last-light.cboard');`;

export default function Home() {
  return <main id="main-content" className="site-main">
    <section className="intro">
      <div className="intro-meta"><span>A drawing studio for your coding agent</span><Link href="/download">v{releaseVersion} · MIT</Link></div>
      <div className="intro-columns">
        <h1>Draw with code.<br /><em>Tell a story.</em></h1>
        <div className="intro-copy"><p>Give your agent a direction. Let it draw, animate, inspect and revise through JavaScript. Keep every layer, stroke and timing decision editable.</p>
          <div className="actions"><Link className="button primary" href="/docs">Read the docs</Link><Link className="button secondary" href="/download">Download Codeboard</Link></div>
          <p className="fine-print">Local tools. Your agent. No model subscription.</p>
        </div>
      </div>
    </section>
    <figure className="hero-art"><img src={`${basePath}/art/last-light.png`} width="1280" height="720" alt="A lantern keeper watches a mechanical firefly illuminate a rain-soaked city, drawn through Codeboard's public API." fetchPriority="high" />
      <figcaption><span><strong>THE LAST LIGHT</strong> / Code-authored storyboard</span><Link href="/examples#last-light">See the project</Link></figcaption>
    </figure>
    <section className="authoring-section">
      <div><span className="section-label">From a mark to a moving scene</span><h2>The artwork is<br /><em>still yours to change.</em></h2><p>Write a stroke. Adjust its pressure. Replace a drawing. Hold a shot a little longer. Codeboard gives your agent the drawing and production controls to make those changes directly.</p><Link className="text-link" href="/docs/agent-workflow">Follow the code → review → revise workflow</Link></div>
      <div className="source-sample"><div className="source-caption">JavaScript authoring</div><pre><code>{example}</code></pre><p>A brush, a gesture and an editable project. <Link href={`${repository}/blob/main/examples/last-light.ts`}>Read the full source.</Link></p></div>
    </section>
    <section className="guide-section"><h2>Put your agent to work.</h2><div className="guide-list">
      <Link href="/docs/brush-resources"><span>01</span><div><h3>Make your own marks</h3><p>Custom bitmap brushes, pressure dynamics and external brush resources.</p></div><span aria-hidden="true">↗</span></Link>
      <Link href="/docs/drawing-sequences"><span>02</span><div><h3>Give drawings time</h3><p>Frame-by-frame drawings, holds, onion skins and independent layer motion.</p></div><span aria-hidden="true">↗</span></Link>
      <Link href="/docs/storage"><span>03</span><div><h3>Keep the decisions editable</h3><p>Layered projects, targeted revisions, undo and reusable artwork.</p></div><span aria-hidden="true">↗</span></Link>
    </div></section>
    <footer className="site-footer"><span>Codeboard · Open source under MIT</span><Link href="/docs/architecture">Capabilities & limits</Link><a href={repository}>Source on GitHub</a></footer>
  </main>;
}
