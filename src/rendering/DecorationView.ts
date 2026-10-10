import { Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import type { AssetManager } from '../core/AssetManager';
import type { Decoration } from '../level/LevelDocument';
import { ASSETS, DRAW } from '../config/assets';
import { SpriteVisual } from './SpriteVisual';
import { TiledVisual } from './TiledVisual';

/** The editor and runtime share the exact same visual-only placement renderer. */
export class DecorationView {
  readonly root = new Group();
  private readonly geometry = new PlaneGeometry(1, 1);
  private readonly material = new MeshBasicMaterial({ color: 0x394a4c });
  private readonly items: { data: Decoration; sprite?: SpriteVisual; tile?: TiledVisual; fallback: Mesh }[] = [];
  constructor(assets: AssetManager, decorations: readonly Decoration[]) {
    for (const data of decorations) {
      const z = data.layer === 'front' ? DRAW.foreground : data.layer === 'terrain' ? DRAW.levelTiles + DRAW.detail : DRAW.levelBackDecor;
      const fallback = new Mesh(this.geometry, this.material);
      fallback.position.set(data.x + (data.tiled ? data.width / 2 : 0), data.y + data.height / 2, z);
      fallback.scale.set(data.width, data.height, 1); this.root.add(fallback);
      if (data.tiled) {
        const tile = new TiledVisual(assets, data.asset); tile.add(data.x, data.y, data.width, data.height, z);
        if (data.flipX) { tile.root.scale.x = -1; tile.root.position.x = data.x * 2 + data.width; }
        this.root.add(tile.root); this.items.push({ data, tile, fallback });
      } else {
        const spec = ASSETS[data.asset]!;
        const sprite = new SpriteVisual(assets, spec.visual, '', z);
        sprite.root.position.set(data.x, data.y, z);
        sprite.root.scale.set(data.width / spec.visual.width, data.height / spec.visual.height, 1);
        this.root.add(sprite.root); this.items.push({ data, sprite, fallback });
      }
    }
  }
  update(dt: number): void {
    for (const item of this.items) item.fallback.visible = !(item.tile?.update() ?? item.sprite?.update(item.data.asset, dt, item.data.flipX));
  }
  setDebug(visible: boolean): void { for (const item of this.items) { item.sprite?.setDebug(visible); item.tile?.setDebug(visible); } }
  dispose(): void { for (const item of this.items) { item.sprite?.dispose(); item.tile?.dispose(); } this.geometry.dispose(); this.material.dispose(); }
}
