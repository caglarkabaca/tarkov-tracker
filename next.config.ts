import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone', // For Docker deployment
  transpilePackages: [
    'tamagui',
    '@tamagui/core',
    '@tamagui/config',
    '@tamagui/vite-plugin',
  ],
  serverExternalPackages: [
    'react-native',
    'react-native-svg',
  ],
  // Turbopack config (Next.js 16+)
  turbopack: {
    resolveAlias: {
      'react-native$': 'react-native-web',
    },
  },
};

export default nextConfig;
