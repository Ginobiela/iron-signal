import { VIEW } from '../config/constants';

export function getDisplaySize(width: number, height: number): { width: number; height: number } {
  const fit = Math.min(width / VIEW.width, height / VIEW.height);
  const scale = fit >= 1 ? Math.floor(fit) : Math.max(0, fit);
  return { width: VIEW.width * scale, height: VIEW.height * scale };
}
