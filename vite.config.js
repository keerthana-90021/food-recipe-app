import { defineConfig } from 'vite';
import { localKitchen } from './dev/vite-kitchen.js';

export default defineConfig({
  base: './',
  plugins: [localKitchen()],
  server: {
    fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.kitchen-dev/**'] }
  }
});

