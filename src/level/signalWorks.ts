import json from '../../public/levels/level-01.json';
import { parseLevel } from './LevelDocument';

/** Canonical Level 1 is data, shared by the game and editor. */
export const SIGNAL_WORKS = parseLevel(json);
