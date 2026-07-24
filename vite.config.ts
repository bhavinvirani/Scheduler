import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the built site works at any GitHub Pages path
  // (user.github.io/<repo>/) without hard-coding the repository name.
  // Safe here because the app is a single page with no client-side router.
  base: './',
  plugins: [react()],
  test: {
    // The reducer and lib/ are pure functions — no DOM needed, so the fast
    // Node environment is correct. Component tests are intentionally out of
    // scope for v1 (see PLAN.md §9).
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
