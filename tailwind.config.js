/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ferty: {
          rose: '#C7958E',
          coral: '#95706B',
          beige: '#F4F0ED',
          gray: '#5D7180',
          white: '#ffffff',
          dark: '#4A4A4A'
        }
      },
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
      }
    },
  },
  plugins: [],
}