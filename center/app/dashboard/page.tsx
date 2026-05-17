import { auth, signOut } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { and, eq, isNull } from "drizzle-orm"
import { db } from "@/db"
import { modules, notifications } from "@/db/schema"
import { parseManifest } from "@/lib/manifest"
import { fetchWidgetData } from "@/lib/widget-fetch"
import type { WidgetPayload } from "@/lib/widget-schema"
import { getWidgetOrder, moveWidget } from "./actions"
import { CommandPalette } from "@/app/components/command-palette"

// ── Types ─────────────────────────────────────────────────────────────────────

type WidgetRef = { moduleId: string; widgetId: string }

type ResolvedWidget = WidgetRef & {
  moduleName: string
  refreshSeconds: number
  internalApi: string
  endpoint: string
  data: WidgetPayload | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Sorts `refs` by `savedOrder`, appending any unknown refs at the end. */
function applyOrder<T extends WidgetRef>(refs: T[], savedOrder: WidgetRef[]): T[] {
  const ordered: T[] = []
  const pool = [...refs]

  for (const { moduleId, widgetId } of savedOrder) {
    const i = pool.findIndex((r) => r.moduleId === moduleId && r.widgetId === widgetId)
    if (i !== -1) ordered.push(pool.splice(i, 1)[0])
  }

  return [...ordered, ...pool]
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const userId = session.user?.email ?? session.user?.name ?? ""

  // Unread notification count for the bell
  const unreadCount = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    .then((r) => r.length)

  // 1. Collect all (module, widget) pairs from enabled modules
  const allModules = await db.select().from(modules).where(eq(modules.enabled, true))

  const allRefs: Array<Omit<ResolvedWidget, "data">> = []
  for (const mod of allModules) {
    const parsed = parseManifest(mod.manifest_yaml)
    if (!parsed.success) continue
    if (!parsed.data.internal_api) continue // can't fetch widgets without internal_api
    for (const w of parsed.data.widgets) {
      allRefs.push({
        moduleId: mod.id,
        widgetId: w.id,
        moduleName: parsed.data.name,
        refreshSeconds: w.refresh_seconds,
        internalApi: parsed.data.internal_api,
        endpoint: w.endpoint,
      })
    }
  }

  // 2. Apply saved order
  const savedOrder = await getWidgetOrder(userId)
  const orderedRefs = applyOrder(allRefs, savedOrder)
  const currentOrder: WidgetRef[] = orderedRefs.map(({ moduleId, widgetId }) => ({
    moduleId,
    widgetId,
  }))

  // 3. Fetch all widget payloads in parallel — failures degrade to null
  const results = await Promise.allSettled(
    orderedRefs.map(({ moduleId, internalApi, endpoint, refreshSeconds }) =>
      fetchWidgetData(moduleId, internalApi, endpoint, refreshSeconds)
    )
  )

  const widgets: ResolvedWidget[] = orderedRefs.map((ref, i) => ({
    ...ref,
    data: results[i].status === "fulfilled" ? results[i].value : null,
  }))

  return (
    <div className="min-h-screen flex flex-col">
      <CommandPalette />
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <span className="font-semibold text-sm">Laziness Center</span>
        <nav className="flex items-center gap-5 text-sm text-neutral-400">
          <Link href="/launcher" className="hover:text-neutral-100 transition-colors">
            Launcher
          </Link>
          <kbd className="hidden sm:inline text-xs text-neutral-700 border border-neutral-800 rounded px-1.5 py-0.5 font-sans">
            ⌘K
          </kbd>
          <Link href="/notifications" className="relative hover:text-neutral-100 transition-colors min-w-11 min-h-11 flex items-center justify-center" title="Notifications">
            <span aria-hidden>○</span>
            <span className="sr-only">Notifications</span>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-3.5 h-3.5 flex items-center justify-center
                               bg-blue-500 text-white text-[9px] font-bold rounded-full leading-none">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>
          {session.user?.role === "admin" && (
            <Link href="/admin/modules" className="hidden sm:inline hover:text-neutral-100 transition-colors">
              Admin
            </Link>
          )}
          <span className="hidden sm:inline text-neutral-600">|</span>
          <span className="hidden sm:inline truncate max-w-[120px]">{session.user?.name ?? session.user?.email}</span>
          <form
            action={async () => {
              "use server"
              await signOut({ redirectTo: "/login" })
            }}
          >
            <button type="submit" className="hover:text-neutral-100 transition-colors min-h-11 px-1">
              Sign out
            </button>
          </form>
        </nav>
      </header>

      {/* Main */}
      <main className="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold">Dashboard</h1>
          {widgets.length > 0 && (
            <span className="text-xs text-neutral-600">{widgets.length} widget{widgets.length !== 1 ? "s" : ""}</span>
          )}
        </div>

        {widgets.length === 0 ? (
          <EmptyDashboard isAdmin={session.user?.role === "admin"} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {widgets.map((w, i) => (
              <WidgetCard
                key={`${w.moduleId}:${w.widgetId}`}
                widget={w}
                index={i}
                total={widgets.length}
                userId={userId}
                currentOrder={currentOrder}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

// ── Components ────────────────────────────────────────────────────────────────

function EmptyDashboard({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="text-center py-16 text-sm text-neutral-500">
      <p>No widgets yet.</p>
      {isAdmin && (
        <p className="mt-2">
          Register modules with <code className="text-neutral-400">widgets:</code> declared in
          their manifest to see them here.{" "}
          <Link href="/admin/modules/new" className="text-neutral-300 underline hover:text-white">
            Add a module
          </Link>
          .
        </p>
      )}
      {isAdmin && (
        <details className="mt-6 text-left max-w-lg mx-auto">
          <summary className="cursor-pointer text-neutral-600 hover:text-neutral-400 transition-colors text-xs">
            Demo module manifests (paste into Add module to try widgets)
          </summary>
          <pre className="mt-3 text-xs bg-neutral-900 border border-neutral-800 rounded-lg p-4 overflow-x-auto text-neutral-300 whitespace-pre">{DEMO_MANIFESTS}</pre>
        </details>
      )}
    </div>
  )
}

const DEMO_MANIFESTS = `# --- Module 1: paste this, click Register ---
id: demo-status
name: Center Status
type: proxy_subpath
url: /api/demo/status
internal_api: http://localhost:3000
widgets:
  - id: status
    endpoint: /api/demo/status/widget
    refresh_seconds: 60

---
# --- Module 2: paste this separately ---
id: demo-note
name: Getting Started
type: proxy_subpath
url: /api/demo/note
internal_api: http://localhost:3000
widgets:
  - id: note
    endpoint: /api/demo/note/widget
    refresh_seconds: 3600`

function WidgetCard({
  widget,
  index,
  total,
  userId,
  currentOrder,
}: {
  widget: ResolvedWidget
  index: number
  total: number
  userId: string
  currentOrder: WidgetRef[]
}) {
  const { moduleId, widgetId, moduleName, data } = widget

  return (
    <div className="group relative flex flex-col rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden">
      {/* Reorder controls — visible on hover, top-right corner */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {index > 0 && (
          <form
            action={moveWidget.bind(null, userId, moduleId, widgetId, "up", currentOrder)}
          >
            <button
              type="submit"
              title="Move up"
              className="w-6 h-6 flex items-center justify-center rounded text-neutral-600 hover:text-neutral-100 hover:bg-neutral-700 transition-colors text-xs"
            >
              ↑
            </button>
          </form>
        )}
        {index < total - 1 && (
          <form
            action={moveWidget.bind(null, userId, moduleId, widgetId, "down", currentOrder)}
          >
            <button
              type="submit"
              title="Move down"
              className="w-6 h-6 flex items-center justify-center rounded text-neutral-600 hover:text-neutral-100 hover:bg-neutral-700 transition-colors text-xs"
            >
              ↓
            </button>
          </form>
        )}
      </div>

      {/* Widget body */}
      {data ? (
        <WidgetBody data={data} />
      ) : (
        <UnavailableBody title={moduleName} />
      )}
    </div>
  )
}

function WidgetBody({ data }: { data: WidgetPayload }) {
  const inner = (
    <div className="p-4 flex flex-col gap-1 flex-1">
      <div className="text-xs text-neutral-500 uppercase tracking-wide">{data.title}</div>
      <div className="text-2xl font-semibold text-neutral-100 leading-tight mt-1">
        {data.primary}
      </div>
      {data.secondary && (
        <div className="text-sm text-neutral-400">{data.secondary}</div>
      )}
      {data.sparkline && data.sparkline.length > 0 && (
        <SparkLine values={data.sparkline} />
      )}
    </div>
  )

  if (data.link) {
    return (
      <a href={data.link} className="flex-1 hover:bg-neutral-800 transition-colors">
        {inner}
      </a>
    )
  }

  return <div className="flex-1">{inner}</div>
}

function UnavailableBody({ title }: { title: string }) {
  return (
    <div className="p-4 flex flex-col gap-1 opacity-50">
      <div className="text-xs text-neutral-500 uppercase tracking-wide">{title}</div>
      <div className="text-sm text-neutral-600 mt-1">Unavailable</div>
    </div>
  )
}

function SparkLine({ values }: { values: number[] }) {
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const h = 28
  const w = 80

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w
      const y = h - ((v - min) / range) * h
      return `${x},${y}`
    })
    .join(" ")

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      className="mt-2 text-neutral-500"
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
