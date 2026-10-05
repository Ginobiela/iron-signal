import { defineConfig } from 'vite';

export default defineConfig({ base: './', build: { rolldownOptions: {
  input: { game: 'index.html', viewer: 'animation-viewer.html' },
} } });
