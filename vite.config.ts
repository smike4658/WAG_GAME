import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5500,
    open: true,
  },
  build: {
    target: 'esnext',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('node_modules/howler')) return 'audio';
          if (id.includes('node_modules/gsap')) return 'animation';
          if (id.includes('node_modules/@supabase')) return 'supabase';
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d-compat'],
  },
  assetsInclude: ['**/*.glb', '**/*.gltf'],
});
