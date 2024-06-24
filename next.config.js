/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/sitemap.xml',
        destination: '/sitemap.xml',
        permanent: true,
      },
      {
        source: '/robots.txt',
        destination: '/robots.txt',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;

