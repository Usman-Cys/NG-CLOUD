/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'Inter', 'sans-serif'],
        mono: ['Orbitron', 'monospace'],
      },
      colors: {
        bg: { DEFAULT: '#020617', 900: '#030712', 800: '#050816' },
        glass: 'rgba(15, 23, 42, 0.65)',
      },
      boxShadow: {
        'glow-cyan': '0 0 30px rgba(34, 211, 238, 0.25)',
        'glow-violet': '0 0 30px rgba(139, 92, 246, 0.25)',
        'glow-emerald': '0 0 30px rgba(16, 185, 129, 0.25)',
      },
      backgroundImage: {
        'cyber-grid': "linear-gradient(rgba(148,163,184,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.06) 1px, transparent 1px)",
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 3s ease-in-out infinite',
        'shimmer': 'shimmer 2.5s linear infinite',
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
      },
      keyframes: {
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-12px)' } },
        pulseGlow: { '0%,100%': { opacity: '0.6', boxShadow: '0 0 20px rgba(34,211,238,0.4)' }, '50%': { opacity: '1', boxShadow: '0 0 40px rgba(34,211,238,0.8)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(20px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
}
