import { expect, it, vi } from 'vitest';
import { CollisionSystem } from '../src/collision/CollisionSystem';
import { CombatSystem } from '../src/collision/CombatSystem';
import { EnemyManager } from '../src/entities/enemies/EnemyManager';
import { GateHatch } from '../src/entities/enemies/GateHatch';
import { Player } from '../src/entities/Player';
import { ProjectileManager } from '../src/projectiles/ProjectileManager';
import { FortifiedGateBoss } from '../src/bosses/FortifiedGateBoss';
import { Boss } from '../src/bosses/Boss';
import { PursuitBoss } from '../src/bosses/PursuitBoss';
import type { GateLayout } from '../src/bosses/gateLayout';
import { DEFAULT_GAMEPLAY_CONFIG } from '../src/config/gameplay';
import { LevelEditorModel } from '../src/devtools/levelEditorModel';
import { exportLevel, parseLevel, validateLevel } from '../src/level/LevelDocument';
import level3 from '../public/levels/level-03.json';
import level2 from '../public/levels/level-02.json';

function setup() {
  const collision = new CollisionSystem(), player = new Player(30, 44), manager = new EnemyManager();
  const projectiles = new ProjectileManager(collision);
  const context = { collision, player, projectiles, solids: [{ x: 0, y: 0, width: 1400, height: 44 }], worldWidth: 1400 };
  return { manager, context, projectiles, player };
}

it('places independent mecha/turret/hatch enemies in spawn groups and round trips their data', () => {
  const data = parseLevel(level3);
  data.spawnGroups[0]!.enemies.push(...(['mecha', 'gateTurret', 'gateHatch'] as const)
    .map((kind, i) => ({ id: `mini-${i}`, kind, x: 100 + i * 100, y: 44, facing: -1 as const })));
  expect(validateLevel(data).errors).toEqual([]);
  expect(parseLevel(JSON.parse(exportLevel(data)))).toEqual(data);
  const { manager } = setup();
  for (const placement of data.spawnGroups[0]!.enemies.slice(-3)) {
    const enemy = manager.spawn(placement);
    expect(enemy.kind).toBe(placement.kind); expect(enemy.alive && enemy.active).toBe(true);
  }
});

it('mecha missiles use the shared weapon tuning, chase in either direction, and never complete the final boss', () => {
  const { manager, context, projectiles } = setup();
  const mecha = manager.spawn({ kind: 'mecha', x: 300, y: 44 });
  const finalBoss = new Boss({ x: 1200, y: 44, arenaLeft: 1000 });
  const killed = vi.fn(), combat = new CombatSystem(context.collision, context.player, manager.items, killed, finalBoss);
  for (let i = 0; i < 150; i++) mecha.update(1 / 60, context);
  expect(mecha.position.x).toBeLessThan(300);
  let missile = projectiles.items.find(p => p.active)!;
  expect(missile.style).toBe('missile'); expect(missile.velocity.x).toBe(-DEFAULT_GAMEPLAY_CONFIG.mecha.missileSpeed);
  expect(missile.damage).toBe(DEFAULT_GAMEPLAY_CONFIG.mecha.missileDamage);
  mecha.reset(); mecha.active = true; context.player.position.x = 900; projectiles.clear();
  for (let i = 0; i < 150; i++) mecha.update(1 / 60, context);
  missile = projectiles.items.find(p => p.active)!;
  expect(mecha.position.x).toBeGreaterThan(300); expect(missile.velocity.x).toBe(DEFAULT_GAMEPLAY_CONFIG.mecha.missileSpeed);
  projectiles.clear(); projectiles.spawn(mecha.position.x - 20, mecha.position.y + 30, 1000, 0, mecha.health, 'player');
  projectiles.update(.1, [], 1400, combat);
  expect(mecha.alive).toBe(false); expect(killed).toHaveBeenCalledExactlyOnceWith(mecha);
  expect(finalBoss.state).toBe('DORMANT'); expect(finalBoss.alive).toBe(true);
});

it('standalone Gate turret uses the existing projectile, damage and cooldown without requiring a gate', () => {
  const { manager, context, projectiles } = setup();
  const turret = manager.spawn({ kind: 'gateTurret', x: 300, y: 44 });
  for (let i = 0; i < 60; i++) turret.update(1 / 60, context);
  expect(turret.health).toBe(DEFAULT_GAMEPLAY_CONFIG.gate.turretHealth);
  expect(projectiles.activeCount).toBe(1);
  expect(projectiles.items.find(p => p.active)?.visualId).toBe('projectile.enemy.bossGateTurret');
  turret.takeDamage(turret.health); turret.update(10, context);
  expect(projectiles.activeCount).toBe(1);
});

it('hatches obey their own dog limit, stop when destroyed and clean up owned dogs on reset', () => {
  const { manager, context } = setup();
  const hatch = manager.spawn({ kind: 'gateHatch', x: 200, y: 44 }) as GateHatch;
  const other = manager.spawn({ kind: 'gateHatch', x: 500, y: 44 }) as GateHatch;
  for (let i = 0; i < 3600; i++) { hatch.update(1 / 60, context); other.update(1 / 60, context); }
  const dogs = manager.items.filter(e => e.kind === 'robotDog');
  expect(dogs.filter(d => d.spawnOwner === hatch)).toHaveLength(DEFAULT_GAMEPLAY_CONFIG.gate.maxActiveDogs);
  expect(dogs.filter(d => d.spawnOwner === other)).toHaveLength(DEFAULT_GAMEPLAY_CONFIG.gate.maxActiveDogs);
  hatch.takeDamage(hatch.health); const count = manager.items.length;
  hatch.update(100, context); expect(manager.items).toHaveLength(count);
  hatch.reset();
  expect(dogs.filter(d => d.spawnOwner === hatch).every(d => !d.alive)).toBe(true);
  expect(dogs.filter(d => d.spawnOwner === other).every(d => d.alive)).toBe(true);
  hatch.active = true;
  for (let i = 0; i < 60; i++) hatch.update(1 / 60, context);
  expect(manager.items).toHaveLength(count); // Dead dog slot reused, ownership updated.
  expect(dogs.some(d => d.spawnOwner === hatch && d.alive)).toBe(true);
});

it('Gate offsets position real damage targets/hatches, with validation and legacy defaults', () => {
  const data = parseLevel(level3), layout: GateLayout = {
    turrets: [{ x: -60, y: 8 }, { x: 36, y: 80 }], hatches: [{ x: -100, y: 4 }, { x: 48, y: 4 }],
  };
  data.boss.gateLayout = structuredClone(layout);
  expect(parseLevel(JSON.parse(exportLevel(data))).boss.gateLayout).toEqual(layout);
  const boss = new FortifiedGateBoss(data.boss);
  expect(boss.turrets.map(t => t.position)).toEqual(layout.turrets.map(p => ({ x: data.boss.x + p.x, y: data.boss.y + p.y })));
  expect(boss.hatches.map(({ x, y }) => ({ x, y }))).toEqual(layout.hatches.map(p => ({ x: data.boss.x + p.x, y: data.boss.y + p.y })));
  boss.reset(); expect(boss.turrets[0]!.position.x).toBe(data.boss.x - 60);
  for (const invalid of [NaN, Infinity, 3000]) {
    data.boss.gateLayout!.turrets[0].x = invalid;
    expect(validateLevel(data).errors.length).toBeGreaterThan(0);
  }
  delete data.boss.gateLayout;
  expect(validateLevel(data).errors).toEqual([]);
});

it('editor moves components independently and undoes optional layout creation exactly', () => {
  const data = parseLevel(level3); delete data.boss.gateLayout;
  const model = new LevelEditorModel(data), original = structuredClone(model.data);
  const turret = model.objects().find(o => o.type === 'bossPart' && o.value.part === 'turrets')!;
  model.selection = new Set([turret.id]); model.move(-8, 12);
  expect(model.data.boss.gateLayout!.turrets[0]).toEqual({ x: -88, y: 24 });
  expect(model.data.boss.x).toBe(original.boss.x);
  model.undo(); expect(model.data).toEqual(original);
  model.redo(); expect(model.data.boss.gateLayout!.turrets[0].y).toBe(24);
  const before = structuredClone(model.data.boss), spawn = model.objects().find(o => o.type === 'bossSpawn')!;
  model.selection = new Set([spawn.id]); model.move(12, 16);
  expect(model.data.boss.x).toBe(before.x + 12); expect(model.data.boss.y).toBe(before.y + 16);
  expect(model.data.boss.arena).toEqual(before.arena); expect(model.data.boss.trigger).toEqual(before.trigger);
  expect(model.data.boss.gateLayout).toEqual(before.gateLayout);
  model.undo(); expect(model.data.boss).toEqual(before);
});

it('the Level 2 spawn marker controls the real mecha spawn/reset without moving pursuit bounds', () => {
  const model = new LevelEditorModel(parseLevel(level2)), before = structuredClone(model.data.boss);
  const spawn = model.objects().find(o => o.type === 'bossSpawn')!;
  model.selection = new Set([spawn.id]); model.move(24, 8);
  expect(model.data.boss.encounter).toEqual(before.encounter);
  expect(model.data.boss.arenaLeft).toBe(before.arenaLeft);
  const boss = new PursuitBoss(parseLevel(JSON.parse(exportLevel(model.data))).boss);
  expect(boss.position).toEqual({ x: before.x + 24, y: before.y + 8 });
  boss.position.x -= 100; boss.position.y += 20; boss.reset();
  expect(boss.position).toEqual({ x: before.x + 24, y: before.y + 8 });
  model.undo(); expect(model.data.boss).toEqual(before);
});
