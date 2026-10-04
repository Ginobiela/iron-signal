import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, Scene } from 'three';
import { PARALLAX } from '../config/constants';

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

  constructor(scene: Scene) {
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
    for (const layer of this.layers) {
      for (let copy = -1; copy <= 1; copy++) {
        const x0 = copy * PERIOD;
        if (layer.speed === PARALLAX.background) {
          for (let i = 0; i < 8; i++) rect(layer.root, x0 + i * 64, 85, 64, 32 + (i * 13) % 40, 0x202c3b, -6);
          rect(layer.root, x0 + 186, 172, 20, 20, 0xc0bb9b, -6);
        } else if (layer.speed === PARALLAX.midground) {
          for (let i = 0; i < 12; i++) {
            const h = 40 + (i * 17) % 50;
            rect(layer.root, x0 + i * 44, 44, 24, h, 0x273b49, -4);
            rect(layer.root, x0 + i * 44 + 4, 50, 2, h - 8, 0x355160, -3.9);
          }
        } else {
          rect(layer.root, x0, 218, PERIOD, 2, 0x293e49, 6);
          for (let i = 0; i < 8; i++) rect(layer.root, x0 + i * 64, 218, 2, 22, 0x293e49, 6);
        }
      }
      scene.add(layer.root);
    }
  }

  update(cameraX: number): void {
    for (const layer of this.layers) layer.root.position.x = parallaxPosition(cameraX, layer.speed);
  }

  dispose(): void {
    this.geometry.dispose();
    for (const material of this.materials.values()) material.dispose();
  }
}
