import type { NextConfig } from 'next'

// The .NET app is the leading application: Next.js is built as a static export that .NET serves
// from wwwroot. That rules out server-only features (server actions, route handlers on request,
// rewrites, proxy); data comes from the .NET API via client-side fetches to /api.
const nextConfig: NextConfig = {
  output: 'export',
  // Emit /page/index.html instead of /page.html, so ASP.NET's default-files middleware can serve it.
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
}

export default nextConfig
