import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")
  if (session.user?.role !== "admin") redirect("/dashboard")

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800 text-sm">
        <Link
          href="/dashboard"
          className="text-neutral-500 hover:text-neutral-100 transition-colors"
        >
          ← Center
        </Link>
        <span className="text-neutral-700">/</span>
        <span className="text-neutral-300 font-medium">Admin</span>
      </header>

      <div className="flex flex-1">
        <nav className="w-44 shrink-0 border-r border-neutral-800 p-3 space-y-0.5">
          <Link
            href="/admin/modules"
            className="block text-sm px-3 py-2 rounded-md text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100 transition-colors"
          >
            Modules
          </Link>
        </nav>
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
