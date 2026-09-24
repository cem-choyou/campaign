import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { THEME_COOKIE, parseTheme } from "@/lib/preferences/cookies";
import "./globals.css";

// Self-hosted at build time by next/font: no request to Google at runtime.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Campaign", template: "%s · Campaign" },
  description: "Planifiez, rédigez et suivez vos campagnes LinkedIn et YouTube.",
  applicationName: "Campaign",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#111113" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <html lang="fr" data-theme={theme} className={inter.variable} suppressHydrationWarning>
      <body className="min-h-dvh">
        <ThemeProvider initialTheme={theme}>
          <TooltipProvider delayDuration={300}>
            {children}
            <Toaster position="bottom-right" closeButton />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
