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
      keyframes: {
        // Radix-style entrance/exit pra Dialog/Sheet/Popover
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'fade-out': { '0%': { opacity: '1' }, '100%': { opacity: '0' } },
        'zoom-in-95': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'zoom-out-95': {
          '0%': { opacity: '1', transform: 'scale(1)' },
          '100%': { opacity: '0', transform: 'scale(0.95)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'fade-out': 'fade-out 150ms ease-out',
        'dialog-in': 'fade-in 150ms ease-out, zoom-in-95 150ms ease-out',
        'dialog-out': 'fade-out 150ms ease-out, zoom-out-95 150ms ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
