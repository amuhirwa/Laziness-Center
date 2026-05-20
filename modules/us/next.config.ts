import path from "path"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: "/us",
  transpilePackages: ["@lc/sdk"],
  outputFileTracingRoot: path.join(__dirname, "../../"),
}

export default nextConfig
