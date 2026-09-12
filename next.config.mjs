/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    'git-bridge-strat.preview.emergentagent.com',
    'git-bridge-strat.cluster-1.preview.emergentcf.cloud',
  ],
  images: {
    unoptimized: true,
    remotePatterns: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? [{ protocol: 'https', hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname, pathname: '/storage/v1/object/public/marketing-hero-posters/**' }]
      : [],
  },
  async redirects() {
    return [{ source: '/explore', destination: '/program', permanent: true }]
  },
}

export default nextConfig
