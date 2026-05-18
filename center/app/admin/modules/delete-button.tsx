"use client"

import { deleteModule } from "./actions"

export function DeleteButton({ moduleId, name }: { moduleId: string; name: string }) {
  return (
    <form
      action={async () => {
        if (!confirm(`Delete ${name}?`)) return
        await deleteModule(moduleId)
      }}
    >
      <button
        type="submit"
        className="px-3 py-2 min-h-11 text-neutral-500 hover:text-red-500 transition-colors text-xs"
      >
        Delete
      </button>
    </form>
  )
}
