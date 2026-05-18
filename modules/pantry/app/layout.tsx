import type { Metadata } from "next"
import Script from "next/script"
import "./globals.css"

export const metadata: Metadata = { title: "Pantry — Laziness Center" }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 min-h-screen antialiased font-sans">
        <Script src="/chrome/topbar.js" strategy="afterInteractive" />
        <header className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 text-sm">
          <nav className="flex items-center gap-5">
            <span className="font-semibold">Pantry</span>
            <a href="/pantry" className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">Inventory</a>
            <a href="/pantry/purchase" className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">Log Purchase</a>
          </nav>
        </header>
        <main className="px-4 py-6 max-w-3xl mx-auto">{children}</main>
      </body>
    </html>
  )
}
