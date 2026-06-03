/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  // Meridian primarily uses page-level inline design tokens today.
  // Keep Tailwind preflight disabled to avoid global reset regressions
  // while Tailwind utilities are used selectively by newer components.
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {},
  },
  plugins: [],
}
