import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Fluxo Platform',
  description: 'Editor visual de fluxos conversacionais (Blip/Digitalbot)',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
