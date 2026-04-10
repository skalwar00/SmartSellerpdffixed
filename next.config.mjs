/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: [
    process.env.REPLIT_DEV_DOMAIN,
    '*.replit.dev',
    '*.pike.replit.dev',
    '*.kirk.repl.co',
    '*.repl.co',
  ].filter(Boolean),
}

export default nextConfig
