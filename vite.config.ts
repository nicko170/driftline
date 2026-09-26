import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// BASE_PATH is set by the GitHub Pages workflow ("/driftline/"); locally defaults to "/".
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    outDir: 'dist',
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei'],
          fx: ['@react-three/postprocessing', 'postprocessing'],
          // @react-three/rapier is only reached from the lazy /play route —
          // let rollup split it naturally (manual chunking caused a cycle).
        },
      },
    },
  },
});
