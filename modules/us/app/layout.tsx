import type { Metadata } from "next"
import Script from "next/script"
import "./globals.css"

export const metadata: Metadata = { title: "Us — Laziness Center" }

const NAV = [
  { label: "Checklists", href: "/us/checklists" },
  { label: "Wishlists", href: "/us/wishlists" },
  { label: "Places", href: "/us/places" },
  { label: "Activity", href: "/us/activity" },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 min-h-screen antialiased font-sans">
        <Script src="/chrome/topbar.js" strategy="afterInteractive" />
        <header className="border-b border-neutral-200 dark:border-neutral-800">
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="font-semibold text-sm">Us ♡</span>
            <a href="/us/search" className="text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">Search</a>
          </div>
          <nav className="flex gap-1 px-4 pb-0 overflow-x-auto">
            {NAV.map(({ label, href }) => (
              <a
                key={href}
                href={href}
                className="px-3 py-2 text-sm whitespace-nowrap text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 border-b-2 border-transparent hover:border-neutral-400 dark:hover:border-neutral-500 transition-colors"
              >
                {label}
              </a>
            ))}
          </nav>
        </header>
        <main className="px-4 py-6 max-w-2xl mx-auto">{children}</main>
      </body>
    </html>
  )
}
