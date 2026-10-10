import { describe, expect, it } from 'vitest';
import legacy from './level-01-legacy.json';
import { SIGNAL_WORKS } from '../src/level/signalWorks';
import { Level } from '../src/level/Level';
import { convertLegacyLevel, createLevel, exportLevel, parseLevel, validateLevel } from '../src/level/LevelDocument';
import { LevelEditorModel } from '../src/devtools/levelEditorModel';
import { EnemySpawner } from '../src/level/EnemySpawner';
import { EnemyManager } from '../src/entities/enemies/EnemyManager';
import { CheckpointManager } from '../src/level/Checkpoint';
import { Player } from '../src/entities/Player';
import { Boss } from '../src/bosses/Boss';
import type { LevelData } from '../src/level/Level';

describe('versioned levels / Level 1 migration', () => {
  it('preserves every legacy gameplay value and generated decoration in canonical JSON', () => {
    expect(SIGNAL_WORKS).toEqual(convertLegacyLevel(legacy as LevelData));
    expect(validateLevel(SIGNAL_WORKS).errors).toEqual([]);
    expect(parseLevel(JSON.parse(exportLevel(SIGNAL_WORKS)))).toEqual(SIGNAL_WORKS);
    const oldLevel = new Level(legacy as LevelData), newLevel = new Level(SIGNAL_WORKS);
    const geometry = (items: readonly { x: number; y: number; width: number; height: number }[]) => items.map(({ x, y, width, height }) => ({ x, y, width, height }));
    expect(geometry(newLevel.solids)).toEqual(geometry(oldLevel.solids));
    expect(geometry(newLevel.oneWays)).toEqual(geometry(oldLevel.oneWays));
    expect(SIGNAL_WORKS.width).toBe(legacy.width); expect(SIGNAL_WORKS.spawn).toMatchObject(legacy.spawn);
    expect(SIGNAL_WORKS.boss).toMatchObject(legacy.boss); expect(SIGNAL_WORKS.exitX).toBe(legacy.exitX);
    for (let i = 0; i < legacy.checkpoints.length; i++) expect(SIGNAL_WORKS.checkpoints[i]).toMatchObject(legacy.checkpoints[i]!);
  });
  it('preserves spawn timing, drops, checkpoint respawn, boss activation and completion', () => {
    const placements: object[] = [], oldPlacements: object[] = [];
    const a = new EnemySpawner(SIGNAL_WORKS.spawnGroups, p => placements.push(p));
    const b = new EnemySpawner(legacy.spawnGroups as LevelData['spawnGroups'], p => oldPlacements.push(p));
    for (let x = 0; x < 9600; x += 10) {
      a.update(x); b.update(x); expect(a.triggeredCount).toBe(b.triggeredCount); expect(a.pendingEnemies).toBe(b.pendingEnemies);
    }
    expect(placements.map(p => { const { id: _id, ...rest } = p as Record<string, unknown>; return rest; })).toEqual(oldPlacements);
    const player = new Player(62, 44), cp = new CheckpointManager({ ...SIGNAL_WORKS.spawn, name: 'Inicio' }, SIGNAL_WORKS.checkpoints);
    player.grounded = true; player.position.x = 9344; cp.update(0, player); player.die(); player.respawn(cp.current.x, cp.current.y);
    expect(player.position).toEqual({ x: 9344, y: 44 });
    const boss = new Boss(SIGNAL_WORKS.boss); expect(boss.activate(9343)).toBe(false); expect(boss.activate(9344)).toBe(true);
    const level = new Level(SIGNAL_WORKS); player.grounded = true; player.position.x = SIGNAL_WORKS.exitX;
    expect(level.reachedExit(player)).toBe(true);
  });
  it('validates schema, required spawn, IDs, types, bounds and unsafe imports', () => {
    const invalid: unknown[] = [null, [], {}, { ...SIGNAL_WORKS, version: 2 }, { ...SIGNAL_WORKS, spawn: undefined },
      { ...SIGNAL_WORKS, ground: [{ id: 'bad', x: 0, y: 0, width: 0, height: 16 }] },
      { ...SIGNAL_WORKS, checkpoints: [{ id: 'player-spawn', x: 10, y: 44, name: 'duplicate' }] },
      { ...SIGNAL_WORKS, checkpoints: [{ id: 'cp', x: 10000, y: 44, name: 'outside' }] },
      { ...SIGNAL_WORKS, spawnGroups: [{ id: 'group', x: 0, enemies: [{ id: 'e', x: 20, y: 44, kind: 'unknown' }] }] },
      { ...SIGNAL_WORKS, spawnGroups: [{ id: 'group', x: 0, enemies: [{ id: 'e', x: 20, y: 44, kind: 'runner', weaponDrop: 'M' }] }] },
      { ...SIGNAL_WORKS, boss: { ...SIGNAL_WORKS.boss, arenaLeft: -1 } },
      { ...SIGNAL_WORKS, backgrounds: [{ asset: '__proto__', speed: 1, offsetX: 0, offsetY: 0 }] }];
    for (const input of invalid) expect(() => parseLevel(input)).toThrow();
    const fresh = createLevel('level-02', 'Test level', 2048);
    expect(validateLevel(fresh).errors).toEqual([]); expect(validateLevel(fresh).warnings.length).toBeGreaterThan(0);
    expect(() => exportLevel(fresh)).not.toThrow();
  });
  it('facing metadata is applied by the existing enemy factory', () => {
    const manager = new EnemyManager();
    expect(manager.spawn({ kind: 'soldier', x: 20, y: 44, facing: 1 }).direction).toBe(1);
    expect(manager.spawn({ kind: 'flying', x: 50, y: 90, weaponDrop: 'S' }).weaponDrop).toBe('S');
  });
});
describe('editor commands', () => {
  it('moves, edits, duplicates and deletes stable IDs, preserving 100 undo operations', () => {
    const model = new LevelEditorModel(SIGNAL_WORKS), ref = model.objects().find(o => o.type === 'enemy')!;
    model.selection.add(ref.id); const x = Number(ref.value.x);
    model.move(16, 0); model.undo(); expect(model.objects().find(o => o.id === ref.id)!.value.x).toBe(x);
    model.redo(); expect(model.objects().find(o => o.id === ref.id)!.value.x).toBe(x + 16);
    const before = model.objects().length; model.duplicate(); expect(model.objects()).toHaveLength(before + 1);
    const duplicateId = [...model.selection][0]!; expect(duplicateId).not.toBe(ref.id);
    model.deleteSelection(); expect(model.objects()).toHaveLength(before); model.undo(); expect(model.objects()).toHaveLength(before + 1);
    model.selection = new Set([ref.id]);
    for (let i = 0; i < 60; i++) model.move(1, 0);
    for (let i = 0; i < 60; i++) model.undo();
    expect(model.objects().find(o => o.id === ref.id)!.value.x).toBe(x + 16);
    expect(validateLevel(model.data).errors).toEqual([]);
  });
  it('reassigns group membership, duplicates triggers and removes their enemies atomically', () => {
    const model = new LevelEditorModel(SIGNAL_WORKS), ref = model.objects().find(o => o.type === 'enemy')!;
    const original = ref.group!, target = model.data.spawnGroups[1]!.id;
    model.reassignEnemy(ref, target); expect(model.objects().find(o => o.id === ref.id)!.group).toBe(target);
    model.undo(); expect(model.objects().find(o => o.id === ref.id)!.group).toBe(original);
    model.selection = new Set([original]); model.duplicate(); expect(validateLevel(model.data).errors).toEqual([]);
    const count = model.objects().length; model.deleteSelection(); expect(model.objects().length).toBeLessThan(count);
    model.undo(); expect(model.objects()).toHaveLength(count);
    const ids = model.objects().map(o => o.id); expect(new Set(ids).size).toBe(ids.length);
  });
  it('cuts pits using ground geometry only and restores them with undo', () => {
    const model = new LevelEditorModel(SIGNAL_WORKS), ground = structuredClone(model.data.ground), platforms = structuredClone(model.data.platforms);
    model.cutPit(96, 32); expect(model.data.ground.some(g => g.x < 128 && g.x + g.width > 96)).toBe(false);
    expect(model.data.platforms).toEqual(platforms); model.undo(); expect(model.data.ground).toEqual(ground);
  });
  it('rejects invalid load without losing current work; property changes round-trip', () => {
    const model = new LevelEditorModel(SIGNAL_WORKS), cp = model.objects().find(o => o.type === 'checkpoint')!;
    model.set(cp, 'name', 'Edited checkpoint'); expect(model.dirty).toBe(true);
    expect(() => model.load({ version: 500 })).toThrow(); expect(model.data.checkpoints[0]!.name).toBe('Edited checkpoint');
    model.undo(); expect(model.data.checkpoints[0]!.name).toBe(SIGNAL_WORKS.checkpoints[0]!.name);
    model.redo(); expect(parseLevel(JSON.parse(exportLevel(model.data))).checkpoints[0]!.name).toBe('Edited checkpoint');
  });
});
