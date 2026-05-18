import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'var(--border)',
        input: 'var(--border)',
        background: 'var(--bg)',
        foreground: 'var(--text-primary)',
        primary: { DEFAULT: '#4f46e5', foreground: '#ffffff' },
        secondary: { DEFAULT: 'var(--bg-secondary)', foreground: 'var(--text-secondary)' },
        muted: { DEFAULT: 'var(--bg-tertiary)', foreground: 'var(--text-muted)' },
        accent: { DEFAULT: 'var(--bg-hover)', foreground: 'var(--text-primary)' },
        popover: { DEFAULT: 'var(--bg)', foreground: 'var(--text-primary)' },
        ring: '#6366f1',
      },
      borderRadius: { md: '8px', lg: '12px', xl: '16px', '3xl': '24px' },
    },
  },
  plugins: [],
};

export default config;
