/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    screens: {
      sm: '600px',
      md: '768px',
      lg: '1024px',
    },
    extend: {
      colors: {
        brand: {
          primary: '#7A1F4A',
          light: '#F0E4EA',
          dark: '#4A0F2B',
        },
        gold: {
          DEFAULT: '#C9A96E',
          light: '#F5EDDC',
        },
        surface: '#FFFFFF',
        success: '#2E7D5E',
        danger: '#C1443C',
        bg: '#FAF7F5',
        text: '#1C1517',
        'text-secondary': '#6B5C5F',
        muted: '#A6959A',
        border: '#E5D9DC',
      },
      fontFamily: {
        display: ['Playfair Display', 'Georgia', 'serif'],
        body: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      borderRadius: {
        sm: '8px',
        md: '14px',
        lg: '20px',
      },
      boxShadow: {
        sm: '0 2px 8px rgba(122,31,74,0.06)',
        md: '0 8px 24px rgba(122,31,74,0.08)',
        lg: '0 16px 40px rgba(122,31,74,0.1)',
      },
      maxWidth: {
        content: '1120px',
      },
    },
  },
  plugins: [],
}
