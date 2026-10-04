import type { LevelData } from './Level';

// Same entities, bullets and collisions as the campaign; only placements differ.
export function gameplayLab(mode: 'high' | 'low'): LevelData {
  const high = mode === 'high';
  return {
    name: 'Laboratorio de hitboxes', width: 768, spawn: { x: 62, y: 44 }, exitX: 704,
    ground: [{ x: 0, y: 0, width: 220, height: 44 }, { x: 220, y: 0, width: 548, height: high ? 44 : 40 }],
    platforms: high ? [{ kind: 'solid', x: 240, y: 44, width: 20, height: 4 }] : [],
    spawnGroups: [{ x: 0, enemies: [
      { kind: 'turret', x: 240, y: high ? 48 : 40, firingMode: 'horizontal' },
      { kind: 'flying', x: 110, y: 92, weaponDrop: 'S' },
    ] }],
    checkpoints: [], boss: { x: 710, y: 44, arenaLeft: 512 },
    sections: [{ x: 0, name: high ? 'TIRO ALTO: S PARA ESQUIVAR' : 'TIRO BAJO: S NO PROTEGE' }],
  };
}
