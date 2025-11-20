import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';
const repoName = 'dane-county-war-room';

const nextConfig: NextConfig = {
  output: 'export',
  basePath: isProd ? `/${repoName}` : '',
  assetPrefix: isProd ? `/${repoName}/` : '',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

