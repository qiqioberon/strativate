/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    '/api/orders/*/receipt': [
      './public/assets/brand/strativate-wordmark.png',
      './public/assets/brand/fonts/poppins-regular.ttf',
      './public/assets/brand/fonts/poppins-semibold.ttf',
    ],
  },
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
    return [
      { source: '/explore', destination: '/program', permanent: true },
      { source: '/tanya-jawab', destination: '/faq', permanent: true },
      { source: '/tentang-kami', destination: '/about-us', permanent: true },
      { source: '/produk-digital/:path*', destination: '/digital-products/:path*', permanent: true },
      { source: '/dashboard/produk-digital/:path*', destination: '/dashboard/digital-products/:path*', permanent: true },
    ]
  },
}

export default nextConfig
