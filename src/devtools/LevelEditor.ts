import { Color, OrthographicCamera, Scene, WebGLRenderer } from 'three';
import { AssetManager } from '../core/AssetManager';
import { ASSETS } from '../config/assets';
import { ENVIRONMENT_ASSETS } from '../config/environment';
import { Level } from '../level/Level';
import { createLevel, exportLevel, loadLevel, parseLevel, validateLevel } from '../level/LevelDocument';
import { LevelView } from '../rendering/LevelView';
import { ParallaxBackground } from '../rendering/ParallaxBackground';
import { SpriteVisual } from '../rendering/SpriteVisual';
import { LevelEditorModel, newId } from './levelEditorModel';
import type { EditorObject, ObjectType } from './levelEditorModel';

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
const RECOVERY = 'iron-signal-editor-recovery-v1', SAVED = 'iron-signal-editor-saved-v1';
const RECOVERY_DIRTY = 'iron-signal-editor-recovery-dirty-v1';
type Tool = 'select' | 'pan' | 'terrain' | 'solid' | 'one-way' | 'pit' | 'enemy' | 'decoration' | 'checkpoint' | 'trigger' | 'spawn' | 'boss' | 'camera';
type Layer = 'background' | 'decorations' | 'terrain' | 'collisions' | 'platforms' | 'enemies' | 'triggers' | 'checkpoints' | 'special';
const layerNames: Layer[] = ['background', 'decorations', 'terrain', 'collisions', 'platforms', 'enemies', 'triggers', 'checkpoints', 'special'];
const colors: Record<ObjectType, string> = { solid: '#85ff98', platform: '#40d9f0', enemy: '#ff8d80', trigger: '#ffc566', checkpoint: '#b8f5b4', decoration: '#829dc0', spawn: '#fff079', boss: '#ff72bc' };
export class LevelEditor {
  readonly model = new LevelEditorModel();
  private readonly assets = new AssetManager();
  private readonly renderer = new WebGLRenderer({ antialias: false });
  private readonly scene = new Scene();
  private readonly scenery = new Scene();
  private readonly backScene = new Scene();
  private sceneryKey = '';
  private backgroundKey = '';
  private readonly camera = new OrthographicCamera(0, 256, 240, 0, .1, 100);
  private readonly stage = $('stage');
  private readonly overlay = $<HTMLCanvasElement>('overlay');
  private readonly ctx = this.overlay.getContext('2d')!;
  private readonly visible = new Set<Layer>(layerNames);
  private readonly locked = new Set<Layer>();
  private levelView?: LevelView;
  private background?: ParallaxBackground;
  private sprites: { ref: EditorObject; sprite: SpriteVisual }[] = [];
  private tool: Tool = 'select';
  private asset = 'environment.ground.top01';
  private enemyKind = 'soldier';
  private groupId = '';
  private zoom = 2;
  private pan = { x: 0, y: 0 };
  private cursor = { x: 0, y: 0 };
  private preview = { x: 0, y: 0 };
  private drag?: { mode: 'pan' | 'move' | 'create' | 'camera'; x: number; y: number; worldX: number; worldY: number; panX: number; panY: number };
  private dragDelta = { x: 0, y: 0 };
  private raf = 0;
  private frameRequested = false;
  private readonly observer = new ResizeObserver(() => this.resize());
  private copied: string[] = [];

  constructor() {
    this.renderer.setPixelRatio(1); this.camera.position.z = 10; this.scene.background = new Color(0x172831);
    this.scene.add(this.scenery, this.backScene);
    this.stage.prepend(this.renderer.domElement); this.observer.observe(this.stage);
    this.overlay.addEventListener('pointerdown', this.down);
    this.overlay.addEventListener('pointermove', this.move);
    this.overlay.addEventListener('pointerup', this.up);
    this.overlay.addEventListener('pointercancel', this.cancel);
    this.overlay.addEventListener('contextmenu', event => event.preventDefault());
    this.overlay.addEventListener('wheel', this.wheel, { passive: false });
    window.addEventListener('keydown', this.key);
    window.addEventListener('beforeunload', this.beforeUnload);
    this.setupUI();
  }
  async start(): Promise<void> {
    await this.assets.preload();
    let data = await loadLevel('./levels/level-01.json');
    const recovery = localStorage.getItem(RECOVERY);
    let recovered = false;
    if (recovery) { try { data = parseLevel(JSON.parse(recovery)); recovered = true; } catch { $('validation').textContent = 'Recovery invalid; loaded Level 1.'; } }
    this.model.load(data); this.model.dirty = recovered && localStorage.getItem(RECOVERY_DIRTY) === 'true'; this.refresh(); this.resetView();
  }
  private setupUI(): void {
    const tools: Tool[] = ['select', 'pan', 'terrain', 'solid', 'one-way', 'pit', 'enemy', 'decoration', 'checkpoint', 'trigger', 'spawn', 'boss', 'camera'];
    for (const tool of tools) {
      const button = document.createElement('button'); button.textContent = tool.toUpperCase(); button.dataset.tool = tool;
      button.onclick = () => { this.tool = tool; this.updateToolUI(); this.palette(); }; $('tools').append(button);
    }
    for (const layer of layerNames) {
      const row = document.createElement('label'), show = document.createElement('input'), lock = document.createElement('input');
      show.type = lock.type = 'checkbox'; show.checked = true; show.ariaLabel = `Show ${layer}`; lock.ariaLabel = `Lock ${layer}`;
      show.onchange = () => { show.checked ? this.visible.add(layer) : this.visible.delete(layer); this.refreshScene(); };
      lock.onchange = () => { lock.checked ? this.locked.add(layer) : this.locked.delete(layer); };
      row.append(show, lock, document.createTextNode(layer)); $('layers').append(row);
    }
    const action = (id: string, fn: () => void | Promise<void>) => { $(id).onclick = () => { void Promise.resolve().then(fn).catch(error => this.error(error)); }; };
    action('new', () => {
      if (!this.discard()) return;
      const id = prompt('Level ID', 'level-02'); if (!id) return;
      const name = prompt('Level name', 'New Level'); if (!name) return;
      const width = Number(prompt('World width (world units)', '2048'));
      const height = Number(prompt('World height (current runtime: 240)', '240'));
      this.model.load(createLevel(id, name, width, height)); this.refresh(); this.resetView();
    });
    action('load', async () => {
      if (!this.discard()) return;
      const saved = localStorage.getItem(SAVED);
      if (saved && confirm('Load local saved level? Cancel loads selected bundled level.')) this.model.load(JSON.parse(saved));
      else this.model.load(await loadLevel(`./levels/${$<HTMLSelectElement>('levels').value}.json`));
      this.refresh(); this.resetView();
    });
    action('save', () => { const text = exportLevel(this.model.data); localStorage.setItem(SAVED, text); this.model.dirty = false; localStorage.setItem(RECOVERY_DIRTY, 'false'); this.refreshStatus(); });
    action('export', () => {
      const text = exportLevel(this.model.data), url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `${this.model.data.id}.json`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000); this.model.dirty = false; localStorage.setItem(RECOVERY_DIRTY, 'false'); this.refreshStatus();
    });
    action('import', () => { if (this.discard()) $<HTMLInputElement>('file').click(); });
    $<HTMLInputElement>('file').onchange = async () => {
      const file = $<HTMLInputElement>('file').files?.[0]; if (!file) return;
      try { if (file.size > 5_000_000) throw Error('Maximum JSON file size: 5 MB.'); this.model.load(JSON.parse(await file.text())); this.refresh(); this.resetView(); }
      catch (error) { this.error(error); } finally { $<HTMLInputElement>('file').value = ''; }
    };
    action('undo', () => { this.model.undo(); this.refresh(); }); action('redo', () => { this.model.redo(); this.refresh(); });
    action('duplicate', () => { this.unlockedSelection(); this.model.duplicate(); this.refresh(); }); action('delete', () => { this.unlockedSelection(); this.model.deleteSelection(); this.refresh(); });
    action('reset-view', () => this.resetView()); action('overview', () => { this.zoom = Math.max(.005, Math.min(this.stage.clientWidth / this.model.data.width, this.stage.clientHeight / 240)); this.pan = { x: 0, y: 0 }; this.resize(); });
    action('play', () => this.playtest(false)); action('play-here', () => this.playtest(true));
    for (const id of ['grid', 'snap', 'camera-preview']) $<HTMLInputElement>(id).onchange = () => this.requestDraw();
    $<HTMLInputElement>('search').oninput = () => this.palette();
    this.updateToolUI();
  }
  private discard(): boolean { return !this.model.dirty || confirm('Discard unsaved changes? Export JSON or Save Local to keep them.'); }
  private error(error: unknown): void { $('validation').textContent = String(error); }
  private updateToolUI(): void { document.querySelectorAll<HTMLElement>('[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === this.tool)); }
  private palette(): void {
    const root = $('palette'); root.replaceChildren();
    if (this.tool === 'enemy') this.input(root, 'Place in trigger', this.groupId, value => { this.groupId = String(value); }, this.model.data.spawnGroups.map(g => g.id));
    const search = $<HTMLInputElement>('search').value.toLowerCase();
    const entries = this.tool === 'enemy' ? ['soldier.idle', 'runner.run', 'turret.idle', 'flying.fly'] : Object.keys(ENVIRONMENT_ASSETS).filter(id =>
      this.tool === 'terrain' ? id.startsWith('environment.ground.') || id.startsWith('environment.platform.') : id.startsWith('environment.') && !id.includes('checkpoint') && !id.includes('.ground.') && !id.includes('.platform.'));
    if (this.tool !== 'enemy' && !entries.includes(this.asset)) this.asset = entries[0]!;
    for (const id of entries.filter(id => id.toLowerCase().includes(search))) {
      const spec = ASSETS[id]!, button = document.createElement('button'), canvas = document.createElement('canvas');
      canvas.width = canvas.height = 64; const ctx = canvas.getContext('2d')!, image = this.assets.getTexture(id)?.image as HTMLImageElement | undefined;
      ctx.imageSmoothingEnabled = false;
      if (image) { const frame = spec.sheet.atlas?.[0], w = frame?.width ?? spec.sheet.frameWidth, h = frame?.height ?? spec.sheet.frameHeight;
        const scale = Math.min(64 / w, 64 / h); ctx.drawImage(image, frame?.x ?? spec.sheet.margin ?? 0, frame?.y ?? spec.sheet.margin ?? 0, w, h, (64 - w * scale) / 2, (64 - h * scale) / 2, w * scale, h * scale); }
      button.append(canvas, document.createTextNode(id)); button.title = spec.path;
      button.classList.toggle('active', this.tool === 'enemy' ? id.startsWith(this.enemyKind + '.') : id === this.asset);
      button.onclick = () => { if (this.tool === 'enemy') this.enemyKind = id.split('.')[0]!; else this.asset = id; this.palette(); };
      root.append(button);
    }
  }
  private layer(ref: EditorObject): Layer {
    return ref.type === 'solid' ? 'collisions' : ref.type === 'platform' ? 'platforms' : ref.type === 'enemy' ? 'enemies'
      : ref.type === 'trigger' ? 'triggers' : ref.type === 'checkpoint' ? 'checkpoints' : ref.type === 'decoration'
      ? ref.value.layer === 'terrain' ? 'terrain' : 'decorations' : 'special';
  }
  private bounds(ref: EditorObject): { x: number; y: number; width: number; height: number } {
    const o = ref.value, x = Number(o.x), y = Number(o.y ?? 0);
    if (ref.type === 'trigger') return { x: x - 2, y: 0, width: 4, height: 240 };
    if (ref.type === 'boss') return { x: Number(o.arenaLeft), y: 0, width: 256, height: 240 };
    if (ref.type === 'enemy' || ref.type === 'spawn') {
      const id = ref.type === 'spawn' ? 'player.idle' : `${o.kind}.${o.kind === 'flying' ? 'fly' : o.kind === 'runner' ? 'run' : 'idle'}`;
      const spec = ASSETS[id]!; return { x: x - 6, y: y - (o.kind === 'flying' ? spec.visual.height / 2 : 0), width: spec.visual.width, height: spec.visual.height };
    }
    return { x: x - (ref.type === 'decoration' && !o.tiled ? Number(o.width) / 2 : 0), y, width: Number(o.width ?? 16), height: Number(o.height ?? 32) };
  }
  private refreshScene(): void {
    for (const item of this.sprites) { item.sprite.dispose(); this.scene.remove(item.sprite.root); } this.sprites = [];
    const data = structuredClone(this.model.data);
    if (!this.visible.has('decorations')) data.decorations = data.decorations.filter(d => d.layer === 'terrain');
    if (!this.visible.has('terrain')) { data.ground = []; data.platforms = []; data.automaticTerrain = false; data.decorations = data.decorations.filter(d => d.layer !== 'terrain'); }
    if (!this.visible.has('platforms')) data.platforms = [];
    const sceneryKey = JSON.stringify([data.ground, data.platforms, data.decorations, data.automaticTerrain, data.exitX, data.width]);
    if (sceneryKey !== this.sceneryKey) {
      this.levelView?.dispose(); this.scenery.clear(); this.sceneryKey = sceneryKey;
      this.levelView = new LevelView(this.scenery, new Level(data), this.assets); this.levelView.update(0);
    }
    const backgroundKey = JSON.stringify([this.visible.has('background'), data.backgrounds]);
    if (backgroundKey !== this.backgroundKey) {
      this.background?.dispose(); this.backScene.clear(); this.background = undefined; this.backgroundKey = backgroundKey;
      if (this.visible.has('background')) this.background = new ParallaxBackground(this.backScene, this.assets, data.backgrounds);
    }
    this.background?.update(this.pan.x);
    for (const ref of this.model.objects()) {
      if (!['enemy', 'spawn', 'checkpoint'].includes(ref.type) || !this.visible.has(this.layer(ref))) continue;
      const o = ref.value, id = ref.type === 'spawn' ? 'player.idle' : ref.type === 'checkpoint' ? 'environment.checkpoint.waiting'
        : `${o.kind}.${o.kind === 'flying' ? 'fly' : o.kind === 'runner' ? 'run' : 'idle'}`;
      const spec = ASSETS[id]!, sprite = new SpriteVisual(this.assets, spec.visual);
      sprite.root.position.set(Number(o.x) + (ref.type === 'enemy' || ref.type === 'spawn' ? 6 : 0), Number(o.y), 0);
      sprite.update(id, 0, o.facing === -1); this.scene.add(sprite.root); this.sprites.push({ ref, sprite });
    }
    this.requestDraw();
  }
  private refresh(): void {
    this.groupId = this.model.data.spawnGroups.some(g => g.id === this.groupId) ? this.groupId : this.model.data.spawnGroups[0]?.id ?? '';
    this.refreshScene(); this.properties(); this.worldProperties(); this.palette(); this.refreshStatus();
    if ($<HTMLInputElement>('autosave').checked) { try { localStorage.setItem(RECOVERY, JSON.stringify(this.model.data)); localStorage.setItem(RECOVERY_DIRTY, String(this.model.dirty)); } catch { this.error('Autosave storage full; export JSON now.'); } }
  }
  private input(root: HTMLElement, label: string, value: unknown, change: (value: unknown) => void, choices?: string[]): void {
    const row = document.createElement('label'), text = document.createElement('span'); text.textContent = label;
    const field = choices ? document.createElement('select') : document.createElement('input');
    if (choices && field instanceof HTMLSelectElement) for (const choice of choices) { const option = document.createElement('option'); option.value = option.textContent = choice; field.append(option); }
    if (field instanceof HTMLInputElement) { field.type = typeof value === 'boolean' ? 'checkbox' : typeof value === 'number' ? 'number' : 'text'; field.step = 'any'; field.checked = value === true; }
    field.value = String(value ?? ''); field.ariaLabel = label;
    field.onchange = () => {
      const next = field instanceof HTMLInputElement && field.type === 'checkbox' ? field.checked : typeof value === 'number' ? Number(field.value) : field.value;
      if (typeof next === 'number' && !Number.isFinite(next)) return;
      change(next); this.refresh();
    }; row.append(text, field); root.append(row);
  }
  private properties(): void {
    const root = $('properties'); root.replaceChildren();
    const selected = this.model.objects().filter(o => this.model.selection.has(o.id));
    if (selected.length !== 1) { root.textContent = `${selected.length} selected. Shift+click to select multiple.`; return; }
    const ref = selected[0]!; root.append(document.createTextNode(`${ref.type.toUpperCase()} · ${ref.id}`));
    if (this.locked.has(this.layer(ref))) { root.append(document.createTextNode(' · LOCKED')); return; }
    this.input(root, 'id', ref.id, value => { this.model.set(ref, 'id', value); this.model.selection = new Set([String(value)]); });
    const keys = ref.type === 'trigger' ? ['x'] : ref.type === 'boss' ? ['x', 'y', 'arenaLeft']
      : ref.type === 'solid' || ref.type === 'platform' || ref.type === 'decoration' ? ['x', 'y', 'width', 'height'] : ['x', 'y'];
    for (const key of keys) this.input(root, key, ref.value[key], v => this.model.set(ref, key, v));
    if (ref.type === 'checkpoint') this.input(root, 'name', ref.value.name, v => this.model.set(ref, 'name', v));
    if (ref.type === 'platform') this.input(root, 'kind', ref.value.kind, v => this.model.set(ref, 'kind', v), ['solid', 'one-way']);
    if (ref.type === 'enemy') {
      this.input(root, 'facing', String(ref.value.facing ?? -1), v => this.model.set(ref, 'facing', Number(v)), ['-1', '1']);
      this.input(root, 'spawn trigger', ref.group, v => this.model.reassignEnemy(ref, String(v)), this.model.data.spawnGroups.map(g => g.id));
      if (ref.value.kind === 'flying') this.input(root, 'carriedPowerUp', ref.value.weaponDrop ?? 'NONE', v => this.model.set(ref, 'weaponDrop', v === 'NONE' ? undefined : v), ['NONE', 'M', 'S', 'L']);
      if (ref.value.kind === 'turret') this.input(root, 'firingMode', ref.value.firingMode ?? 'aimed', v => this.model.set(ref, 'firingMode', v), ['aimed', 'horizontal']);
    }
    if (ref.type === 'decoration') {
      this.input(root, 'layer', ref.value.layer, v => this.model.set(ref, 'layer', v), ['back', 'terrain', 'front']);
      this.input(root, 'flipX', ref.value.flipX, v => this.model.set(ref, 'flipX', v));
      if (ASSETS[String(ref.value.asset)]?.tileable) this.input(root, 'tiled', ref.value.tiled, v => this.model.set(ref, 'tiled', v));
      root.append(document.createTextNode(`Asset: ${ref.value.asset}. Sprite x = bottom-center; tiled x = left edge.`));
    }
    if (ref.type === 'trigger') { this.groupId = ref.id; root.append(document.createTextNode(`Linked enemies: ${(ref.value.enemies as unknown[]).length}. Delete trigger also deletes linked enemies (undoable).`)); }
  }
  private worldProperties(): void {
    const root = $('world-properties'); root.replaceChildren();
    for (const key of ['id', 'name', 'width', 'height', 'exitX', 'automaticTerrain'] as const) this.input(root, key, this.model.data[key], value =>
      this.model.commit([{ path: [key], before: this.model.data[key], after: value }]));
    const backgrounds = $('background-properties'); backgrounds.replaceChildren();
    this.model.data.backgrounds.forEach((b, i) => {
      const title = document.createElement('strong'); title.textContent = ['FAR', 'MID', 'NEAR'][i]!; backgrounds.append(title);
      for (const key of ['asset', 'speed', 'offsetX', 'offsetY'] as const) this.input(backgrounds, key, b[key], value =>
        this.model.commit([{ path: ['backgrounds', String(i), key], before: b[key], after: value }]), key === 'asset' ? Object.keys(ASSETS).filter(id => id.startsWith('background.')) : undefined);
    });
  }
  private refreshStatus(): void {
    const v = validateLevel(this.model.data);
    $('validation').textContent = [`${v.errors.length} errors / ${v.warnings.length} warnings`, ...v.errors.map(e => `ERROR: ${e}`), ...v.warnings.map(e => `WARNING: ${e}`)].join('\n');
    $<HTMLButtonElement>('undo').disabled = !this.model.canUndo; $<HTMLButtonElement>('redo').disabled = !this.model.canRedo;
    const state = this.model.dirty ? 'UNSAVED CHANGES' : 'SAVED / LOADED';
    $('status').textContent = `${state} · Cursor ${this.cursor.x.toFixed(1)}, ${this.cursor.y.toFixed(1)} · Grid 16 · Zoom ${Math.round(this.zoom * 100)}% · Objects ${this.model.objects().length} · Selection ${[...this.model.selection].join(', ') || 'none'}`;
  }
  private resetView(): void { this.zoom = 2; this.pan = { x: 0, y: 0 }; this.preview = { x: this.model.data.spawn.x - 32, y: 0 }; this.resize(); }
  private resize(): void {
    const w = this.stage.clientWidth, h = this.stage.clientHeight;
    this.renderer.setSize(w, h, false); this.overlay.width = w; this.overlay.height = h;
    this.camera.left = this.pan.x; this.camera.right = this.pan.x + w / this.zoom;
    this.camera.bottom = this.pan.y; this.camera.top = this.pan.y + h / this.zoom; this.camera.updateProjectionMatrix();
    this.background?.update(this.pan.x); this.requestDraw();
  }
  private world(event: PointerEvent | WheelEvent): { x: number; y: number } {
    const rect = this.overlay.getBoundingClientRect(); return { x: this.pan.x + (event.clientX - rect.left) / this.zoom, y: this.pan.y + (rect.bottom - event.clientY) / this.zoom };
  }
  private snap(value: number): number { return $<HTMLInputElement>('snap').checked ? Math.round(value / 16) * 16 : value; }
  private readonly down = (event: PointerEvent): void => {
    this.cursor = this.world(event); this.overlay.setPointerCapture(event.pointerId);
    let mode: 'pan' | 'move' | 'create' | 'camera' = event.button !== 0 || this.tool === 'pan' ? 'pan' : this.tool === 'camera' ? 'camera' : this.tool === 'select' ? 'move' : 'create';
    if (mode === 'move') {
      this.unlockedSelection();
      const refs = this.model.objects().filter(o => this.visible.has(this.layer(o)) && !this.locked.has(this.layer(o)));
      // Small objects have priority over the terrain below them; triggers remain selectable at their line.
      const hits = refs.filter(o => { const b = this.bounds(o); return this.cursor.x >= b.x && this.cursor.x <= b.x + b.width && this.cursor.y >= b.y && this.cursor.y <= b.y + b.height; });
      const hit = hits.sort((a, b) => { const x = this.bounds(a), y = this.bounds(b); return x.width * x.height - y.width * y.height; })[0];
      if (hit) {
        if (event.shiftKey) this.model.selection.has(hit.id) ? this.model.selection.delete(hit.id) : this.model.selection.add(hit.id);
        else if (!this.model.selection.has(hit.id)) this.model.selection = new Set([hit.id]);
        if (hit.type === 'trigger') this.groupId = hit.id;
      } else { if (!event.shiftKey) this.model.selection.clear(); mode = 'pan'; }
      this.properties(); this.refreshStatus(); this.requestDraw();
    }
    this.drag = { mode, x: event.clientX, y: event.clientY, worldX: this.cursor.x, worldY: this.cursor.y, panX: this.pan.x, panY: this.pan.y };
    this.dragDelta = { x: 0, y: 0 };
  };
  private readonly move = (event: PointerEvent): void => {
    this.cursor = this.world(event);
    if (this.drag?.mode === 'pan') { this.pan.x = this.drag.panX - (event.clientX - this.drag.x) / this.zoom; this.pan.y = this.drag.panY + (event.clientY - this.drag.y) / this.zoom; this.resize(); }
    else if (this.drag?.mode === 'move') this.dragDelta = { x: this.snap(this.cursor.x - this.drag.worldX), y: this.snap(this.cursor.y - this.drag.worldY) };
    else if (this.drag?.mode === 'camera') this.preview = { x: this.snap(this.cursor.x), y: this.snap(this.cursor.y) };
    this.refreshStatus(); this.requestDraw();
  };
  private readonly up = (event: PointerEvent): void => {
    if (!this.drag) return;
    try {
      if (this.drag.mode === 'move' && (this.dragDelta.x || this.dragDelta.y)) { this.model.move(this.dragDelta.x, this.dragDelta.y); this.refresh(); }
      if (this.drag.mode === 'create') { this.create(this.drag.worldX, this.drag.worldY, this.cursor.x, this.cursor.y); this.refresh(); }
    } catch (error) { this.error(error); }
    this.drag = undefined; this.dragDelta = { x: 0, y: 0 }; if (this.overlay.hasPointerCapture(event.pointerId)) this.overlay.releasePointerCapture(event.pointerId); this.requestDraw();
  };
  private readonly cancel = (): void => { this.drag = undefined; this.dragDelta = { x: 0, y: 0 }; this.requestDraw(); };
  private readonly wheel = (event: WheelEvent): void => {
    event.preventDefault(); const before = this.world(event); this.zoom = Math.max(.005, Math.min(8, this.zoom * (event.deltaY < 0 ? 1.25 : .8)));
    const after = this.world(event); this.pan.x += before.x - after.x; this.pan.y += before.y - after.y; this.resize(); this.refreshStatus();
  };
  private create(x0: number, y0: number, x1: number, y1: number): void {
    const x = this.snap(x0), y = this.snap(y0), id = newId(this.tool);
    const width = Math.max(16, Math.abs(this.snap(x1) - x)), height = Math.max(16, Math.abs(this.snap(y1) - y));
    const left = Math.min(x, this.snap(x1)), bottom = Math.min(y, this.snap(y1));
    if (this.tool === 'solid' && !this.locked.has('collisions')) this.model.insert('ground', { id, x: left, y: bottom, width, height });
    else if (this.tool === 'one-way' && !this.locked.has('platforms')) this.model.insert('platforms', { id, kind: 'one-way', x: left, y, width, height: 6 });
    else if (this.tool === 'pit' && !this.locked.has('collisions')) this.model.cutPit(left, width);
    else if (this.tool === 'enemy' && !this.locked.has('enemies')) this.model.insertEnemy(this.groupId, { id, kind: this.enemyKind, x, y, facing: -1 });
    else if (this.tool === 'trigger' && !this.locked.has('triggers')) { this.model.insert('spawnGroups', { id, x, enemies: [] }); this.groupId = id; }
    else if (this.tool === 'checkpoint' && !this.locked.has('checkpoints')) this.model.insert('checkpoints', { id, x, y, name: 'Checkpoint' });
    else if (this.tool === 'spawn' || this.tool === 'boss') {
      if (this.locked.has('special')) return;
      const before = this.model.data[this.tool === 'spawn' ? 'spawn' : 'boss'];
      this.model.commit([{ path: [this.tool === 'spawn' ? 'spawn' : 'boss'], before: structuredClone(before), after: { ...before, x, y } }]);
    } else if (this.tool === 'terrain' || this.tool === 'decoration') {
      if (this.locked.has(this.tool === 'terrain' ? 'terrain' : 'decorations')) return;
      const spec = ASSETS[this.asset]!;
      if (this.tool === 'terrain') {
        const cells = [];
        const columns = Math.ceil(width / spec.visual.width), rows = Math.ceil(height / spec.visual.height);
        if (columns * rows > 4096) throw Error('Paint at most 4096 tiles per operation.');
        for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) cells.push({
          id: newId('tile'), asset: this.asset, x: left + column * spec.visual.width + spec.visual.width / 2,
          y: bottom + row * spec.visual.height, width: spec.visual.width, height: spec.visual.height,
          layer: 'terrain' as const, tiled: false, flipX: false,
        });
        this.model.commit([{ path: ['decorations'], before: structuredClone(this.model.data.decorations), after: [...this.model.data.decorations, ...cells] }]);
        this.model.selection = new Set(cells.map(c => c.id)); return;
      }
      this.model.insert('decorations', { id, asset: this.asset, x, y, width: spec.visual.width, height: spec.visual.height,
        layer: this.asset.includes('branch') ? 'front' : 'back', tiled: false, flipX: false });
    }
  }
  private requestDraw(): void {
    if (this.frameRequested) return; this.frameRequested = true;
    this.raf = requestAnimationFrame(() => { this.frameRequested = false; this.draw(); });
  }
  private draw(): void {
    this.renderer.render(this.scene, this.camera);
    const ctx = this.ctx, w = this.overlay.width, h = this.overlay.height, z = this.zoom;
    ctx.clearRect(0, 0, w, h); ctx.save(); ctx.translate(-this.pan.x * z, h + this.pan.y * z); ctx.scale(z, -z);
    ctx.lineWidth = 1 / z;
    if ($<HTMLInputElement>('grid').checked && z >= .4) {
      ctx.strokeStyle = '#72928a30'; ctx.beginPath();
      for (let x = Math.floor(this.pan.x / 16) * 16; x < this.pan.x + w / z; x += 16) { ctx.moveTo(x, this.pan.y); ctx.lineTo(x, this.pan.y + h / z); }
      for (let y = Math.floor(this.pan.y / 16) * 16; y < this.pan.y + h / z; y += 16) { ctx.moveTo(this.pan.x, y); ctx.lineTo(this.pan.x + w / z, y); }
      ctx.stroke();
    }
    ctx.strokeStyle = '#c4e5e0'; ctx.strokeRect(0, 0, this.model.data.width, 240);
    for (const ref of this.model.objects()) {
      if (!this.visible.has(this.layer(ref))) continue;
      const b = this.bounds(ref), selected = this.model.selection.has(ref.id), linked = ref.type === 'enemy' && this.model.selection.has(ref.group ?? '');
      if (selected && this.drag?.mode === 'move') { b.x += this.dragDelta.x; b.y += ref.type === 'trigger' ? 0 : this.dragDelta.y; }
      if (b.x + b.width < this.pan.x || b.x > this.pan.x + w / z) continue;
      ctx.strokeStyle = selected ? '#ffffff' : linked ? '#fff079' : colors[ref.type]; ctx.lineWidth = (selected || linked ? 2 : 1) / z;
      if (ref.type === 'solid' || ref.type === 'platform') { ctx.fillStyle = colors[ref.type] + '25'; ctx.fillRect(b.x, b.y, b.width, b.height); }
      ctx.strokeRect(b.x, b.y, b.width, b.height);
      if (z >= .5 && ['enemy', 'trigger', 'boss', 'checkpoint', 'spawn'].includes(ref.type)) {
        ctx.save(); ctx.translate(b.x, b.y + b.height + 3); ctx.scale(1 / z, -1 / z); ctx.fillStyle = ctx.strokeStyle; ctx.font = '11px monospace';
        const label = ref.type === 'enemy' ? `${ref.value.kind}${ref.value.weaponDrop ? ' [' + ref.value.weaponDrop + ']' : ''}` : ref.type === 'boss' ? 'BOSS TRIGGER' : ref.type;
        ctx.fillText(label, 0, 0); ctx.restore();
      }
    }
    if ($<HTMLInputElement>('camera-preview').checked) { ctx.strokeStyle = '#fff079'; ctx.setLineDash([4 / z, 4 / z]); ctx.strokeRect(this.preview.x, this.preview.y, 256, 240); ctx.setLineDash([]); }
    if (this.drag?.mode === 'create') { ctx.strokeStyle = '#fff'; ctx.strokeRect(this.snap(this.drag.worldX), this.snap(this.drag.worldY), this.snap(this.cursor.x) - this.snap(this.drag.worldX), this.snap(this.cursor.y) - this.snap(this.drag.worldY)); }
    ctx.restore();
  }
  private readonly key = (event: KeyboardEvent): void => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
    const ctrl = event.ctrlKey || event.metaKey;
    if (ctrl && event.code === 'KeyZ') { event.preventDefault(); event.shiftKey ? this.model.redo() : this.model.undo(); this.refresh(); }
    else if (ctrl && event.code === 'KeyY') { event.preventDefault(); this.model.redo(); this.refresh(); }
    else if (ctrl && event.code === 'KeyD') { event.preventDefault(); this.unlockedSelection(); this.model.duplicate(); this.refresh(); }
    else if (ctrl && event.code === 'KeyC') { event.preventDefault(); this.copied = [...this.model.selection]; }
    else if (ctrl && event.code === 'KeyV') { event.preventDefault(); this.model.selection = new Set(this.copied); this.unlockedSelection(); this.model.duplicate(); this.refresh(); }
    else if (event.code === 'Delete' || event.code === 'Backspace') { event.preventDefault(); this.unlockedSelection(); this.model.deleteSelection(); this.refresh(); }
    else if (event.code === 'Escape') { this.model.selection.clear(); this.properties(); this.requestDraw(); }
  };
  private unlockedSelection(): void { const allowed = this.model.objects().filter(o => !this.locked.has(this.layer(o))); this.model.selection = new Set(allowed.filter(o => this.model.selection.has(o.id)).map(o => o.id)); }
  private playtest(here: boolean): void {
    const document = parseLevel(this.model.data); localStorage.setItem(RECOVERY, JSON.stringify(this.model.data)); localStorage.setItem(RECOVERY_DIRTY, String(this.model.dirty));
    if (here) document.spawn = { ...document.spawn, x: Math.max(0, Math.min(document.width - 12, this.preview.x + 32)), y: Math.max(0, Math.min(214, this.preview.y + 44)) };
    sessionStorage.setItem('iron-signal-playtest-v1', JSON.stringify(document)); this.model.dirty = false;
    location.href = './?playtest=1';
  }
  private readonly beforeUnload = (event: BeforeUnloadEvent): void => { if (this.model.dirty) { event.preventDefault(); event.returnValue = ''; } };
  dispose(): void {
    cancelAnimationFrame(this.raf); this.observer.disconnect(); this.levelView?.dispose(); this.background?.dispose();
    for (const item of this.sprites) item.sprite.dispose(); this.assets.dispose(); this.renderer.dispose();
    window.removeEventListener('keydown', this.key); window.removeEventListener('beforeunload', this.beforeUnload);
  }
}
