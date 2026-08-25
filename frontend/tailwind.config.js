/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Daraz-style orange brand
        brand: {
          50: '#fff5ee',
          100: '#ffe6d8',
          200: '#ffc9a8',
          300: '#ffa670',
          400: '#ff7a38',
          500: '#f85606',
          600: '#e14a00',
          700: '#c43d00',
          800: '#9c3300',
          900: '#7a2800',
        },
        gold: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#ffd9ab',
          300: '#ffbf7a',
          400: '#ff9f4d',
          500: '#ff8a1e',
          600: '#e06f0a',
          700: '#b85a08',
        },
        cream: '#f5f5f5',
        ink: '#1a1a1a',
      },
      fontFamily: {
        sans: ['Inter', 'Tajawal', 'Segoe UI', 'system-ui', 'sans-serif'],
        display: ['Inter', 'Tajawal', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,.06), 0 1px 3px rgba(0,0,0,.08)',
        lift: '0 4px 12px rgba(0,0,0,.10), 0 2px 4px rgba(0,0,0,.06)',
        glow: '0 0 0 3px rgba(248,86,6,.15)',
      },
      // Custom opacity steps used across the UI (color slash modifiers)
      opacity: {
        8: '0.08',
        15: '0.15',
        35: '0.35',
        45: '0.45',
        55: '0.55',
        65: '0.65',
        75: '0.75',
        85: '0.85',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      animation: {
        'fade-in': 'fadeIn .25s ease-out',
        'slide-up': 'slideUp .3s ease-out',
        'slide-in-left': 'slideInLeft .3s ease-out',
        'slide-in-right': 'slideInRight .3s ease-out',
        'pop-in': 'popIn .35s cubic-bezier(.16,1,.3,1)',
        shimmer: 'shimmer 1.6s linear infinite',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        slideInLeft: { from: { opacity: 0, transform: 'translateX(-24px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
        slideInRight: { from: { opacity: 0, transform: 'translateX(24px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
        popIn: { from: { opacity: 0, transform: 'scale(.94)' }, to: { opacity: 1, transform: 'scale(1)' } },
        shimmer: { from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-200% 0' } },
        pulseSoft: { '0%,100%': { opacity: 1 }, '50%': { opacity: .55 } },
      },
    },
  },
  plugins: [],
};
