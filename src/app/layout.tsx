import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Focus English — One Platform. Four Skills. No Distractions.",
  description:
    "A calm, minimalist English-learning environment for Listening, Reading, Speaking, Writing, and personal vocabulary.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('focus-english-theme');var v=(t==='sage'||t==='ocean'||t==='warm'||t==='lavender'||t==='forest')?t:'sage';document.documentElement.setAttribute('data-theme',v);document.documentElement.style.colorScheme=v==='forest'?'dark':'light';}catch(e){document.documentElement.setAttribute('data-theme','sage');}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="sage"
      suppressHydrationWarning
      className={`${inter.variable} h-full`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body className="min-h-full bg-surface text-on-surface font-sans antialiased">
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
