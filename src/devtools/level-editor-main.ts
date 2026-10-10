import './level-editor.css';
import { LevelEditor } from './LevelEditor';
if (import.meta.env.MODE === 'release') location.replace('./');
else {
  const editor = new LevelEditor();
  void editor.start().catch(error => { document.querySelector('#validation')!.textContent = String(error); });
  window.addEventListener('pagehide', () => editor.dispose(), { once: true });
  if (import.meta.hot) import.meta.hot.dispose(() => editor.dispose());
}
