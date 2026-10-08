import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const proxy = { '/api/local': { target: 'http://127.0.0.1:5174' } };
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  define: mode === 'local-dev' ? { 'import.meta.env.VITE_LOCAL_API': JSON.stringify('true') } : {},
  server: {
    proxy,
    // Some external SSD filesystems do not emit reliable file change events.
    watch: mode === 'local-dev' ? { usePolling: true, interval: 1000 } : undefined,
  },
  preview: { proxy },
}));
