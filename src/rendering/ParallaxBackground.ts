import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, Scene } from 'three';
import { PARALLAX } from '../config/constants';
import type { AssetManager } from '../core/AssetManager';
import { TiledVisual } from './TiledVisual';
import { DRAW } from '../config/assets';

const PERIOD = 512;

export function parallaxPosition(cameraX: number, speed: number): number {
  return Math.round(cameraX - (cameraX * speed) % PERIOD);
}

export class ParallaxBackground {
  private readonly geometry = new PlaneGeometry(1, 1);
  private readonly materials = new Map<number, MeshBasicMaterial>();
  private readonly layers = [
    { root: new Group(), speed: PARALLAX.background },
    { root: new Group(), speed: PARALLAX.midground },
    { root: new Group(), speed: PARALLAX.foreground },
  ];
  private readonly textures: TiledVisual[] = [];

  constructor(scene: Scene, assets: AssetManager) {
    const rect = (group: Group, x: number, y: number, width: number, height: number,
      color: number, z: number): void => {
      let material = this.materials.get(color);
      if (!material) {
        material = new MeshBasicMaterial({ color });
        this.materials.set(color, material);
      }
      const mesh = new Mesh(this.geometry, material);
      mesh.position.set(x + width / 2, y + height / 2, z);
      mesh.scale.set(width, height, 1);
      group.add(mesh);
    };
    for (let index = 0; index < this.layers.length; index++) {
      const layer = this.layers[index];
      if (!layer) continue;
      const id = index === 0 ? 'background.far' : index === 1 ? 'background.mid' : 'background.near';
      const z = index === 0 ? DRAW.backgroundFar : index === 1 ? DRAW.backgroundMid : DRAW.backgroundNear;
      const tiles = new TiledVisual(assets, id);
      this.textures.push(tiles);
      scene.add(tiles.root);
      for (let copy = -1; copy <= 1; copy++) {
        const x0 = copy * PERIOD;
        tiles.add(x0, 0, PERIOD, 240, z + DRAW.detail);
        if (layer.speed === PARALLAX.background) {
          for (let i = 0; i < 8; i++) rect(layer.root, x0 + i * 64, 85, 64, 32 + (i * 13) % 40, 0x202c3b, DRAW.backgroundFar);
          rect(layer.root, x0 + 186, 172, 20, 20, 0xc0bb9b, DRAW.backgroundFar);
        } else if (layer.speed === PARALLAX.midground) {
          for (let i = 0; i < 12; i++) {
            const h = 40 + (i * 17) % 50;
            rect(layer.root, x0 + i * 44, 44, 24, h, 0x273b49, DRAW.backgroundMid);
            rect(layer.root, x0 + i * 44 + 4, 50, 2, h - 8, 0x355160, DRAW.backgroundMid + DRAW.detail);
          }
        } else {
          rect(layer.root, x0, 218, PERIOD, 2, 0x293e49, DRAW.backgroundNear);
          for (let i = 0; i < 8; i++) rect(layer.root, x0 + i * 64, 218, 2, 22, 0x293e49, DRAW.backgroundNear);
        }
      }
      scene.add(layer.root);
    }
  }

  update(cameraX: number): void {
    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i], tiles = this.textures[i];
      if (!layer || !tiles) continue;
      const x = parallaxPosition(cameraX, layer.speed);
      layer.root.position.x = tiles.root.position.x = x;
      const loaded = tiles.update();
      tiles.root.visible = loaded;
      layer.root.visible = !loaded;
    }
  }

  dispose(): void {
    this.geometry.dispose();
    for (const tiles of this.textures) tiles.dispose();
    for (const material of this.materials.values()) material.dispose();
  }
}
