/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          1000: '#050505',
          950: '#080808',
          900: '#0B0B0B',
          800: '#141414',
          700: '#1F1F1F',
          600: '#2A2A2A',
          400: '#5A5A5A',
          200: '#A8A8A8',
        },
        brand: {
          neon: '#00FFA3',
          red: '#FF4C4C',
          muted: '#8B94A3',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
