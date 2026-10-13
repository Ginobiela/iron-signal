/** Native fullscreen keeps game overlays and touch controls inside the same surface. */
export function attachFullscreen(root: HTMLElement, button: HTMLButtonElement): () => void {
  const toggle = async (): Promise<void> => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await root.requestFullscreen();
    } catch {
      button.title = 'El navegador no permitió pantalla completa. Probá con F11 o desde su menú.';
    } finally { button.blur(); }
  };
  const key = (event: KeyboardEvent): void => {
    if (event.code !== 'F11') return;
    if (!document.fullscreenEnabled) return; // Leave the browser's native F11 available.
    event.preventDefault();
    if (!event.repeat) void toggle();
  };
  const click = (): void => { void toggle(); };
  const changed = (): void => { button.setAttribute('aria-pressed', String(document.fullscreenElement === root)); };
  window.addEventListener('keydown', key);
  document.addEventListener('fullscreenchange', changed);
  button.addEventListener('click', click);
  return () => {
    window.removeEventListener('keydown', key);
    document.removeEventListener('fullscreenchange', changed);
    button.removeEventListener('click', click);
  };
}
