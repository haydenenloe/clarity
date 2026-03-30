import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        background: '#0a0a0a',
        surface: '#111111',
        border: '#1f1f1f',
        muted: '#888888',
        accent: '#6366f1',
        'accent-hover': '#818cf8',
      },
    },
  },
  plugins: [],
}
export default config
