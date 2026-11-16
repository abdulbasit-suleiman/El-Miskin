/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Keep Node-only packages out of the webpack bundle for server components/routes.
    serverComponentsExternalPackages: ["firebase-admin", "qrcode", "archiver"],
  },
};

export default nextConfig;
