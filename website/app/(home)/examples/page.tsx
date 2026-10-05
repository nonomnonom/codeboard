import { basePath, repository } from "@/lib/shared";
export const metadata = { title: "Examples" };
export default function Examples() {
  return (
    <main className="site-main inner-page">
      <span className="section-label">Made with the public API</span>
      <h1>
        A drawing.
        <br />
        <em>A considered hop.</em>
      </h1>
      <p className="page-lead">
        Start with the Codeboard character demo. Follow its drawings, exposures and revisions, then
        run the performance on your own machine.
      </p>
      <section id="code-board-demo" className="example-project">
        <div className="project-heading">
          <h2>Codeboard demo</h2>
          <span>48-second runnable demo · 8-second performance study</span>
        </div>
        {/* biome-ignore lint/a11y/useMediaCaption: These animated showcases use Foley without spoken dialogue; adjacent text describes each clip. */}
        <video
          controls
          playsInline
          preload="none"
          poster={`${basePath}/art/code-board-demo/poster.png`}
          src={`${basePath}/art/code-board-demo/walkthrough.mp4`}
          aria-label="Codeboard character animation walkthrough"
        >
          <a href={`${basePath}/art/code-board-demo/walkthrough.mp4`}>Watch the walkthrough</a>
        </video>
        <p>
          Clawd walks, notices a line, gathers weight, hops and lands. The walkthrough shows the
          source, pose controls and drawing decisions. Its terminal scenes are a scripted
          presentation; the artwork is authored through the public API.
        </p>
        <p className="fine-print">
          Rendered with the released Codeboard CLI and original synthesized Foley. Clawd is the
          character depicted in the supplied demo; no endorsement by Anthropic is claimed.
        </p>
        <p>
          <a className="text-link" href={`${basePath}/docs/code-board-demo/`}>
            How the demo is made
          </a>
        </p>
        <img
          className="demo-pose-sheet"
          src={`${basePath}/art/code-board-demo/poses.png`}
          alt="Eight performance frames: walk, notice, crouch, push, flight, landing, recovery and settle"
          loading="lazy"
          width="1760"
          height="576"
        />
      </section>
      <section id="last-light" className="example-project">
        <div className="project-heading">
          <h2>The Last Light</h2>
          <span>14 panels · 30.5 seconds</span>
        </div>
        {/* biome-ignore lint/a11y/useMediaCaption: These animated showcases use Foley without spoken dialogue; adjacent text describes each clip. */}
        <video
          controls
          preload="none"
          poster={`${basePath}/art/last-light.png`}
          src={`${basePath}/art/last-light.mp4`}
          aria-label="The Last Light animatic"
        >
          <a href={`${basePath}/art/last-light.mp4`}>Watch The Last Light</a>
        </video>
        <p>
          A lantern keeper lends the last of his light to a broken mechanical firefly. Layered city
          artwork, frame-by-frame wings, camera motion and an original soundtrack.
        </p>
        <p className="fine-print">
          A development example demonstrating the engine. Illustration and acting remain stylized;
          this is not a claim of full-animation production parity.
        </p>
        <div className="actions">
          <a
            className="text-link"
            href={`${repository}/blob/main/examples/last-light/src/cli/run.ts`}
          >
            Read the authoring source
          </a>
          <a
            className="text-link"
            href={`${repository}/blob/main/examples/last-light/src/cli/revise.ts`}
          >
            Inspect a directed revision
          </a>
        </div>
      </section>
      <section className="example-project">
        <div className="project-heading">
          <h2>Lengkap</h2>
          <span>6 scenes · 15 seconds</span>
        </div>
        {/* biome-ignore lint/a11y/useMediaCaption: These animated showcases use Foley without spoken dialogue; adjacent text describes each clip. */}
        <video
          controls
          preload="none"
          poster={`${basePath}/art/lengkap-storyboard.png`}
          src={`${basePath}/art/lengkap.mp4`}
          aria-label="Lengkap brush film"
        >
          <a href={`${basePath}/art/lengkap.mp4`}>Watch Lengkap</a>
        </video>
        <p>
          A report says everything is there. The warehouse tells a different story. Procedural
          brushwork, a red approval stamp and original Foley.
        </p>
        <a className="text-link" href={`${repository}/blob/main/examples/lengkap/src/cli/run.ts`}>
          Read the authoring source
        </a>
      </section>
      <p className="fine-print">
        Example source code: MIT. The Last Light and Lengkap original artwork and audio: CC0-1.0.
      </p>
    </main>
  );
}
