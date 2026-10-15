import { expect, it, vi } from 'vitest';
import { CombatSystem } from '../src/collision/CombatSystem';
import { CollisionSystem } from '../src/collision/CollisionSystem';
import { Player } from '../src/entities/Player';
import { Runner } from '../src/entities/enemies/Runner';
import { Soldier } from '../src/entities/enemies/Soldier';
import type { Enemy } from '../src/entities/enemies/Enemy';

function setup(enemies: Enemy[] = [new Runner(62, 44)]) {
  const player = new Player(62, 44), detonate = vi.fn(), killed = vi.fn();
  for (const enemy of enemies) enemy.active = true;
  const combat = new CombatSystem(new CollisionSystem(), player, enemies, killed,
    undefined, undefined, undefined, detonate);
  return { player, enemies, combat, detonate, killed };
}

it('detonates only the Runner responsible for lethal contact, exactly once and without kill score', () => {
  const { player, enemies, combat, detonate, killed } = setup([new Runner(62, 44), new Runner(62, 44)]);
  player.health = 1;
  combat.updateContacts(); combat.updateContacts();
  expect(player.alive).toBe(false);
  expect(enemies[0]!.alive).toBe(false); expect(enemies[0]!.active).toBe(false);
  expect(enemies[1]!.alive).toBe(true);
  expect(detonate).toHaveBeenCalledExactlyOnceWith(enemies[0]);
  expect(killed).not.toHaveBeenCalled(); expect(combat.kills).toBe(0); expect(combat.playerHits).toBe(1);
});

it('preserves nonlethal contact damage and invulnerability without detonating', () => {
  const { player, enemies, combat, detonate } = setup();
  player.health = enemies[0]!.contactDamage + 1;
  combat.updateContacts(); combat.updateContacts();
  expect(player.health).toBe(1); expect(combat.playerHits).toBe(1);
  expect(enemies[0]!.alive).toBe(true); expect(detonate).not.toHaveBeenCalled();
});

it('does not detonate a Runner when another enemy kills the Player', () => {
  const { player, enemies, combat, detonate } = setup([new Soldier(62, 44), new Runner(62, 44)]);
  player.health = 1; combat.updateContacts();
  expect(player.alive).toBe(false); expect(enemies.every(e => e.alive)).toBe(true);
  expect(detonate).not.toHaveBeenCalled();
});

it('can detonate again after the normal enemy and Player reset', () => {
  const { player, enemies, combat, detonate } = setup();
  player.health = 1; combat.updateContacts();
  player.reset(62, 44); enemies[0]!.reset(); enemies[0]!.active = true;
  player.health = 1; combat.updateContacts();
  expect(detonate).toHaveBeenCalledTimes(2);
});
