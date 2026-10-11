import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const tools = mode === 'development' || mode === 'development-tools';
  return { base: './', define: { 'import.meta.env.DEV_TOOLS': JSON.stringify(tools) }, build: { rolldownOptions: {
    input: { game: 'index.html', ...(tools ? { viewer: 'animation-viewer.html', editor: 'level-editor.html', tuner: 'gameplay-tuner.html' } : {}) },
  } } };
});
