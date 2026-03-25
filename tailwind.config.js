/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Fredoka One"', 'cursive'],
        body: ['Nunito', 'sans-serif'],
      },
      colors: {
        primary: '#FF6B6B',
        secondary: '#4ECDC4',
        accent: '#FFE66D',
        purple: '#A29BFE',
        mint: '#55EFC4',
        'bg-dark': '#0F0E17',
        'bg-card': '#1A1A2E',
        'bg-mid': '#16213E',
      },
      animation: {
        'bounce-slow': 'bounce 2s infinite',
        'wiggle': 'wiggle 0.5s ease-in-out infinite',
        'pulse-fast': 'pulse 0.5s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg) scale(1.02)' },
          '50%': { transform: 'rotate(3deg) scale(0.98)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
}
