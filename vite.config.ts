/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Bind to the 127.0.0.1 loopback IP (not "localhost") because the Spotify
// Redirect URI must match exactly and Spotify requires the loopback IP form.
// strictPort ensures the redirect URI (…:5173/callback) stays valid — Vite
// will error instead of silently picking another port.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
