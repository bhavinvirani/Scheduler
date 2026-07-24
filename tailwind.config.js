/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Cool industrial neutrals — color is reserved for meaning (see PLAN.md §6).
        ink: '#151A21',
        paper: '#FBFBF9',
        rule: '#D8DCE0',
        day: '#3C7A6B',
        evening: '#7A5AA8',
        night: '#26456E',
        absent: '#EDEFF1',
        // Reserved channel: coverage gaps and rule warnings ONLY. Never decoration.
        alert: '#C2410C',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: [
          '"IBM Plex Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'monospace',
        ],
      },
    },
  },
  plugins: [],
};
