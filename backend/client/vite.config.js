import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const page = (file) => fileURLToPath(new URL(file, import.meta.url));

export default defineConfig({
  plugins: [react()],
  // Relative URLs so the build works no matter which folder Hostinger serves it from.
  base: './',
  build: {
    // Build straight into backend/public - that's the folder Express serves and
    // the deploy zip (scripts/package.js) ships. Never edit public/ by hand.
    outDir: '../public',
    emptyOutDir: true,
    // Bundled JS/CSS go in public/static; images stay in public/assets.
    assetsDir: 'static',
    // Three real pages (not a single-page app) so the URLs stay /, /login.html
    // and /dashboard.html - the Microsoft sign-in redirect URI and the backend
    // tests both depend on those exact paths.
    rollupOptions: {
      input: {
        index: page('./index.html'),
        login: page('./login.html'),
        dashboard: page('./dashboard.html'),
      },
    },
  },
  server: {
    // `npm run dev` here serves the UI with hot reload; API calls are forwarded
    // to the Express backend (run `npm run dev` in backend/ at the same time).
    proxy: {
      '/api': 'http://localhost:4000',
      '/health': 'http://localhost:4000',
    },
  },
});
