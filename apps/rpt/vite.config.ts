import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { flexApiDevProxy } from '../../scripts/vite-flex-api-proxy';

export default defineConfig({
  plugins: [react()],
  server: flexApiDevProxy(),
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
