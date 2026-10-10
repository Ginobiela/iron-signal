import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({ base: './', build: { rolldownOptions: {
  input: { game: 'index.html', viewer: 'animation-viewer.html', ...(mode === 'release' ? {} : { editor: 'level-editor.html' }) },
} } }));
