/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "ctlbpkfbysccmxmlmbzk.supabase.co" },
      { protocol: "https", hostname: "ykjxvhvxlrjhxnrjnpjc.supabase.co" },
      { protocol: "https", hostname: "assets.co.dev" },
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
  swcMinify: false,
  excludeDefaultMomentLocales: true,
  productionBrowserSourceMaps: false,
  compress: false,
  staticPageGenerationTimeout: 60,

  // Allow Outlook to frame the add-in task pane pages
  async headers() {
    return [
      {
        // Outlook add-in pages must be frameable by Microsoft Office / Outlook origins
        source: '/outlook/:path*',
        headers: [
          // Remove the blanket X-Frame-Options DENY so Outlook can embed the pane
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          // Allow framing from any Microsoft/Office origin
          {
            key: 'Content-Security-Policy',
            value: [
              "frame-ancestors 'self' https://*.office.com https://*.outlook.com https://*.microsoft.com https://outlook.live.com https://outlook.office365.com https://outlook.office.com",
            ].join('; '),
          },
          // Enable SharedArrayBuffer if needed by Office.js
          { key: 'Cross-Origin-Opener-Policy', value: 'unsafe-none' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'unsafe-none' },
        ],
      },
      {
        // Manifest API: allow any origin to fetch it (needed for sideloading)
        source: '/api/outlook/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS' },
        ],
      },
    ];
  },
};

export default nextConfig;