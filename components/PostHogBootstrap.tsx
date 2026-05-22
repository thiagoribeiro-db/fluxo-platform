'use client';

/**
 * Bootstrap do PostHog — chama initPostHog() uma vez no mount.
 *
 * Use no `<RootLayout>`. Como o init é defensive (só roda se DSN setada
 * e NODE_ENV=production), em dev/sem-DSN vira no-op total.
 */
import { useEffect } from 'react';
import { initPostHog } from '@/lib/analytics/posthog';

export default function PostHogBootstrap() {
  useEffect(() => {
    initPostHog();
  }, []);
  return null;
}
