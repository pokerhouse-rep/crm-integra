import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Arquivo de importação de até 1 MB + overhead do formulário.
    serverActions: { bodySizeLimit: '2mb' },
  },
};

export default nextConfig;
