import type { Metadata } from "next"
import Script from "next/script"
import "./globals.css"

export const metadata: Metadata = { title: "Meals — Laziness Center" }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 min-h-screen antialiased font-sans">
        {/* Shared Center top bar — injected via shim, adds 44px padding to body */}
        <Script src="/chrome/topbar.js" strategy="afterInteractive" />
        <header className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 text-sm">
          <nav className="flex items-center gap-5">
            <span className="font-semibold">Meals</span>
            <a href="/meals" className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">Suggestions</a>
            <a href="/meals/recipes" className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">Library</a>
            <a href="/meals/recipes/import" className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">Import</a>
            <a href="/meals/history" className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">History</a>
          </nav>
        </header>
        <main className="px-4 py-6 max-w-3xl mx-auto">{children}</main>
      </body>
    </html>
  )
}
