import type { Metadata } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Trivia Generation MVP",
  description: "Novelty-aware trivia generation with Next.js, Drizzle, pgvector, and OpenAI."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
