import json from './level-01-baseline.json';
import { parseLevel } from '../../src/level/LevelDocument';

/** Frozen pre-editor map for legacy physics/migration/balance regressions. */
export const BASELINE_LEVEL_01 = parseLevel(json);
