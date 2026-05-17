import { db } from "@/db"
import { modules } from "@/db/schema"
import { parseManifest } from "@/lib/manifest"
import Link from "next/link"
import { deleteModule, pingModuleHealth, toggleModule } from "./actions"

export default async function AdminModulesPage() {
  const allModules = await db.select().from(modules).orderBy(modules.id)

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold">Modules</h1>
        <Link
          href="/admin/modules/new"
          className="text-sm px-4 py-1.5 bg-neutral-100 text-neutral-900 rounded-md font-medium hover:bg-white transition-colors"
        >
          + Add module
        </Link>
      </div>

      {allModules.length === 0 ? (
        <p className="text-sm text-neutral-500">No modules registered yet.</p>
      ) : (
        <ul className="space-y-2">
          {allModules.map((mod) => {
            const parsed = parseManifest(mod.manifest_yaml)
            const name = parsed.success ? parsed.data.name : mod.id
            const type = parsed.success ? parsed.data.type : "invalid"
            const hasHealth = parsed.success && !!parsed.data.health_check
            const manifest = parsed.success ? parsed.data : null

            return (
              <li
                key={mod.id}
                className="rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden"
              >
                {/* Summary row */}
                <div className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{name}</span>
                      <span className="text-xs text-neutral-500 font-mono shrink-0">{type}</span>
                      {!mod.enabled && (
                        <span className="text-xs text-yellow-600 shrink-0">disabled</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                      <span
                        className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
                          mod.last_health_status === "up"
                            ? "bg-green-500"
                            : mod.last_health_status === "down"
                              ? "bg-red-500"
                              : "bg-neutral-600"
                        }`}
                      />
                      {mod.last_health_status ?? "unchecked"}
                      {mod.last_health_check && (
                        <span>
                          ·{" "}
                          {new Date(mod.last_health_check).toLocaleTimeString([], {
                            timeStyle: "short",
                          })}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 text-xs text-neutral-500">
                    {hasHealth && (
                      <form action={pingModuleHealth.bind(null, mod.id)}>
                        <button
                          type="submit"
                          className="px-3 py-2 min-h-11 hover:text-neutral-100 transition-colors"
                        >
                          Ping
                        </button>
                      </form>
                    )}
                    <form action={toggleModule.bind(null, mod.id, !mod.enabled)}>
                      <button
                        type="submit"
                        className="px-3 py-2 min-h-11 hover:text-neutral-100 transition-colors"
                      >
                        {mod.enabled ? "Disable" : "Enable"}
                      </button>
                    </form>
                    <form action={deleteModule.bind(null, mod.id)}>
                      <button
                        type="submit"
                        className="px-3 py-2 min-h-11 hover:text-red-400 transition-colors"
                        onClick={(e) => {
                          if (!confirm(`Delete ${name}?`)) e.preventDefault()
                        }}
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </div>

                {/* Expanded detail: internal_api + events */}
                {manifest && (manifest.internal_api || manifest.events.publishes.length > 0 || manifest.events.subscribes.length > 0 || manifest.widgets.length > 0) && (
                  <details className="border-t border-neutral-800">
                    <summary className="px-4 py-2 text-xs text-neutral-600 hover:text-neutral-400 cursor-pointer transition-colors select-none">
                      Details
                    </summary>
                    <div className="px-4 pb-4 pt-1 space-y-2 text-xs text-neutral-500">
                      {manifest.internal_api && (
                        <div>
                          <span className="text-neutral-600">internal_api </span>
                          <code className="text-neutral-400 font-mono">{manifest.internal_api}</code>
                        </div>
                      )}
                      {manifest.widgets.length > 0 && (
                        <div>
                          <span className="text-neutral-600">widgets </span>
                          {manifest.widgets.map((w) => (
                            <span key={w.id} className="font-mono text-neutral-400 mr-2">
                              {w.id}
                            </span>
                          ))}
                        </div>
                      )}
                      {manifest.events.publishes.length > 0 && (
                        <div>
                          <span className="text-neutral-600">publishes </span>
                          <div className="mt-0.5 space-y-0.5 ml-2">
                            {manifest.events.publishes.map((e) => (
                              <div key={e.name} className="font-mono text-neutral-400">
                                {e.name}{" "}
                                <span className="text-neutral-600">({e.transport})</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {manifest.events.subscribes.length > 0 && (
                        <div>
                          <span className="text-neutral-600">subscribes </span>
                          <div className="mt-0.5 space-y-0.5 ml-2">
                            {manifest.events.subscribes.map((e) => (
                              <div key={e} className="font-mono text-neutral-400">
                                {e}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
