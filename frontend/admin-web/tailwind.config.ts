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
    extend: {},
  },
  plugins: [],
};

export default config;
