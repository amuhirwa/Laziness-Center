import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: "/meals",
  transpilePackages: ["@lc/sdk"],
}

export default nextConfig
