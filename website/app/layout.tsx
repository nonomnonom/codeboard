import type { Metadata } from "next";
import { Provider } from "@/components/provider";
import { creator, siteUrl } from "@/lib/shared";
import { bodyFont, displayFont } from "./fonts";
import "./global.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  authors: [{ name: creator.name, url: creator.url }],
  creator: creator.name,
  title: {
    default: "Codeboard | Draw with code. Keep the story editable.",
    template: "%s | Codeboard",
  },
  description:
    "Drawing, storyboards and 2D animation for JavaScript, TypeScript and your coding agent. Open source, editable projects, local rendering.",
};

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${bodyFont.variable} ${displayFont.variable} flex flex-col min-h-screen`}>
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
