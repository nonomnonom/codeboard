import Link from "next/link";
import { repository } from "@/lib/shared";
import { CreatorCredit } from "./creator-credit";

export function SiteFooter() {
  return (
    <footer className="site-main site-footer">
      <CreatorCredit />
      <div className="footer-links">
        <span>Free and open source · MIT</span>
        <Link href="/docs/reference">API guide</Link>
        <a href={repository}>GitHub</a>
      </div>
    </footer>
  );
}
