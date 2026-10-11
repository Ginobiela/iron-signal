import { DEV_TOOLS } from '../config/devtools';
if (!DEV_TOOLS) location.replace('./');
else void import('./GameplayTuner').then(({ GameplayTuner }) => {
  const tuner = new GameplayTuner(document.querySelector('#tuner')!);
  window.addEventListener('pagehide', () => tuner.dispose(), { once: true });
  if (import.meta.hot) import.meta.hot.dispose(() => tuner.dispose());
});
