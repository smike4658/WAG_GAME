import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5500,
    open: true,
  },
  build: {
    target: 'esnext',
    sourcemap: true,
  },
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d-compat'],
  },
  assetsInclude: ['**/*.glb', '**/*.gltf'],
});
