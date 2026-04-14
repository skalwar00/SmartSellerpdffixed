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
    '*.spock.repl.co',
    '*.sisko.repl.co',
    '*.kirk.repl.co',
    '*.repl.co',
  ].filter(Boolean),
  webpack(config, { dev }) {
    if (dev) {
      config.cache = false
    }
    return config
  },
}

export default nextConfig
