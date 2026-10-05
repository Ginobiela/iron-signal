import { Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import type { AssetManager } from '../core/AssetManager';
import { DRAW } from '../config/assets';

/** Repeats full tileable textures. It never creates or changes collision geometry. */
export class TiledVisual {
  readonly root = new Group();
  private readonly material = new MeshBasicMaterial({ transparent: true, alphaTest: 0.01 });
  private readonly meshes: Mesh<PlaneGeometry, MeshBasicMaterial>[] = [];
  private readonly topAligned: boolean[] = [];
  private ready = false;
  private readonly debug = new Group();
  private readonly boundsMaterial = new MeshBasicMaterial({ color: 0x00eaff, wireframe: true });
  private readonly anchorMaterial = new MeshBasicMaterial({ color: 0xffee66 });
  private readonly originMaterial = new MeshBasicMaterial({ color: 0xff55dd });
  private readonly markerGeometry = new PlaneGeometry(1, 1);
  constructor(private readonly assets: AssetManager, private readonly id: string) { this.root.visible = false; }
  add(x: number, y: number, width: number, height: number, z: number, topAligned = false): void {
    const mesh = new Mesh(new PlaneGeometry(width, height), this.material);
    mesh.position.set(x + width / 2, y + height / 2, z);
    this.meshes.push(mesh); this.root.add(mesh); mesh.visible = false;
    this.topAligned.push(topAligned);
  }
  update(): boolean {
    if (this.ready) return true;
    const texture = this.assets.getTexture(this.id), asset = this.assets.getSpriteSheet(this.id);
    if (!texture || !asset) return false;
    this.material.map = texture; this.material.needsUpdate = true;
    for (let i = 0; i < this.meshes.length; i++) {
      const mesh = this.meshes[i];
      if (!mesh) continue;
      const uv = mesh.geometry.getAttribute('uv');
      const width = mesh.geometry.parameters.width / (asset.visual.width * (asset.visual.scaleX ?? 1));
      const height = mesh.geometry.parameters.height / (asset.visual.height * (asset.visual.scaleY ?? 1));
      mesh.position.x += asset.visual.offsetX; mesh.position.y += asset.visual.offsetY;
      mesh.visible = true;
      const bottom = this.topAligned[i] ? 1 - height : 0;
      uv.setXY(0, 0, bottom + height); uv.setXY(1, width, bottom + height); uv.setXY(2, 0, bottom); uv.setXY(3, width, bottom);
      uv.needsUpdate = true;
    }
    this.ready = this.root.visible = true;
    return true;
  }
  setDebug(visible: boolean): void {
    if (visible && this.debug.children.length === 0) {
      for (const mesh of this.meshes) {
        const bounds = new Mesh(mesh.geometry, this.boundsMaterial);
        bounds.position.set(mesh.position.x, mesh.position.y, DRAW.debug);
        const anchor = new Mesh(this.markerGeometry, this.anchorMaterial);
        anchor.scale.set(3, 1, 1);
        anchor.position.set(mesh.position.x, mesh.position.y - mesh.geometry.parameters.height / 2, DRAW.debug + DRAW.detail);
        const origin = new Mesh(this.markerGeometry, this.originMaterial);
        origin.scale.set(1, 3, 1);
        origin.position.set(mesh.position.x - mesh.geometry.parameters.width / 2, anchor.position.y, DRAW.debug + DRAW.trim);
        this.debug.add(bounds, anchor, origin);
      }
      this.root.add(this.debug);
    }
    this.debug.visible = visible; this.root.visible = this.ready || visible;
  }
  dispose(): void {
    for (const mesh of this.meshes) mesh.geometry.dispose();
    this.material.dispose(); this.boundsMaterial.dispose(); this.anchorMaterial.dispose(); this.originMaterial.dispose(); this.markerGeometry.dispose();
  }
}
