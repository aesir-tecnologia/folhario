import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Source_Serif_4, Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";

import { PostHogProvider } from "./posthog-provider";
import { getTheme } from "@shared/theme/use-theme";

import "./globals.css";

const sourceSerif = Source_Serif_4({
  subsets: ["latin", "latin-ext"],
  variable: "--font-source-serif",
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

export const metadata = {
  title: "Folhário",
  description: "Identifique, catalogue e cuide das suas plantas.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  // User scaling NOT disabled (UI-22 accessibility).
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  const theme = await getTheme(); // Open Risk #4 — MUST live in root layout, not (app)/layout.tsx.

  // Only set data-theme for explicit "light"/"dark"; "auto" omits attribute so
  // CSS @media (prefers-color-scheme: dark) controls flash-free first paint (D-03).
  const dataTheme = theme === "auto" ? undefined : theme;

  return (
    <html
      lang={locale}
      {...(dataTheme ? { "data-theme": dataTheme } : {})}
      className={`
        ${sourceSerif.variable}
        ${plusJakarta.variable}
      `}
    >
      <head>
        {/* PWA contract — D-18 dual <meta theme-color> superseding Phase 1's #FFFFFF placeholder. */}
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#FBF7EF" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#1A1613" />
        <link rel="manifest" href="/manifest.webmanifest" />
        {/* Plan 04 task adds icon set links here once pwa-asset-generator runs. */}
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <PostHogProvider>{children}</PostHogProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
