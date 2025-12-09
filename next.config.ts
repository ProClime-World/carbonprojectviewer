import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Optimize for production performance
  compress: true,
  
  // Enable static optimization where possible
  output: 'standalone',
  
  // Optimize images if you add next/image later
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  
  // Headers for better caching
  async headers() {
    return [
      {
        source: '/data/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/api/mosaic-tiles/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
