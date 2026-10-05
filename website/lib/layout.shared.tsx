import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { appName, creator, gitConfig } from "./shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="wordmark">
          {appName}
          <span className="wordmark-period">.</span>
        </span>
      ),
    },
    links: [
      { text: "Docs", url: "/docs", active: "nested-url" },
      { text: "Examples", url: "/examples", active: "url" },
      { text: "Nonom Library", url: creator.library, external: true },
    ],
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
