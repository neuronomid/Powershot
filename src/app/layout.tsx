import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { ErrorBoundary } from "@/components/error-boundary";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";

import "./globals.css";

const powershotCaptureQueueScript = `
(function () {
  if (window.__POWERSHOT_CAPTURE_QUEUE_INSTALLED__) return;
  window.__POWERSHOT_CAPTURE_QUEUE_INSTALLED__ = true;
  var queue = window.__POWERSHOT_CAPTURE_QUEUE__ || [];
  var seen = window.__POWERSHOT_CAPTURE_QUEUE_SEEN__ || new Set();
  window.__POWERSHOT_CAPTURE_QUEUE__ = queue;
  window.__POWERSHOT_CAPTURE_QUEUE_SEEN__ = seen;

  window.addEventListener("message", function (event) {
    if (event.source !== window || event.origin !== window.location.origin) {
      return;
    }

    var data = event.data;
    if (
      !data ||
      typeof data !== "object" ||
      data.type !== "POWERSHOT_CAPTURE" ||
      typeof data.captureId !== "string" ||
      !Array.isArray(data.images) ||
      seen.has(data.captureId)
    ) {
      return;
    }

    seen.add(data.captureId);
    queue.push(data);
    window.dispatchEvent(new CustomEvent("powershot:capture-queued"));
  });
})();
`;

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://powershot.org"),
  title: "Powershot — Turn screenshots into structured notes instantly",
  description:
    "Drop any screenshot and get clean, searchable notes in seconds. Free, no signup, 100% private. Works for students, researchers, and professionals.",
  keywords: [
    "screenshot to text",
    "screenshot to notes",
    "OCR",
    "AI notes",
    "study notes",
    "meeting notes",
    "markdown export",
    "PDF export",
    "privacy-first",
  ],
  manifest: "/site.webmanifest?v=3",
  icons: {
    icon: [
      { url: "/favicon.ico?v=3", sizes: "any" },
      { url: "/favicon.svg?v=3", type: "image/svg+xml" },
      {
        url: "/favicon-96x96.png?v=3",
        sizes: "96x96",
        type: "image/png",
      },
    ],
    shortcut: ["/favicon.ico?v=3"],
    apple: [{ url: "/apple-touch-icon.png?v=3", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    url: "https://powershot.org",
    title: "Powershot — Turn screenshots into structured notes instantly",
    description:
      "Drop any screenshot and get clean, searchable notes in seconds. Free, no signup, 100% private.",
    siteName: "Powershot",
    images: [
      {
        url: "/web-app-manifest-512x512.png",
        width: 512,
        height: 512,
        alt: "Powershot",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Powershot — Turn screenshots into structured notes instantly",
    description:
      "Drop any screenshot and get clean, searchable notes in seconds. Free, no signup, 100% private.",
    images: ["/web-app-manifest-512x512.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground min-h-full flex flex-col font-sans">
        <script
          dangerouslySetInnerHTML={{ __html: powershotCaptureQueueScript }}
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <ErrorBoundary>
            <SiteHeader />
            <main className="flex-1 pt-[var(--site-header-height)]">
              {children}
            </main>
            <SiteFooter />
          </ErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  );
}
