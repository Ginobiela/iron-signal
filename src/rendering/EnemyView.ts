import { Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import type { Enemy } from '../entities/enemies/Enemy';
import { ENEMY_VISUALS } from '../config/graphics';
import { PowerupIcon } from './PowerupIcon';

const placeholderSize = {
  soldier: { width: 12, height: 24 }, runner: { width: 14, height: 16 },
  turret: { width: 20, height: 20 }, flying: { width: 20, height: 14 },
} as const;

export class EnemyView {
  readonly root = new Group();
  private readonly body = new Group();
  private readonly gun = new Group();
  private readonly geometry = new PlaneGeometry(1, 1);
  private readonly armor: MeshBasicMaterial;
  private readonly barrel: MeshBasicMaterial;
  private readonly materials: MeshBasicMaterial[];
  private readonly legs: Mesh[] = [];
  private readonly bounds: Mesh;
  private readonly healthBar: Mesh;
  private readonly healthTrack: Mesh;
  private elapsed = 0;
  private readonly cargo: PowerupIcon | null;

  constructor(private readonly enemy: Enemy) {
    const visual = ENEMY_VISUALS[enemy.kind];
    this.armor = new MeshBasicMaterial({ color: enemy.color });
    this.barrel = new MeshBasicMaterial({ color: 0xe4dbc5 });
    const dark = new MeshBasicMaterial({ color: 0x1a2531 });
    const red = new MeshBasicMaterial({ color: 0xff776b });
    const outline = new MeshBasicMaterial({ color: 0xff8a7b, wireframe: true });
    this.materials = [this.armor, this.barrel, dark, red, outline];
    const rect = (parent: Group, x: number, y: number, w: number, h: number,
      material: MeshBasicMaterial, z = 0): Mesh => {
      const mesh = new Mesh(this.geometry, material);
      mesh.position.set(x + w / 2, y + h / 2, z);
      mesh.scale.set(w, h, 1);
      parent.add(mesh);
      return mesh;
    };
    if (enemy.kind === 'soldier') {
      this.legs.push(rect(this.body, -6, 0, 4, 8, dark), rect(this.body, 2, 0, 4, 8, dark));
      rect(this.body, -6, 8, 12, 10, this.armor);
      rect(this.body, -4, 18, 8, 6, this.armor);
      rect(this.body, 1, 20, 4, 2, red, 0.1);
    } else if (enemy.kind === 'runner') {
      this.legs.push(rect(this.body, -7, 0, 4, 5, dark), rect(this.body, 3, 0, 4, 5, dark));
      rect(this.body, -7, 5, 14, 9, this.armor);
      rect(this.body, 3, 11, 4, 3, red, 0.1);
      rect(this.body, -4, 14, 2, 2, this.armor);
    } else if (enemy.kind === 'turret') {
      rect(this.body, -10, 0, 20, 6, dark);
      rect(this.body, -7, 6, 14, 14, this.armor);
      rect(this.body, -3, 12, 6, 4, red, 0.1);
    } else {
      rect(this.body, -10, 5, 20, 4, dark);
      rect(this.body, -6, 2, 12, 10, this.armor);
      rect(this.body, -3, 0, 6, 2, red);
      rect(this.body, -3, 12, 6, 2, this.armor);
    }
    rect(this.gun, 0, -1.5, enemy.width / 2 + 4, 3, this.barrel);
    this.gun.position.set(0, enemy.gunPivotY, 0.2);
    this.gun.visible = enemy.kind === 'soldier' || enemy.kind === 'turret';
    this.bounds = rect(this.root, -enemy.width / 2, 0, enemy.width, enemy.height, outline, 0.4);
    this.bounds.visible = false;
    this.healthTrack = rect(this.root, -enemy.width / 2, enemy.height + 4, enemy.width, 2, dark, 0.3);
    this.healthBar = rect(this.root, -enemy.width / 2, enemy.height + 4, enemy.width, 2, red, 0.4);
    this.root.add(this.body, this.gun);
    const source = placeholderSize[enemy.kind];
    this.body.scale.set(visual.width / source.width, visual.height / source.height, 1);
    this.body.position.set(visual.offsetX, visual.offsetY, 0);
    if (visual.anchor === 'center') {
      this.body.position.y -= visual.height / 2;
      this.gun.position.y -= enemy.height / 2;
      this.bounds.position.y -= enemy.height / 2;
      this.healthTrack.position.y -= enemy.height / 2;
      this.healthBar.position.y -= enemy.height / 2;
    }
    this.cargo = enemy.weaponDrop ? new PowerupIcon() : null;
    if (this.cargo && enemy.weaponDrop) {
      this.cargo.setKind(enemy.weaponDrop);
      this.cargo.root.scale.multiplyScalar(0.7);
      this.cargo.root.position.set(0, -visual.height / 2 - 10, 0.3);
      this.root.add(this.cargo.root);
    }
    this.root.position.z = 3;
    this.root.visible = false;
  }

  update(dt: number): void {
    const enemy = this.enemy;
    this.root.visible = enemy.active && enemy.alive;
    if (!this.root.visible) return;
    this.elapsed += dt;
    const visual = ENEMY_VISUALS[enemy.kind];
    this.root.position.x = Math.round(enemy.position.x + enemy.width / 2);
    this.root.position.y = Math.round(enemy.position.y + (visual.anchor === 'center' ? enemy.height / 2 : 0));
    this.body.scale.x = enemy.direction * visual.width / placeholderSize[enemy.kind].width;
    this.gun.rotation.z = Math.atan2(enemy.aimDirection.y, enemy.aimDirection.x);
    this.armor.color.setHex(enemy.hitFlashTimer > 0 ? 0xfff3c4 : enemy.color);
    this.barrel.color.setHex(enemy.warning ? 0xff776b : 0xe4dbc5);
    for (let i = 0; i < this.legs.length; i++) {
      const leg = this.legs[i];
      if (leg) leg.position.y = (enemy.kind === 'runner' ? 2.5 : 4)
        + (enemy.velocity.x !== 0 ? Math.sin(this.elapsed * 20 + i * Math.PI) * 1.5 : 0);
    }
    this.healthBar.visible = this.healthTrack.visible = enemy.health < enemy.maxHealth;
    this.healthBar.scale.x = enemy.width * enemy.health / enemy.maxHealth;
    this.healthBar.position.x = -enemy.width / 2 + this.healthBar.scale.x / 2;
  }

  setDebug(visible: boolean): void {
    this.bounds.visible = visible;
  }

  dispose(): void {
    this.geometry.dispose();
    for (const material of this.materials) material.dispose();
    this.cargo?.dispose();
  }
}
