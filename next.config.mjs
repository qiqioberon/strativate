/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    'git-bridge-strat.preview.emergentagent.com',
    'git-bridge-strat.cluster-1.preview.emergentcf.cloud',
  ],
  images: {
    unoptimized: true,
  },
}

export default nextConfig
