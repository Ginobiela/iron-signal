import { RENDER_VIEW } from '../config/art';

export function getDisplaySize(width: number, height: number): { width: number; height: number } {
  const fit = Math.min(width / RENDER_VIEW.width, height / RENDER_VIEW.height);
  const scale = fit >= 1 ? Math.floor(fit) : Math.max(0, fit);
  return { width: RENDER_VIEW.width * scale, height: RENDER_VIEW.height * scale };
}
