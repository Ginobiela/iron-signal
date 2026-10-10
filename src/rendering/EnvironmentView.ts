import { Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import type { AssetManager } from '../core/AssetManager';
import type { AABB } from '../collision/CollisionSystem';
import { DRAW } from '../config/assets';
import { ENVIRONMENT_ASSETS } from '../config/environment';
import type { LevelData } from '../level/Level';
import { environmentLayout } from './environmentLayout';
import type { EnvironmentId } from '../config/environment';
import { groundPieces, platformPieces } from './environmentPieces';
import { SpriteVisual } from './SpriteVisual';
import { TiledVisual } from './TiledVisual';

/** Builds full-level visuals once and leaves all level/collision data untouched. */
export class EnvironmentView {
  readonly root = new Group();
  private readonly tiles = new Map<EnvironmentId, TiledVisual>();
  private readonly props: { id: EnvironmentId; sprite: SpriteVisual; fallback: Group }[] = [];
  private readonly geometry = new PlaneGeometry(1, 1);
  private readonly foliage = new MeshBasicMaterial({ color: 0x344c43 });
  private readonly metal = new MeshBasicMaterial({ color: 0x394a4c });
  private readonly trim = new MeshBasicMaterial({ color: 0x59675a });
  private readonly wallMaterial = new MeshBasicMaterial({ color: 0x26393a });
  private readonly walls: { tile: TiledVisual; fallback: Mesh }[] = [];

  constructor(private readonly assets: AssetManager, level: LevelData) {
    const layout = environmentLayout(level);
    for (const { id, x, y, width, height } of layout.walls) {
      const tile = this.tile(id); tile.add(x, y, width, height, DRAW.levelBackDecor);
      const fallback = new Mesh(this.geometry, this.wallMaterial);
      fallback.position.set(x + width / 2, y + height / 2, DRAW.levelBackDecor);
      fallback.scale.set(width, height, 1); this.root.add(fallback); this.walls.push({ tile, fallback });
    }
    for (const prop of layout.props) {
      const spec = ENVIRONMENT_ASSETS[prop.id], z = spec.layer === 'front' ? DRAW.foreground : DRAW.levelBackDecor;
      const sprite = new SpriteVisual(assets, { width: spec.width, height: spec.height, offsetX: 0, offsetY: 0, anchor: 'bottom-center' }, '', z);
      sprite.root.position.set(prop.x, prop.y, z);
      const fallback = new Group(); fallback.position.copy(sprite.root.position);
      const jungle = prop.id.includes('grass') || prop.id.includes('plant') || prop.id.includes('vines') || prop.id.includes('branch');
      const shape = new Mesh(this.geometry, jungle ? this.foliage : this.metal);
      // Foreground occupies only the top border, away from the playable silhouette.
      shape.scale.set(spec.width * (jungle ? 0.75 : 1), spec.height * (jungle ? 0.25 : 1), 1);
      shape.position.y = shape.scale.y / 2;
      fallback.add(shape);
      const detail = new Mesh(this.geometry, this.trim);
      detail.scale.set(jungle ? 2 : Math.max(2, spec.width - 4), jungle ? spec.height : 2, 1);
      detail.position.set(0, jungle ? spec.height / 2 : spec.height - 4, DRAW.detail);
      fallback.add(detail); this.root.add(sprite.root, fallback);
      this.props.push({ id: prop.id, sprite, fallback });
    }
  }

  private tile(id: EnvironmentId): TiledVisual {
    let tile = this.tiles.get(id);
    if (!tile) { tile = new TiledVisual(this.assets, id); this.tiles.set(id, tile); this.root.add(tile.root); }
    return tile;
  }

  addGround(box: AABB): void {
    for (const piece of groundPieces(box, box.x > 0)) {
      this.tile(piece.id).add(piece.x, piece.y, piece.width, piece.height, DRAW.levelTiles, piece.topAligned);
    }
  }

  addPlatform(box: AABB): void {
    for (const piece of platformPieces(box)) this.tile(piece.id).add(piece.x, piece.y, piece.width, piece.height, DRAW.levelTiles, true);
  }

  update(dt: number): void {
    for (const tile of this.tiles.values()) tile.update();
    for (const wall of this.walls) wall.fallback.visible = !wall.tile.root.visible;
    for (const prop of this.props) prop.fallback.visible = !prop.sprite.update(prop.id, dt);
  }
  setDebug(visible: boolean): void {
    for (const tile of this.tiles.values()) tile.setDebug(visible);
    for (const prop of this.props) prop.sprite.setDebug(visible);
  }
  dispose(): void {
    for (const tile of this.tiles.values()) tile.dispose();
    for (const prop of this.props) prop.sprite.dispose();
    this.geometry.dispose(); this.foliage.dispose(); this.metal.dispose(); this.trim.dispose(); this.wallMaterial.dispose();
  }
}
