import type { Metadata } from 'next';
import './globals.css';
import Toast from '@/components/Toast';
import DialogHost from '@/components/DialogHost';
import PostHogBootstrap from '@/components/PostHogBootstrap';
import { ThemeProvider } from '@/components/ThemeProvider';
import QueryProvider from '@/components/QueryProvider';

export const metadata: Metadata = {
  title: 'Fluxo Platform',
  description: 'Editor visual de fluxos conversacionais (Blip/Digitalbot)',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      {/* Inline script — evita flash de tema errado antes do React hidratar.
          Lê localStorage + prefers-color-scheme E aplica classe dark IMEDIATO
          no <html>. Sem isso, dark mode users veem flash branco no load. */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('fluxo-theme');var d=s==='dark'||(s!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <QueryProvider>
            {children}
            <Toast />
            <DialogHost />
            <PostHogBootstrap />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
