import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jeopardy",
  description: "Multiplayer Jeopardy-style game",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/css/styles.css" />
      </head>
      <body>
        {children}
        <Script src="/js/clue-media.js" strategy="beforeInteractive" />
        <Script src="/js/youtube-audio.js" strategy="beforeInteractive" />
        <Script src="/js/clue-audio.js" strategy="beforeInteractive" />
        <Script src="/js/connection.js" strategy="beforeInteractive" />
        <Script src="/js/golden-confetti.js" strategy="beforeInteractive" />
        <Script src="/js/score-effects.js" strategy="beforeInteractive" />
      </body>
    </html>
  );
}
