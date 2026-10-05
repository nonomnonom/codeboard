import Link from "next/link";
export default function NotFound() {
  return (
    <main className="site-main inner-page">
      <span className="section-label">404</span>
      <h1>
        This page
        <br />
        <em>isn't on the board.</em>
      </h1>
      <p className="page-lead">
        The link may have changed. Browse the documentation or return to Codeboard.
      </p>
      <div className="actions">
        <Link className="button primary" href="/docs">
          Browse documentation
        </Link>
        <Link className="button secondary" href="/">
          Return home
        </Link>
      </div>
    </main>
  );
}
