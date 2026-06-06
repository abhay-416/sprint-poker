/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#001C4A',
        surface: '#08295B',
        card: '#0B2A5B',
        accent: '#11D8FF',
        border: '#1F4577',
        secondaryText: '#9FB7D9',
      },
      borderRadius: {
        'large': '20px',
        'button': '12px',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
