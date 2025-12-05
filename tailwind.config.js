/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./index.tsx",
    "./App.tsx",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./views/**/*.{js,ts,jsx,tsx}",
    "./hooks/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
    "./store/**/*.{js,ts,jsx,tsx}",
    "./types/**/*.{js,ts,jsx,tsx}",
    "./constants/**/*.{js,ts,jsx,tsx}",
    "./constants.ts",
  ],
  theme: {
    extend: {
      colors: {
        ferty: {
          // Colores principales (ya existentes)
          rose: '#C7958E',
          coral: '#95706B',
          beige: '#F4F0ED',
          gray: '#5D7180',
          white: '#ffffff',
          dark: '#4A4A4A',
          
          // Variantes de beige
          beigeLight: '#F9F6F4',
          beigeBorder: '#E1D7D3',
          beigeMuted: '#BBA49E',
          beigeDisabled: '#E8E0DC',
          
          // Estados hover
          roseHover: '#B5847D',
          roseHoverAlt: '#B8857E', // Variante alternativa encontrada en Tracker
          grayHover: '#4A5568',
          grayDisabled: '#A0A0A0',
          
          // Colores de pilares
          function: {
            light: '#E8B4B8',
            dark: '#D4A5A9',
            accent: '#C7958E' // Mismo que rose
          },
          food: {
            light: '#A8C8E0',
            dark: '#8BB0D1',
            accent: '#B67977'
          },
          flora: {
            light: '#B8D4C8',
            dark: '#9ECCB4',
            accent: '#6F8A6E'
          },
          flow: {
            light: '#E5D4E8',
            dark: '#D8C4E0',
            accent: '#5B7A92'
          }
        }
      },
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
      },
      // Agregar utilidades para alturas fijas comunes
      height: {
        'chat': '600px',
      }
    },
  },
  plugins: [],
}