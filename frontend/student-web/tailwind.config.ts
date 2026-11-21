import type { Config } from 'tailwindcss';
import { codeathonTailwindPreset } from '@codeathon/ui-tokens/preset';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  presets: [codeathonTailwindPreset as any],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#6366F1',
          500: '#3760F8',
          DEFAULT: '#3760F8',
          600: '#254EDB',
          700: '#1D40B8',
          800: '#173394',
          900: '#0F1E5C',
        },
        secondary: {
          50: '#F7FEE7',
          100: '#ECFCCB',
          200: '#E9FEA2',
          DEFAULT: '#D3FE4F',
          hover: '#C2F038',
          dark: '#A4D817',
          800: '#4D7C0F',
          900: '#365314',
        },
        brand: {
          blue: '#3760F8',
          lime: '#D3FE4F',
          dark: '#0B0F19',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
        heading: ['Poppins', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
