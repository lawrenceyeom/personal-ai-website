/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // client-side configuration
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        fs: false,
        http: false,
        https: false,
        stream: false,
        crypto: false,
        os: false,
        path: false,
        zlib: false,
        util: false,
        url: false,
        dns: false,
        events: false
      };
    }
    return config;
  },
};

module.exports = nextConfig; 