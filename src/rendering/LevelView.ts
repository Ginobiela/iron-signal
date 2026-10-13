import { Mesh, MeshBasicMaterial, PlaneGeometry, Scene } from 'three';
import type { Level } from '../level/Level';
import type { AssetManager } from '../core/AssetManager';
import { DRAW } from '../config/assets';
import { EnvironmentView } from './EnvironmentView';

export class LevelView {
  private readonly geometry = new PlaneGeometry(1, DRAW.levelSurface);
  private readonly materials = new Map<number, MeshBasicMaterial>();
  private readonly debugMaterial = new MeshBasicMaterial({ color: 0x82ff96, wireframe: true });
  private readonly debugMeshes: Mesh[] = [];
  private readonly environment: EnvironmentView;
  private readonly exitMaterial = new MeshBasicMaterial({ color: 0xa0dbcb });
  private readonly pursuit: boolean;
  private gate?: Mesh;

  constructor(scene: Scene, level: Level, assets: AssetManager) {
    this.pursuit = !!level.data.boss.encounter;
    this.environment = new EnvironmentView(assets, level.data);
    scene.add(this.environment.root);
    const rect = (x: number, y: number, w: number, h: number, color: number, z: number = DRAW.level): Mesh => {
      let material = this.materials.get(color);
      if (!material) {
        material = new MeshBasicMaterial({ color });
        this.materials.set(color, material);
      }
      const mesh = new Mesh(this.geometry, material);
      mesh.position.set(x + w / 2, y + h / 2, z);
      mesh.scale.set(w, h, 1);
      scene.add(mesh);
      return mesh;
    };

    for(const hazard of level.data.killZones??[])rect(hazard.x,hazard.y,hazard.width,hazard.height,0xa63b4e,DRAW.levelSurface+DRAW.detail);
    for (const solid of level.solids) {
      if (level.data.automaticTerrain !== false) this.environment.addGround(solid);
      rect(solid.x, solid.y, solid.width, solid.height, level.data.environmentSkin ? 0x253449 : 0x456260);
      rect(solid.x, solid.y + solid.height - 4, solid.width, 4, level.data.environmentSkin ? 0x688da0 : 0x8ca18b, DRAW.levelSurface);
      const bounds = new Mesh(this.geometry, this.debugMaterial);
      bounds.position.set(solid.x + solid.width / 2, solid.y + solid.height / 2, DRAW.debug);
      bounds.scale.set(solid.width, solid.height, 1);
      bounds.visible = false;
      this.debugMeshes.push(bounds);
      scene.add(bounds);
    }
    for (const platform of level.oneWays) {
      if (level.data.automaticTerrain !== false) this.environment.addPlatform(platform);
      rect(platform.x, platform.y, platform.width, platform.height, 0x407e85, DRAW.levelSurface);
      rect(platform.x, platform.y + platform.height - 2, platform.width, 2, 0xa0dbcb, DRAW.levelSurface + DRAW.detail);
      for (let x = platform.x + 4; x < platform.x + platform.width; x += 8) {
        rect(x, platform.y, 2, platform.height - 2, 0x172631, DRAW.levelSurface + DRAW.detail);
      }
      const bounds = new Mesh(this.geometry, this.debugMaterial);
      bounds.position.set(platform.x + platform.width / 2, platform.y + platform.height / 2, DRAW.debug);
      bounds.scale.set(platform.width, platform.height, 1);
      bounds.visible = false;
      this.debugMeshes.push(bounds);
      scene.add(bounds);
    }
    for (const ground of level.data.ground) {
      for (let x = ground.x; x < ground.x + ground.width; x += 32) rect(x, ground.y+8, 1, 22, 0x2b404b, DRAW.levelSurface);
      if (ground.x > 0) rect(ground.x, ground.y+ground.height - 4, 6, 4, 0xde7967, DRAW.levelSurface + DRAW.detail);
      if (ground.x + ground.width < level.data.width) rect(ground.x + ground.width - 6, ground.y+ground.height - 4, 6, 4, 0xde7967, DRAW.levelSurface + DRAW.detail);
    }
    for (const [x,y,w,h] of [[level.data.exitX,level.data.exitArea?.y??44,6,64],[level.data.exitX+42,level.data.exitArea?.y??44,6,64],[level.data.exitX,(level.data.exitArea?.y??44)+58,48,6]] as const) {
      rect(x,y,w,h,0xa0dbcb,DRAW.levelSurface).material = this.exitMaterial;
    }
    if (level.data.boss.encounter) {
      this.gate = rect(level.data.boss.encounter.barrierX,44,6,112,0xff776b,DRAW.decoration);
      this.gate.visible = false;
    }
    rect(14, 44, 25, 23, 0x415c61, DRAW.levelSurface);
    rect(17, 47, 19, 17, 0x293e49, DRAW.decoration);
    rect(19, 54, 15, 3, 0xc0a16a, DRAW.entity);
    rect(92, 44, 2, 29, 0x99c0ba, DRAW.decoration);
    rect(94, 64, 9, 9, 0xd99758, DRAW.decoration);
  }

  update(dt: number, encounterActive = false, exitOpen = false): void {
    this.environment.update(dt);
    if (this.gate) this.gate.visible = encounterActive;
    if (this.pursuit) this.exitMaterial.color.setHex(exitOpen ? 0x99edaa : 0x6c4853);
  }

  setGraphicsDebug(visible: boolean): void {
    this.environment.setDebug(visible);
  }

  setDebug(visible: boolean): void {
    for (const bounds of this.debugMeshes) bounds.visible = visible;
  }

  dispose(): void {
    this.environment.dispose();
    this.geometry.dispose();
    this.debugMaterial.dispose();
    this.exitMaterial.dispose();
    for (const material of this.materials.values()) material.dispose();
    this.materials.clear();
  }
}
