import yaml from "js-yaml"
import { ManifestSchema, type Manifest } from "./manifest-schema"

type ParseResult =
  | { success: true; data: Manifest }
  | { success: false; error: string }

export function parseManifest(yamlStr: string): ParseResult {
  let raw: unknown
  try {
    raw = yaml.load(yamlStr)
  } catch (e) {
    return { success: false, error: `YAML parse error: ${String(e)}` }
  }

  const result = ManifestSchema.safeParse(raw)
  if (!result.success) {
    const message = result.error.issues
      .map((i) => `${i.path.join(".") || "root"}: ${i.message}`)
      .join("; ")
    return { success: false, error: message }
  }

  return { success: true, data: result.data }
}
