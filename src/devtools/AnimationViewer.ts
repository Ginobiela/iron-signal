import { Mesh, MeshBasicMaterial, OrthographicCamera, PlaneGeometry, Scene, WebGLRenderer } from 'three';
import { AssetManager } from '../core/AssetManager';
import { SpriteVisual } from '../rendering/SpriteVisual';
import { spriteCenterY, writeFrameUV } from '../rendering/spriteFrames';
import type { SpriteAsset } from '../config/assets';
import { assetStatus, discoverAnimations, ViewerPlayback } from './animationViewerRegistry';

function element<T extends HTMLElement>(id: string): T {
  const result = document.getElementById(id);
  if (!result) throw new Error(`Falta #${id}`);
  return result as T;
}

export class AnimationViewer {
  private readonly registry = discoverAnimations();
  private readonly assets = new AssetManager(Object.fromEntries(this.registry.flatMap(entity =>
    entity.animations.map(animation => [animation.id, animation.asset]))));
  private readonly renderer = new WebGLRenderer({ antialias: false, alpha: true });
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(0, 96, 112, 0, 0.1, 100);
  private readonly preview = element('preview');
  private readonly entities = element<HTMLSelectElement>('entity');
  private readonly animations = element<HTMLSelectElement>('animation');
  private readonly initial = this.registry[0]?.animations[0];
  private readonly playback: ViewerPlayback;
  private readonly sprite: SpriteVisual;
  private readonly reference: SpriteVisual;
  private readonly geometry = new PlaneGeometry(1, 1);
  private readonly material = new MeshBasicMaterial({ color: 0xd99758 });
  private readonly placeholder = new Mesh(this.geometry, this.material);
  private readonly anchor = this.guide('anchor', '+');
  private readonly bounds = this.guide('bounds');
  private readonly baseline = this.guide('baseline');
  private readonly listeners = new AbortController();
  private readonly uv = { left: 0, right: 1, bottom: 0, top: 1 };
  private id = '';
  private lastFrame = -1;
  private frameRequest = 0;
  private lastTime = 0;
  private disposed = false;

  constructor() {
    if (!this.initial) throw new Error('No hay animaciones registradas.');
    this.playback = new ViewerPlayback(this.initial.asset);
    this.sprite = new SpriteVisual(this.assets, this.initial.asset.visual);
    this.reference = new SpriteVisual(this.assets, this.initial.asset.visual, 'player.idle');
    this.scene.add(this.sprite.root, this.reference.root, this.placeholder);
    this.camera.position.z = 20;
    this.renderer.setPixelRatio(1);
    this.renderer.setClearColor(0, 0);
    this.renderer.domElement.setAttribute('aria-label', 'Vista previa de animación');
    this.preview.prepend(this.renderer.domElement);
    for (const entity of this.registry) this.entities.add(new Option(entity.id.toUpperCase(), entity.id));
    this.populateAnimations();
    const signal = this.listeners.signal;
    this.entities.addEventListener('change', () => { this.populateAnimations(); this.select(); }, { signal });
    this.animations.addEventListener('change', () => this.select(), { signal });
    element('play').addEventListener('click', () => this.playback.toggle(), { signal });
    element('previous').addEventListener('click', () => this.playback.seek(this.playback.index - 1), { signal });
    element('next').addEventListener('click', () => this.playback.seek(this.playback.index + 1), { signal });
    element('fps').addEventListener('input', () => {
      this.playback.overrideFps(Number(element<HTMLInputElement>('fps').value)); this.refreshFps();
    }, { signal });
    element('reset-fps').addEventListener('click', () => { this.playback.resetFps(); this.refreshFps(); }, { signal });
    for (const id of ['scale', 'flip', 'anchor', 'bounds', 'baseline', 'compare']) {
      element(id).addEventListener('change', () => { this.lastFrame = -1; this.layout(); }, { signal });
    }
    element('background').addEventListener('change', () => {
      this.preview.dataset.background = element<HTMLSelectElement>('background').value;
    }, { signal });
    window.addEventListener('keydown', this.keydown, { signal });
  }

  async start(): Promise<void> {
    await this.assets.preload();
    if (this.disposed) return;
    this.select();
    this.frameRequest = requestAnimationFrame(this.render);
  }

  private guide(className: string, text = ''): HTMLDivElement {
    const guide = document.createElement('div'); guide.className = `guide ${className}`;
    guide.textContent = text; guide.setAttribute('aria-hidden', 'true'); this.preview.append(guide); return guide;
  }
  private checked(id: string): boolean { return element<HTMLInputElement>(id).checked; }
  private populateAnimations(): void {
    this.animations.replaceChildren();
    for (const animation of this.registry.find(entity => entity.id === this.entities.value)?.animations ?? []) {
      this.animations.add(new Option(animation.id, animation.id));
    }
  }
  private select(): void {
    const asset = this.assets.getSpriteSheet(this.animations.value);
    if (!asset) return;
    this.id = this.animations.value; this.playback.select(asset); this.lastFrame = -1;
    const texture = this.assets.getTexture(this.id);
    element('status').textContent = `ASSET: ${assetStatus(asset, Boolean(texture))}`;
    const { sheet, visual, clip } = asset;
    const image = texture?.image as { width: number; height: number } | undefined;
    const anchor = visual.anchor === 'bottom-center' ? `${sheet.frameWidth / 2}, ${sheet.frameHeight}`
      : `${sheet.frameWidth / 2}, ${sheet.frameHeight / 2}`;
    element('metadata').textContent = [
      `Asset ID: ${this.id}`, `Texture: ${asset.url ?? asset.path} ${asset.url ? '' : '(sin PNG activado)'}`,
      `Texture size: ${image ? `${image.width}×${image.height}` : '—'}`,
      `Frame size: ${sheet.frameWidth}×${sheet.frameHeight}${sheet.atlas ? ' (atlas: ver rectángulos debajo)' : ''}`,
      `Frames: ${clip.frames.length} / sheet: ${sheet.frameCount} · order: ${clip.frames.join(', ')}`,
      `Registered FPS: ${this.playback.originalFps} · Loop: ${clip.loop !== false}`,
      `Anchor: ${visual.anchor} (${anchor})`, `Visual size: ${visual.width}×${visual.height}`,
      `Offsets: ${visual.offsetX}, ${visual.offsetY} · Visual scale: ${visual.scaleX ?? 1}, ${visual.scaleY ?? 1}`,
    ].join('\n');
    this.refreshFps(); this.buildFrames(asset); this.layout();
  }
  private refreshFps(): void {
    element<HTMLInputElement>('fps').value = String(this.playback.fps);
    element('fps-value').textContent = String(this.playback.fps);
  }
  private buildFrames(asset: SpriteAsset): void {
    const strip = element('strip'); strip.replaceChildren();
    const texture = this.assets.getTexture(this.id);
    const image = texture?.image as HTMLImageElement | undefined;
    const sheet = element<HTMLCanvasElement>('sheet');
    sheet.hidden = !image;
    if (image) {
      sheet.width = image.width; sheet.height = image.height;
      sheet.style.width = `${image.width * 2}px`; sheet.style.height = `${image.height * 2}px`;
      const context = sheet.getContext('2d');
      if (context) { context.imageSmoothingEnabled = false; context.drawImage(image, 0, 0); }
    }
    element('sheet-info').textContent = image
      ? `Textura completa 2x. Frames usados: ${asset.clip.frames.join(', ')}${asset.sheet.atlas ? ` · atlas: ${JSON.stringify(asset.sheet.atlas)}` : ''}`
      : 'MISSING / FALLBACK: no hay textura para inspeccionar.';
    asset.clip.frames.forEach((frame, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = String(index + 1);
      button.setAttribute('aria-label', `Seleccionar frame ${index + 1}`);
      if (image) {
        writeFrameUV(asset.sheet, frame, image.width, image.height, this.uv);
        const x = Math.round(this.uv.left * image.width - 0.5), y = Math.round((1 - this.uv.top) * image.height - 0.5);
        const width = Math.round((this.uv.right - this.uv.left) * image.width + 1);
        const height = Math.round((this.uv.top - this.uv.bottom) * image.height + 1);
        const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
        canvas.style.width = `${width * 2}px`; canvas.style.height = `${height * 2}px`;
        const context = canvas.getContext('2d');
        if (context) { context.imageSmoothingEnabled = false; context.drawImage(image, x, y, width, height, 0, 0, width, height); }
        button.prepend(canvas);
      }
      button.addEventListener('click', () => this.playback.seek(index)); strip.append(button);
    });
  }
  private layout(): void {
    const compare = this.checked('compare') && this.entities.value !== 'player';
    const width = compare ? 144 : 96, scale = Number(element<HTMLSelectElement>('scale').value);
    const x = compare ? 104 : 48, y = 24, height = 112;
    this.camera.right = width; this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.renderer.domElement.style.width = `${width * scale}px`; this.renderer.domElement.style.height = `${height * scale}px`;
    this.preview.style.width = `${width * scale}px`; this.preview.style.height = `${height * scale}px`;
    this.sprite.root.position.set(x, y, 0); this.reference.root.position.set(40, y, 0); this.reference.root.visible = compare;
    const visual = this.playback.asset.visual, w = visual.width * (visual.scaleX ?? 1), h = visual.height * (visual.scaleY ?? 1);
    this.placeholder.scale.set(w, h, 1); this.placeholder.position.set(x + visual.offsetX, y + spriteCenterY(visual), 0);
    this.anchor.hidden = !this.checked('anchor'); this.bounds.hidden = !this.checked('bounds'); this.baseline.hidden = !this.checked('baseline');
    this.anchor.style.left = `${(x + visual.offsetX) * scale}px`; this.anchor.style.top = `${(height - y - visual.offsetY) * scale}px`;
    this.bounds.style.left = `${(x + visual.offsetX - w / 2) * scale}px`;
    this.bounds.style.top = `${(height - y - spriteCenterY(visual) - h / 2) * scale}px`;
    this.bounds.style.width = `${w * scale}px`; this.bounds.style.height = `${h * scale}px`;
    this.baseline.style.top = `${(height - y) * scale}px`;
  }
  private readonly render = (time: number): void => {
    if (this.disposed) return;
    const dt = this.lastTime ? Math.min((time - this.lastTime) / 1000, 0.1) : 0; this.lastTime = time;
    this.playback.tick(dt);
    if (this.lastFrame !== this.playback.index) {
      this.sprite.reset(); this.sprite.update(this.id, 0, this.checked('flip'));
      this.sprite.update(this.id, (this.playback.index + 1e-7) / this.playback.originalFps, this.checked('flip'));
      this.placeholder.visible = !this.sprite.available;
      this.lastFrame = this.playback.index;
      element('frame').textContent = `Frame ${this.playback.index + 1} / ${this.playback.asset.clip.frames.length}`;
      for (const [index, button] of [...element('strip').children].entries()) button.setAttribute('aria-pressed', String(index === this.playback.index));
    }
    element('play').textContent = this.playback.playing ? 'PAUSE' : 'PLAY';
    if (this.reference.root.visible) this.reference.update('player.idle', dt);
    this.renderer.render(this.scene, this.camera);
    this.frameRequest = requestAnimationFrame(this.render);
  };
  private readonly keydown = (event: KeyboardEvent): void => {
    if (event.target instanceof HTMLElement && (event.target.matches('input, select, textarea') || event.target.isContentEditable)) return;
    if (event.repeat) return;
    if (event.code === 'Space') this.playback.toggle();
    else if (event.code === 'ArrowLeft') this.playback.seek(this.playback.index - 1);
    else if (event.code === 'ArrowRight') this.playback.seek(this.playback.index + 1);
    else {
      const id = ({ KeyF: 'flip', KeyA: 'anchor', KeyB: 'bounds', KeyG: 'baseline' } as Record<string, string>)[event.code];
      if (!id) return;
      element<HTMLInputElement>(id).checked = !this.checked(id); this.lastFrame = -1; this.layout();
    }
    event.preventDefault();
  };
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; cancelAnimationFrame(this.frameRequest); this.listeners.abort();
    this.sprite.dispose(); this.reference.dispose(); this.geometry.dispose(); this.material.dispose();
    this.assets.dispose(); this.renderer.dispose(); this.renderer.domElement.remove();
  }
}
