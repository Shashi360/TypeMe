import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // LAN multi-device testing: listen on all interfaces (0.0.0.0) so
      // phones/tablets can open the dev server via the PC's LAN IP.
      // No IP is hardcoded here — the machine's current LAN address is
      // resolved at runtime and Vite prints it as the "Network" URL.
      host: true,
      port: 5173,
      // If 5173 is busy, take the next free port instead of failing.
      strictPort: false,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      // NOTE: hmr.host is intentionally NOT set. Vite's client then connects
      // back to whichever host served the page, so HMR works on localhost
      // AND on LAN clients (phone/tablet via LAN IP). Hardcoding it to
      // localhost here would break HMR on every non-localhost device.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
