"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { registerModule } from "../actions"

const PLACEHOLDER = `id: my-module
name: My Module
description: Short description
icon: box
type: proxy_subpath
url: /my-module
internal_api: http://my-module:8000/api
health_check: http://my-module:8000/health
# default_hidden:
#   - girlfriend@example.com`

export default function NewModulePage() {
  const router = useRouter()
  const [yaml, setYaml] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const result = await registerModule(yaml)
    setLoading(false)
    if ("error" in result) {
      setError(result.error)
    } else {
      router.push("/admin/modules")
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-semibold mb-6">Add module</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-neutral-400 mb-1.5">
            Manifest <span className="text-neutral-600">(YAML)</span>
          </label>
          <textarea
            value={yaml}
            onChange={(e) => setYaml(e.target.value)}
            rows={16}
            spellCheck={false}
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-3 text-sm font-mono text-neutral-100 placeholder-neutral-700 focus:outline-none focus:border-neutral-500 resize-y"
            placeholder={PLACEHOLDER}
          />
        </div>

        {error && (
          <p className="text-sm text-red-400 font-mono whitespace-pre-wrap">{error}</p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading || !yaml.trim()}
            className="px-4 py-2 bg-neutral-100 text-neutral-900 rounded-lg text-sm font-medium hover:bg-white transition-colors disabled:opacity-40"
          >
            {loading ? "Validating…" : "Register"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 text-sm text-neutral-500 hover:text-neutral-100 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
