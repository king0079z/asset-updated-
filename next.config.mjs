/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    domains: ["assets.co.dev", "ykjxvhvxlrjhxnrjnpjc.supabase.co"],
    unoptimized: true,
  },
  // Disable SWC minification to reduce file operations during build
  swcMinify: false,
  // Exclude problematic API routes
  excludeDefaultMomentLocales: true,
  // Keep default CPU parallelism for reasonable compile times in dev/build
  // Disable source maps to reduce file operations
  productionBrowserSourceMaps: false,
  // Disable compression to reduce file operations
  compress: false,
  // Disable static optimization to reduce file operations
  staticPageGenerationTimeout: 60
};

export default nextConfig;