import './viewer.css';
import { AnimationViewer } from './AnimationViewer';

async function start(): Promise<void> {
  let viewer: AnimationViewer | undefined;
  try {
    viewer = new AnimationViewer();
    window.addEventListener('pagehide', () => viewer?.dispose(), { once: true });
    if (import.meta.hot) import.meta.hot.dispose(() => viewer?.dispose());
    await viewer.start();
  } catch (error: unknown) {
    viewer?.dispose();
    const message = document.querySelector<HTMLElement>('#error');
    if (message) { message.hidden = false; message.textContent = `No se pudo abrir el visor: ${String(error)}`; }
  }
}
void start();
