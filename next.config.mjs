/** @type {import('next').NextConfig} */

// Security headers applied to every response. `Content-Security-Policy` is kept
// deliberately permissive for `script-src` because Next.js injects inline
// bootstrap scripts; tighten with a nonce middleware if stricter CSP is needed.
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // `@node-rs/argon2` is a native addon and must not be bundled by webpack.
  serverExternalPackages: ['@node-rs/argon2', 'ioredis', 'pino'],

  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', 'date-fns'],
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      // Object storage host is environment-driven; declared here so uploaded
      // assets can be served through next/image in every environment.
      ...(process.env.NEXT_PUBLIC_STORAGE_PUBLIC_URL
        ? [
            {
              protocol: new URL(process.env.NEXT_PUBLIC_STORAGE_PUBLIC_URL).protocol.replace(':', ''),
              hostname: new URL(process.env.NEXT_PUBLIC_STORAGE_PUBLIC_URL).hostname,
            },
          ]
        : []),
    ],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        // Never allow search engines to index authenticated surfaces.
        source: '/(dashboard|admin|teacher|support|test|practice|analytics)/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};

export default nextConfig;
