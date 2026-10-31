import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// HTML e bundles estáticos; a API permanece no Worker existente, sem SSR pago.
export default defineConfig({
  integrations: [react()],
  output: 'static',
  vite: { server: { proxy: { '/api': `http://127.0.0.1:${process.env.LUME_API_PORT || '4173'}` } } },
});
