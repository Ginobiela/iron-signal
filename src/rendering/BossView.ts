import { Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import { BOSS } from '../config/constants';
import type { Boss } from '../bosses/Boss';
import type { AssetManager } from '../core/AssetManager';
import { SpriteVisual } from './SpriteVisual';
import { DRAW } from '../config/assets';

export class BossView {
  readonly root = new Group();
  private readonly placeholder = new Group();
  private readonly sprite: SpriteVisual;
  private readonly geometry = new PlaneGeometry(1, 1);
  private readonly armor = new MeshBasicMaterial({ color: 0x456260 });
  private readonly core = new MeshBasicMaterial({ color: 0x99edff });
  private readonly dark = new MeshBasicMaterial({ color: 0x172631 });
  private readonly outline = new MeshBasicMaterial({ color: 0xff8a7b, wireframe: true });
  private readonly highMaterial = new MeshBasicMaterial({ color: 0xe4dbc5 });
  private readonly lowMaterial = new MeshBasicMaterial({ color: 0xe4dbc5 });
  private readonly gun = new Group();
  private readonly shutters: Mesh[] = [];
  private readonly bounds: Mesh;

  constructor(private readonly boss: Boss, assets: AssetManager) {
    this.sprite = new SpriteVisual(assets, { width: 56, height: 72, offsetX: 0, offsetY: 0, anchor: 'bottom-center' });
    this.sprite.root.position.x = boss.width / 2;
    this.sprite.setEntityOrigin(-boss.width / 2, 0);
    this.root.add(this.placeholder, this.sprite.root);
    const rect = (parent: Group, x: number, y: number, width: number, height: number,
      material: MeshBasicMaterial, z: number = DRAW.level): Mesh => {
      const mesh = new Mesh(this.geometry, material);
      mesh.position.set(x + width / 2, y + height / 2, z);
      mesh.scale.set(width, height, 1);
      parent.add(mesh);
      return mesh;
    };
    rect(this.placeholder, 0, 0, BOSS.width, 8, this.dark);
    rect(this.placeholder, 0, 8, 10, 58, this.armor);
    rect(this.placeholder, 46, 8, 10, 58, this.armor);
    rect(this.placeholder, 8, 64, 40, 8, this.armor);
    rect(this.placeholder, 10, 10, 36, 54, this.dark);
    rect(this.placeholder, 14, 16, 28, 36, this.core, DRAW.detail);
    for (let y = 19; y < 52; y += 8) rect(this.placeholder, 18, y, 20, 2, this.dark, DRAW.trim);
    this.shutters.push(rect(this.placeholder, 12, 12, 16, 48, this.armor, DRAW.overlay),
      rect(this.placeholder, 28, 12, 16, 48, this.armor, DRAW.overlay));
    rect(this.placeholder, -4, BOSS.highHeight - 2, 14, 4, this.highMaterial, DRAW.collider);
    rect(this.placeholder, -4, BOSS.lowHeight - 2, 14, 4, this.lowMaterial, DRAW.collider);
    rect(this.gun, 0, -2, 10, 4, this.core, DRAW.topDetail);
    this.gun.position.set(0, BOSS.aimedHeight, 0);
    this.placeholder.add(this.gun);
    this.bounds = rect(this.root, 0, 0, BOSS.width, BOSS.height, this.outline, DRAW.topDetail);
    this.bounds.visible = false;
    this.root.position.set(boss.position.x, boss.position.y, DRAW.entity);
    this.root.visible = false;
  }

  update(dt = 0): void {
    this.root.visible = this.boss.state !== 'DORMANT';
    if (!this.root.visible) return;
    const dead = !this.boss.alive;
    const animation = dead ? 'death' : this.boss.hitFlashTimer > 0 ? 'damage'
      : this.boss.state === 'ATTACK' || this.boss.state === 'TELEGRAPH' ? 'attack' : 'idle';
    this.placeholder.visible = !this.sprite.update(`boss.${animation}`, dt, false, dead ? '' : 'boss.idle');
    if (dead && this.sprite.available && this.sprite.animator.completed) this.root.visible = false;
    const flash = this.boss.hitFlashTimer > 0 || this.boss.shieldFlashTimer > 0;
    this.armor.color.setHex(flash ? 0xfff3c4 : dead ? 0x273b49 : 0x456260);
    this.core.color.setHex(dead ? 0x172631 : this.boss.vulnerable ? 0xffe3a2
      : this.boss.phase === 3 ? 0xff776b : this.boss.phase === 2 ? 0xb09bd5 : 0x99edff);
    for (const shutter of this.shutters) shutter.visible = !this.boss.vulnerable && !dead;
    this.highMaterial.color.setHex(this.boss.state === 'TELEGRAPH' && this.boss.pattern === 'HIGH' ? 0xff776b : 0xe4dbc5);
    this.lowMaterial.color.setHex(this.boss.state === 'TELEGRAPH' && this.boss.pattern === 'LOW' ? 0xff776b : 0xe4dbc5);
    this.gun.visible = !dead && this.boss.pattern === 'AIMED';
    this.gun.rotation.z = Math.atan2(this.boss.aimDirection.y, this.boss.aimDirection.x);
  }

  setDebug(visible: boolean): void { this.bounds.visible = visible; }
  setGraphicsDebug(visible: boolean): void { this.sprite.setDebug(visible); }

  dispose(): void {
    this.geometry.dispose();
    this.sprite.dispose();
    for (const material of [this.armor, this.core, this.dark, this.outline, this.highMaterial, this.lowMaterial]) material.dispose();
  }
}
