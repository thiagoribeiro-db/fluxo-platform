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

// Wrap com Sentry — só ativa o upload de source maps se SENTRY_AUTH_TOKEN
// estiver setado (Vercel prod). Sem isso, vira passthrough.
// Pra obter o token: Sentry → Settings → Account → API → Auth Tokens
// (precisa do escopo "project:releases").
const { withSentryConfig } = require('@sentry/nextjs');

module.exports = withSentryConfig(nextConfig, {
  // Org/project — preencha quando tiver conta Sentry. Sem isso, ainda
  // funciona, só não faz upload de source maps.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Silencia logs verbosos no build local
  silent: !process.env.CI,
  // Upload de source maps só se o token estiver setado
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Otimizações recomendadas pelo Sentry
  widenClientFileUpload: true,
  // Hides source maps from generated client bundles (mantém só no Sentry)
  hideSourceMaps: true,
  // Disable Sentry telemetry
  telemetry: false,
});
