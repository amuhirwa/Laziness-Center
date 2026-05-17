import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: "/pantry",
  transpilePackages: ["@lc/sdk"],
}

export default nextConfig
