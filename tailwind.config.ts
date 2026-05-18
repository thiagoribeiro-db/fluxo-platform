import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Padrão Digitalbot/Blip
        blip: {
          purple: '#7857ff',
          'purple-dark': '#4a3d99',
          orange: '#ff6e1d',
        },
        // WhatsApp
        wpp: {
          'bg-bot': '#ffffff',
          'bg-user': '#dcf8c6',
          'bg-chat': '#e5ddd5',
          'text-time': '#8b949e',
          'text-time-user': '#4fad57',
          'menu-green': '#25d366',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['SF Mono', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
