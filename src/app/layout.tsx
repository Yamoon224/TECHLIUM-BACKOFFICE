import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Space_Grotesk } from "next/font/google";
import { AppearanceProvider } from "@/components/AppearanceProvider";
import { AppShell } from "@/components/AppShell";
import { PageTitle } from "@/components/PageTitle";
import { STORAGE_KEY } from "@/lib/appearance";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "TechLium Backoffice",
  description: "Gestion du catalogue, des commandes, des stocks et des vendeurs TechLium.",
};

export const viewport: Viewport = {
  themeColor: "#ee9e0b",
};

/**
 * Runs before the first paint: applies the stored theme (or the system's, in
 * automatic mode) so a dark-mode user never sees a white flash. The provider
 * takes over after hydration and applies the colours.
 */
const THEME_SCRIPT = `try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})||"{}");var t=s.theme;if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${spaceGrotesk.variable} ${plexSans.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col antialiased">
        <AppearanceProvider>
          <PageTitle />
          <AppShell>{children}</AppShell>
        </AppearanceProvider>
      </body>
    </html>
  );
}
