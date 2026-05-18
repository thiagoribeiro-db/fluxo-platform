/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: '5mb' },
    // Libs Node-only (PDF/DOCX parsing) NÃO devem ser bundladas pelo webpack
    // — o bundler quebra com "Object.defineProperty called on non-object"
    // porque essas libs usam tricks de runtime que não sobrevivem ao tree-shaking.
    serverComponentsExternalPackages: ['unpdf', 'mammoth'],
  },
};

module.exports = nextConfig;
