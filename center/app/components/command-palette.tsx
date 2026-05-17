"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"

type Module = {
  id: string
  name: string
  description?: string
  url: string
  type: "proxy_subpath" | "iframe" | "linked"
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [modules, setModules] = useState<Module[]>([])
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Load modules once — cached by the browser via Cache-Control
  useEffect(() => {
    fetch("/api/launcher/modules")
      .then((r) => r.json())
      .then((data: { modules: Module[] }) => setModules(data.modules))
      .catch(() => {})
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    setQuery("")
    setSelected(0)
  }, [])

  // Cmd/Ctrl+K toggles, Escape closes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((o) => {
          if (o) { close(); return false }
          return true
        })
      }
      if (e.key === "Escape") close()
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [close])

  // Focus input when opened
  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const filtered = modules.filter(
    (m) =>
      m.name.toLowerCase().includes(query.toLowerCase()) ||
      m.description?.toLowerCase().includes(query.toLowerCase())
  )

  // Keep selected index in bounds when filter changes
  useEffect(() => {
    setSelected((s) => Math.min(s, Math.max(0, filtered.length - 1)))
  }, [filtered.length])

  function navigate(m: Module) {
    close()
    if (m.type === "linked") {
      window.open(m.url, "_blank", "noopener noreferrer")
    } else {
      router.push(m.url)
    }
  }

  if (!open) return null

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[15vh] sm:pt-[20vh]"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={close}
    >
      {/* Panel */}
      <div
        className="w-full max-w-md bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelected(0) }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault()
              setSelected((s) => Math.min(s + 1, filtered.length - 1))
            }
            if (e.key === "ArrowUp") {
              e.preventDefault()
              setSelected((s) => Math.max(s - 1, 0))
            }
            if (e.key === "Enter" && filtered[selected]) {
              navigate(filtered[selected])
            }
          }}
          placeholder="Go to module…"
          className="w-full bg-transparent px-4 py-4 text-sm text-neutral-100
                     placeholder-neutral-600 border-b border-neutral-800 focus:outline-none"
        />

        {/* Results */}
        <ul className="max-h-60 overflow-y-auto py-1">
          {filtered.length === 0 && (
            <li className="px-4 py-3 text-sm text-neutral-600">
              {query ? "No modules match." : "No modules registered."}
            </li>
          )}
          {filtered.map((m, i) => (
            <li
              key={m.id}
              onClick={() => navigate(m)}
              className={`flex items-center justify-between gap-3 px-4 py-2.5 cursor-pointer
                          text-sm transition-colors select-none ${
                i === selected
                  ? "bg-neutral-800 text-neutral-100"
                  : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
              }`}
            >
              <div className="min-w-0">
                <div className="font-medium">{m.name}</div>
                {m.description && (
                  <div className="text-xs text-neutral-600 truncate">{m.description}</div>
                )}
              </div>
              <span className="text-xs text-neutral-700 shrink-0 font-mono">
                {m.type === "linked" ? "↗" : m.type}
              </span>
            </li>
          ))}
        </ul>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-neutral-800 text-xs text-neutral-700 flex gap-4">
          <span>↵ open</span>
          <span>↑↓ navigate</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  )
}
