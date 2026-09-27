import type { Metadata } from "next";
import "./globals.css";
import "./hacker-theme.css";
import { SiteShell } from '@/components/site-shell';

export const metadata: Metadata = {
  title: { default: "SignalCTF — Find your next challenge", template: "%s | SignalCTF" },
  description: "Discover cybersecurity CTFs around the world. Online, in person, and hybrid events with source checks, local times, and calendar tools.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased"><SiteShell>{children}</SiteShell></body>
    </html>
  );
}
