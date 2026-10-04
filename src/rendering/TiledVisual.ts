import { Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import type { AssetManager } from '../core/AssetManager';

/** Repeats full tileable textures. It never creates or changes collision geometry. */
export class TiledVisual {
  readonly root = new Group();
  private readonly material = new MeshBasicMaterial({ transparent: true, alphaTest: 0.01 });
  private readonly meshes: Mesh<PlaneGeometry, MeshBasicMaterial>[] = [];
  private ready = false;
  constructor(private readonly assets: AssetManager, private readonly id: string) { this.root.visible = false; }
  add(x: number, y: number, width: number, height: number, z: number): void {
    const mesh = new Mesh(new PlaneGeometry(width, height), this.material);
    mesh.position.set(x + width / 2, y + height / 2, z);
    this.meshes.push(mesh); this.root.add(mesh);
  }
  update(): boolean {
    if (this.ready) return true;
    const texture = this.assets.getTexture(this.id), asset = this.assets.getSpriteSheet(this.id);
    if (!texture || !asset) return false;
    this.material.map = texture; this.material.needsUpdate = true;
    for (const mesh of this.meshes) {
      const uv = mesh.geometry.getAttribute('uv');
      const width = mesh.geometry.parameters.width / (asset.visual.width * (asset.visual.scaleX ?? 1));
      const height = mesh.geometry.parameters.height / (asset.visual.height * (asset.visual.scaleY ?? 1));
      mesh.position.x += asset.visual.offsetX; mesh.position.y += asset.visual.offsetY;
      uv.setXY(0, 0, height); uv.setXY(1, width, height); uv.setXY(2, 0, 0); uv.setXY(3, width, 0);
      uv.needsUpdate = true;
    }
    this.ready = this.root.visible = true;
    return true;
  }
  dispose(): void { for (const mesh of this.meshes) mesh.geometry.dispose(); this.material.dispose(); }
}
