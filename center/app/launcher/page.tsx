export const dynamic = "force-dynamic"

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { db } from "@/db"
import { modules } from "@/db/schema"
import { parseManifest } from "@/lib/manifest"
import { eq } from "drizzle-orm"
import { CommandPalette } from "@/app/components/command-palette"

export default async function LauncherPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const userIdentifiers = [session.user?.email, session.user?.name].filter(Boolean) as string[]

  const allModules = await db
    .select()
    .from(modules)
    .where(eq(modules.enabled, true))
    .orderBy(modules.id)

  const visibleModules = allModules
    .map((mod) => {
      const parsed = parseManifest(mod.manifest_yaml)
      if (!parsed.success) return null
      return { db: mod, manifest: parsed.data }
    })
    .filter((m): m is NonNullable<typeof m> => m !== null)
    .filter((m) => !m.manifest.default_hidden.some((id) => userIdentifiers.includes(id)))

  return (
    <div className="min-h-screen flex flex-col">
      <CommandPalette />
      <header className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <Link
          href="/dashboard"
          className="font-semibold text-sm hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
        >
          Laziness Center
        </Link>
        <div className="flex items-center gap-4 text-sm text-neutral-500 dark:text-neutral-400">
          {session.user?.role === "admin" && (
            <Link href="/admin/modules" className="hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">
              Admin
            </Link>
          )}
          <span>{session.user?.name ?? session.user?.email}</span>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
        <h1 className="text-lg font-semibold mb-6">Launcher</h1>

        {visibleModules.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No modules registered yet.
            {session.user?.role === "admin" && (
              <>
                {" "}
                <Link
                  href="/admin/modules/new"
                  className="text-neutral-600 dark:text-neutral-300 underline hover:text-neutral-900 dark:hover:text-white"
                >
                  Add one
                </Link>
                .
              </>
            )}
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {visibleModules.map(({ db: mod, manifest }) => (
              <a
                key={mod.id}
                href={manifest.url}
                target={manifest.type === "linked" ? "_blank" : undefined}
                rel={manifest.type === "linked" ? "noopener noreferrer" : undefined}
                className="flex flex-col items-center gap-2.5 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center text-sm font-mono text-neutral-600 dark:text-neutral-300 uppercase">
                  {manifest.name.slice(0, 2)}
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium leading-snug">{manifest.name}</div>
                  {manifest.type === "linked" && (
                    <div className="text-xs text-neutral-400 dark:text-neutral-600 mt-0.5">↗ external</div>
                  )}
                </div>
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
