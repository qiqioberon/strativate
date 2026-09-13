/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:3001',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'fixture-publishable-key',
  },
  images: { unoptimized: true },
}

export default nextConfig
