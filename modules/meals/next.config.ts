import path from "path"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: "/meals",
  transpilePackages: ["@lc/sdk"],
  // Tell Next.js to trace files from the workspace root so hoisted node_modules
  // (e.g., next, react) are included in the standalone output.
  outputFileTracingRoot: path.join(__dirname, "../../"),
}

export default nextConfig
