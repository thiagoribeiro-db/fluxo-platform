/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: '5mb' },
    // Libs Node-only que NÃO devem ser bundladas pelo webpack server-side:
    //  - unpdf, mammoth: PDF/DOCX parsing — bundler quebra com
    //    "Object.defineProperty called on non-object" por tricks de runtime
    //    que não sobrevivem ao tree-shaking.
    //  - @anthropic-ai/sdk: SDK pesado usado SÓ em server actions
    //    (ai-chat, voice-tone, parse-with-ai). Bundlear ele inflava o chunk
    //    server-side e às vezes o dev hot-reload perdia o chunk
    //    `vendor-chunks/@anthropic-ai.js`, quebrando a página com
    //    "Cannot find module". External = resolve do node_modules direto,
    //    sem ir pro bundle do webpack.
    serverComponentsExternalPackages: ['unpdf', 'mammoth', '@anthropic-ai/sdk'],
    // Otimização de imports — converte `import { X } from 'lucide-react'`
    // em barrel optimization, importando só o ícone usado (não o pacote
    // inteiro de 1000+ icons). Ganho real no bundle inicial.
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-switch',
      '@radix-ui/react-tabs',
    ],
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
