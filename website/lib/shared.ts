import { createGetUrl } from 'fumadocs-core/source';

export const appName = 'Codeboard';
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://codeboard.nonom.xyz';
export const releaseVersion = '0.2.0';
export const repository = 'https://github.com/nonomnonom/codeboard';
export const docsRoute = '/docs';
export const docsImageRoute = '/og/docs';
export const docsContentRoute = '/llms.mdx/docs';

export const gitConfig = {
  user: 'nonomnonom',
  repo: 'codeboard',
  branch: 'main',
};

const getContentUrl = createGetUrl(docsContentRoute);

export function getPageMarkdownUrl(page: { slugs: string[]; locale?: string }) {
  const segments = [...page.slugs, 'content.md'];

  return { segments, url: `${basePath}${getContentUrl(segments, page.locale)}` };
}

const getImageUrl = createGetUrl(docsImageRoute);

export function getPageImageUrl(page: { slugs: string[]; locale?: string }) {
  const segments = [...page.slugs, 'image.png'];

  return { segments, url: `${basePath}${getImageUrl(segments, page.locale)}` };
}
