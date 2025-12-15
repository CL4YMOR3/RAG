import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap', // Prevent FOIT (Flash of Invisible Text)
  preload: true,
});

export const metadata: Metadata = {
  title: 'NEXUS | Team Knowledge Intelligence',
  description: 'Enterprise RAG System - Query your team knowledge base with AI-powered intelligence.',
  keywords: ['RAG', 'AI', 'Knowledge Base', 'Enterprise', 'Team', 'NEXUS'],
  robots: 'noindex, nofollow', // Internal app - don't index
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#020204',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="http://localhost:8000" />
      </head>
      <body
        className={`${inter.variable} bg-void text-txt-primary font-sans antialiased h-screen overflow-hidden`}
      >
        {children}
      </body>
    </html>
  );
}
