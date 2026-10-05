import localFont from 'next/font/local';

export const bodyFont = localFont({
  src: '../public/fonts/dm-sans.woff2',
  variable: '--font-body',
  display: 'swap',
  weight: '100 1000',
});

export const displayFont = localFont({
  src: '../public/fonts/cormorant-garamond.woff2',
  variable: '--font-display',
  display: 'swap',
  weight: '300 700',
});
