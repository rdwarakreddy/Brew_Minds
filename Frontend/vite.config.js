import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // The dev server always runs on 5173 -- this is the exact origin
    // every backend service's CORS_ORIGIN and Google OAuth "Authorized
    // JavaScript origin" is configured to trust. Changing this port
    // means updating those too.
    port: 5173,
    strictPort: true,
  },
});
