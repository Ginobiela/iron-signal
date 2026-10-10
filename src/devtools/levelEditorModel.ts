import { createLevel, parseLevel } from '../level/LevelDocument';
import type { LevelDocument } from '../level/LevelDocument';
export type ObjectType = 'solid' | 'platform' | 'enemy' | 'trigger' | 'checkpoint' | 'decoration' | 'spawn' | 'boss';
export interface EditorObject { id: string; type: ObjectType; path: string[]; value: Record<string, unknown>; group?: string }
export interface Patch { path: string[]; before: unknown; after: unknown }
export class LevelEditorModel {
  data: LevelDocument;
  selection = new Set<string>();
  private undoStack: Patch[][] = [];
  private redoStack: Patch[][] = [];
  dirty = false;
  constructor(data = createLevel('new-level', 'New level', 2048)) { this.data = structuredClone(data); }
  load(data: unknown): void { this.data = parseLevel(data); this.selection.clear(); this.undoStack = []; this.redoStack = []; this.dirty = false; }
  objects(): EditorObject[] {
    const refs: EditorObject[] = [];
    const add = (type: ObjectType, path: string[], value: object, group?: string) => {
      const item = value as Record<string, unknown>; refs.push({ id: String(item.id), type, path, value: item, group });
    };
    for (const [key, type] of [['ground', 'solid'], ['platforms', 'platform'], ['checkpoints', 'checkpoint'], ['decorations', 'decoration']] as const) {
      this.data[key].forEach((item, i) => add(type, [key, String(i)], item));
    }
    this.data.spawnGroups.forEach((group, i) => {
      add('trigger', ['spawnGroups', String(i)], group);
      group.enemies.forEach((enemy, j) => add('enemy', ['spawnGroups', String(i), 'enemies', String(j)], enemy, group.id));
    });
    add('spawn', ['spawn'], this.data.spawn); add('boss', ['boss'], this.data.boss);
    return refs;
  }
  private write(path: string[], value: unknown): void {
    let target = this.data as unknown as Record<string, unknown>;
    for (const key of path.slice(0, -1)) target = target[key] as Record<string, unknown>;
    target[path.at(-1)!] = structuredClone(value);
  }
  commit(patches: Patch[]): void {
    if (!patches.length) return;
    for (const p of patches) this.write(p.path, p.after);
    this.undoStack.push(patches); if (this.undoStack.length > 100) this.undoStack.shift();
    this.redoStack = []; this.dirty = true;
  }
  undo(): void { const command = this.undoStack.pop(); if (!command) return; for (const p of [...command].reverse()) this.write(p.path, p.before); this.redoStack.push(command); this.dirty = true; }
  redo(): void { const command = this.redoStack.pop(); if (!command) return; for (const p of command) this.write(p.path, p.after); this.undoStack.push(command); this.dirty = true; }
  get canUndo(): boolean { return !!this.undoStack.length; }
  get canRedo(): boolean { return !!this.redoStack.length; }
  set(ref: EditorObject, key: string, value: unknown): void {
    this.commit([{ path: [...ref.path, key], before: ref.value[key], after: value }]);
  }
  move(dx: number, dy: number): void {
    const objects = this.objects().filter(o => this.selection.has(o.id));
    const patches: Patch[] = [];
    for (const ref of objects) {
      const keys = ref.type === 'trigger' ? ['x'] : ref.type === 'boss' ? ['x', 'y', 'arenaLeft'] : ['x', 'y'];
      for (const key of keys) patches.push({ path: [...ref.path, key], before: ref.value[key], after: Number(ref.value[key]) + (key === 'y' ? dy : dx) });
    }
    this.commit(patches);
  }
  insert(collection: 'ground' | 'platforms' | 'checkpoints' | 'decorations' | 'spawnGroups', item: object): void {
    const before = this.data[collection]; this.commit([{ path: [collection], before: structuredClone(before), after: [...before, item] }]);
    this.selection = new Set([String((item as Record<string, unknown>).id)]);
  }
  insertEnemy(groupId: string, enemy: object): void {
    const i = this.data.spawnGroups.findIndex(g => g.id === groupId);
    if (i < 0) throw new Error('Select an existing spawn trigger first.');
    const before = this.data.spawnGroups[i]!.enemies;
    this.commit([{ path: ['spawnGroups', String(i), 'enemies'], before: structuredClone(before), after: [...before, enemy] }]);
    this.selection = new Set([String((enemy as Record<string, unknown>).id)]);
  }
  reassignEnemy(ref: EditorObject, groupId: string): void {
    if (ref.group === groupId) return;
    const groups = structuredClone(this.data.spawnGroups), target = groups.find(g => g.id === groupId);
    if (!target) return;
    const source = groups.find(g => g.id === ref.group)!;
    const enemy = source.enemies.find(e => e.id === ref.id)!;
    source.enemies = source.enemies.filter(e => e.id !== ref.id); target.enemies.push(enemy);
    this.commit([{ path: ['spawnGroups'], before: structuredClone(this.data.spawnGroups), after: groups }]);
  }
  deleteSelection(): void {
    const patches: Patch[] = [];
    for (const key of ['ground', 'platforms', 'checkpoints', 'decorations', 'spawnGroups'] as const) {
      const before = this.data[key], after = before.filter(o => !this.selection.has(o.id));
      if (after.length !== before.length) patches.push({ path: [key], before: structuredClone(before), after });
    }
    // Deleting a trigger also deletes its linked enemies in the same undoable command.
    if (!patches.some(p => p.path[0] === 'spawnGroups')) {
      this.data.spawnGroups.forEach((g, i) => {
        const after = g.enemies.filter(e => !this.selection.has(e.id));
        if (after.length !== g.enemies.length) patches.push({ path: ['spawnGroups', String(i), 'enemies'], before: structuredClone(g.enemies), after });
      });
    } else {
      const p = patches.find(p => p.path[0] === 'spawnGroups')!;
      p.after = (p.after as LevelDocument['spawnGroups']).map(g => ({ ...g, enemies: g.enemies.filter(e => !this.selection.has(e.id)) }));
    }
    this.commit(patches); this.selection.clear();
  }
  duplicate(): void {
    const refs = this.objects().filter(o => this.selection.has(o.id) && !['spawn', 'boss'].includes(o.type));
    const ids: string[] = [], patches: Patch[] = [], collections = new Map<string, unknown[]>();
    for (const ref of refs) {
      if (ref.type === 'enemy' && refs.some(o => o.type === 'trigger' && o.id === ref.group)) continue;
      const copy = structuredClone(ref.value); copy.id = newId(ref.type); ids.push(String(copy.id)); copy.x = Number(copy.x) + 16;
      if (ref.type !== 'trigger') copy.y = Number(copy.y) + 16;
      else copy.enemies = (copy.enemies as Record<string, unknown>[]).map(e => ({ ...e, id: newId('enemy'), x: Number(e.x) + 16 }));
      const path = ref.path.slice(0, -1), key = path.join('/');
      if (!collections.has(key)) {
        let before: unknown = this.data;
        for (const segment of path) before = (before as Record<string, unknown>)[segment];
        const after = structuredClone(before) as unknown[];
        collections.set(key, after); patches.push({ path, before: structuredClone(before), after });
      }
      collections.get(key)!.push(copy);
    }
    this.commit(patches); this.selection = new Set(ids);
  }
  cutPit(x: number, width: number): void {
    const after = this.data.ground.flatMap(box => {
      if (box.x >= x + width || box.x + box.width <= x) return [box];
      const pieces = [];
      if (box.x < x) pieces.push({ ...box, width: x - box.x });
      if (box.x + box.width > x + width) pieces.push({ ...box, id: newId('ground'), x: x + width, width: box.x + box.width - x - width });
      return pieces;
    });
    this.commit([{ path: ['ground'], before: structuredClone(this.data.ground), after }]);
  }
}
export function newId(prefix: string): string { return `${prefix}-${crypto.randomUUID()}`; }
