import './level-editor.css';
import { LevelEditor } from './LevelEditor';
import { DEV_TOOLS } from '../config/devtools';
if (!DEV_TOOLS) location.replace('./');
else {
  const editor = new LevelEditor();
  void editor.start().catch(error => { document.querySelector('#validation')!.textContent = String(error); });
  window.addEventListener('pagehide', () => editor.dispose(), { once: true });
  if (import.meta.hot) import.meta.hot.dispose(() => editor.dispose());
}
