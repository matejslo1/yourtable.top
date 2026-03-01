import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Build as a single embeddable JS file
    lib: {
      entry: 'src/embed.tsx',
      name: 'YourTableWidget',
      fileName: 'widget',
      formats: ['iife'],
    },
    rollupOptions: {
      // Bundle everything (no external deps)
      external: [],
    },
    cssCodeSplit: false, // Inline CSS
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
});
