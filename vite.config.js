import { defineConfig } from 'vite';

export default defineConfig({
  base: './',              // works on GitHub Pages subpaths and file previews
  server: { port: 5173 },
  build: { outDir: 'dist', sourcemap: false },
});
