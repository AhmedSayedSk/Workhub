import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  output: 'standalone',
  // Build runs on the 2-core production VPS shared with live apps: one build
  // worker keeps a core free so deploys never starve the running services.
  experimental: { cpus: 1 },
  async redirects() {
    // Image Generator was renamed to Content Studio — keep old links/bookmarks working.
    return [
      { source: '/image-generator', destination: '/content-studio', permanent: true },
      { source: '/image-generator/:path*', destination: '/content-studio/:path*', permanent: true },
    ]
  },
}

export default nextConfig
