import { VIEW } from './constants';

/** Render pixels per world unit. Never applied to gameplay coordinates or legacy sources. */
export const ART_SCALE: 1 | 2 = 2;
export const RENDER_VIEW = { width: VIEW.width * ART_SCALE, height: VIEW.height * ART_SCALE } as const;
