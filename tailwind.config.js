/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./main.js" // Важно добавить main.js, так как там есть классы в шаблонных строках
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#EE4950', // Фирменный красный
        secondary: '#F3777D',
        background: '#171717', // Основной фон (очень темный серый/черный)
        surface: '#121212', // Для плеера и сайдбаров
        card: '#1E1E1E', // Карточки
        'text-muted': '#AFB6B2', // Основной текст (серый)
        'text-dark': '#49504D', // Более темный текст
        'gray-divider': '#2A2A2A', // Более тонкий разделитель
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      fontSize: {
        'xxs': '0.65rem',
      },
      boxShadow: {
        'glow': '0 4px 20px rgba(238, 73, 80, 0.4)', // Усиленное свечение для активных элементов
        'card': '0 10px 30px rgba(0,0,0,0.3)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      }
    },
  },
  plugins: [],
}
