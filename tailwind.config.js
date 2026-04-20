/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './constants/**/*.{js,jsx,ts,tsx}',
    './hooks/**/*.{js,jsx,ts,tsx}',
    './store/**/*.{js,jsx,ts,tsx}',
    './services/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter_400Regular', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        'sans-md': ['Inter_500Medium', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        'sans-semibold': ['Inter_600SemiBold', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        'sans-bold': ['Inter_700Bold', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrainsMono_400Regular', 'ui-monospace', 'monospace'],
        'mono-md': ['JetBrainsMono_500Medium', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
