import { describe, expect, it } from 'vitest';
import { SIGNAL_WORKS } from '../src/level/signalWorks';
import { Level } from '../src/level/Level';
import { exportLevel, parseLevel, validateLevel } from '../src/level/LevelDocument';
import { EnemyManager } from '../src/entities/enemies/EnemyManager';
import { CollisionSystem, overlaps } from '../src/collision/CollisionSystem';
import { Player } from '../src/entities/Player';
import { PLAYER } from '../src/config/constants';

const idle = { left: false, right: false, up: false, down: false, shoot: false, jumpPressed: false };

describe('edited Level 1 integration', () => {
  it('preserves the authored start, pickups, carriers, lighting and campaign transition', () => {
    expect(validateLevel(SIGNAL_WORKS).errors).toEqual([]);
    expect(parseLevel(JSON.parse(exportLevel(SIGNAL_WORKS)))).toEqual(SIGNAL_WORKS);
    expect(SIGNAL_WORKS.spawn).toMatchObject({ x: 1296, y: 144 });
    expect(SIGNAL_WORKS.pickups).toHaveLength(19);
    const carriers = SIGNAL_WORKS.spawnGroups.flatMap(g => g.enemies).filter(e => e.kind === 'flying' && e.weaponDrop);
    expect(carriers).toHaveLength(7);
    expect(SIGNAL_WORKS.lighting!.ambient).toBe(.4);
    expect(SIGNAL_WORKS.nextLevel).toBe('levels/level-02.json');
    expect(SIGNAL_WORKS.completionDelay).toBe(3);
  });

  it('starts safely on the authored elevated platform and keeps enemies outside solid terrain', () => {
    const level = new Level(SIGNAL_WORKS), collision = new CollisionSystem(), manager = new EnemyManager();
    const player = new Player(SIGNAL_WORKS.spawn.x, SIGNAL_WORKS.spawn.y);
    for (let i = 0; i < 120; i++) player.update(1 / 60, idle, collision, level.solids, SIGNAL_WORKS.width, level.oneWays);
    expect(player.alive && player.grounded && player.onOneWay).toBe(true);
    expect(player.position.y).toBe(118);
    for (const group of SIGNAL_WORKS.spawnGroups) for (const placement of group.enemies) {
      const enemy = manager.spawn(placement);
      if (enemy.kind !== 'flying') expect(level.solids.some(s => overlaps(s, {
        x: enemy.position.x, y: enemy.position.y, width: enemy.width, height: enemy.height,
      })), `Enemy ${'id' in placement ? placement.id : enemy.kind} inside a solid`).toBe(false);
    }
  });

  it('can traverse the edited platforms and large pit to the exit using the real jump physics', () => {
    const level = new Level(SIGNAL_WORKS), collision = new CollisionSystem();
    const player = new Player(SIGNAL_WORKS.spawn.x, SIGNAL_WORKS.spawn.y);
    const surfaces = [...level.solids, ...level.oneWays];
    // Semi-implicit 60Hz integration reaches less than the continuous theoretical apex.
    const jumpSteps = Math.ceil(PLAYER.jumpSpeed / (PLAYER.gravity / 60)) - 1;
    const jumpHeight = jumpSteps * PLAYER.jumpSpeed / 60 - PLAYER.gravity / 3600 * jumpSteps * (jumpSteps + 1) / 2;
    for (let i = 0; i < 16000 && player.position.x < SIGNAL_WORKS.width - player.width; i++) {
      const supports = surfaces.filter(s => Math.abs(s.y + s.height - player.position.y) < .001
        && player.position.x < s.x + s.width && player.position.x + player.width > s.x);
      // Take off near the actual trailing support edge; the new bridge has longer gaps.
      const edge = supports.length > 0 && Math.max(...supports.map(s => s.x + s.width)) - player.position.x < 5;
      const wall = level.solids.some(s => s.x >= player.position.x + player.width && s.x - player.position.x - player.width < 12
        && s.y + s.height > player.position.y && s.y < player.position.y + player.height);
      const higher = level.oneWays.some(s => s.y + s.height > player.position.y + .001
        && s.y + s.height - player.position.y <= jumpHeight && player.position.x < s.x + s.width && player.position.x + player.width > s.x);
      player.update(1 / 60, { ...idle, right: true, jumpPressed: player.grounded && (edge || wall || higher || player.velocity.x === 0) },
        collision, level.solids, SIGNAL_WORKS.width, level.oneWays);
      expect(player.alive, `Player fell at X=${player.position.x}`).toBe(true);
    }
    expect(player.position.x).toBe(SIGNAL_WORKS.width - player.width);
    expect(player.jumpCount).toBeGreaterThan(0);
    expect(level.reachedExit(player)).toBe(true);
  });
});
