import { Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import type { Enemy } from '../entities/enemies/Enemy';
import { ENEMY_VISUALS } from '../config/graphics';
import { FlyingCargoVisual } from './FlyingCargoVisual';
import type { AssetManager } from '../core/AssetManager';
import { SpriteVisual } from './SpriteVisual';
import { DRAW, GRAPHICS } from '../config/assets';
import { Soldier } from '../entities/enemies/Soldier';
import { Turret } from '../entities/enemies/Turret';

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
  private readonly cargo: FlyingCargoVisual | null;
  private readonly sprite: SpriteVisual;
  private debugVisible = false;
  private lastAttackTimer: number;
  private shootPoseTimer = 0;

  constructor(private readonly enemy: Enemy, private readonly assets: AssetManager,
    private readonly onVisualFire?: (enemy: Enemy) => void) {
    const visual = ENEMY_VISUALS[enemy.kind];
    this.lastAttackTimer = this.readAttackTimer();
    this.sprite = new SpriteVisual(assets, visual, `${enemy.kind}.${enemy.kind === 'flying' ? 'fly' : enemy.kind === 'runner' ? 'run' : 'idle'}`);
    this.sprite.setEntityOrigin(-enemy.width / 2, visual.anchor === 'center' ? -enemy.height / 2 : 0);
    this.root.add(this.sprite.root);
    this.armor = new MeshBasicMaterial({ color: enemy.color });
    this.barrel = new MeshBasicMaterial({ color: 0xe4dbc5 });
    const dark = new MeshBasicMaterial({ color: 0x1a2531 });
    const red = new MeshBasicMaterial({ color: 0xff776b });
    const outline = new MeshBasicMaterial({ color: 0xff8a7b, wireframe: true });
    this.materials = [this.armor, this.barrel, dark, red, outline];
    const rect = (parent: Group, x: number, y: number, w: number, h: number,
      material: MeshBasicMaterial, z: number = DRAW.level): Mesh => {
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
      rect(this.body, 1, 20, 4, 2, red, DRAW.detail);
    } else if (enemy.kind === 'runner') {
      this.legs.push(rect(this.body, -7, 0, 4, 5, dark), rect(this.body, 3, 0, 4, 5, dark));
      rect(this.body, -7, 5, 14, 9, this.armor);
      rect(this.body, 3, 11, 4, 3, red, DRAW.detail);
      rect(this.body, -4, 14, 2, 2, this.armor);
    } else if (enemy.kind === 'turret') {
      rect(this.body, -10, 0, 20, 6, dark);
      rect(this.body, -7, 6, 14, 14, this.armor);
      rect(this.body, -3, 12, 6, 4, red, DRAW.detail);
    } else {
      rect(this.body, -10, 5, 20, 4, dark);
      rect(this.body, -6, 2, 12, 10, this.armor);
      rect(this.body, -3, 0, 6, 2, red);
      rect(this.body, -3, 12, 6, 2, this.armor);
    }
    rect(this.gun, 0, -1.5, enemy.width / 2 + 4, 3, this.barrel);
    this.gun.position.set(0, enemy.gunPivotY, DRAW.trim);
    this.gun.visible = enemy.kind === 'soldier' || enemy.kind === 'turret';
    this.bounds = rect(this.root, -enemy.width / 2, 0, enemy.width, enemy.height, outline, DRAW.collider);
    this.bounds.visible = false;
    this.healthTrack = rect(this.root, -enemy.width / 2, enemy.height + 4, enemy.width, 2, dark, DRAW.overlay);
    this.healthBar = rect(this.root, -enemy.width / 2, enemy.height + 4, enemy.width, 2, red, DRAW.collider);
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
    this.cargo = enemy.weaponDrop ? new FlyingCargoVisual(assets) : null;
    if (this.cargo && enemy.weaponDrop) {
      this.cargo.setKind(enemy.weaponDrop);
      this.cargo.root.position.set(0, -visual.height / 2 - 6, DRAW.overlay);
      this.root.add(this.cargo.root);
    }
    this.root.position.z = DRAW.entity;
    this.root.visible = false;
  }

  update(dt: number): void {
    const enemy = this.enemy;
    const attackTimer = this.readAttackTimer();
    this.shootPoseTimer = Math.max(0, this.shootPoseTimer - dt);
    if (enemy.alive && attackTimer > this.lastAttackTimer) {
      this.shootPoseTimer = GRAPHICS.shootPoseTime;
      this.onVisualFire?.(enemy);
    }
    this.lastAttackTimer = attackTimer;
    const animation = !enemy.alive ? 'death' : enemy.kind === 'flying'
      ? (enemy.hitFlashTimer > 0 ? 'hit' : 'fly') : enemy.warning || this.shootPoseTimer > 0 ? 'shoot' : enemy.velocity.x !== 0 ? 'run' : 'idle';
    const hasSprite = this.sprite.update(`${enemy.kind}.${animation}`, dt, enemy.direction < 0,
      enemy.alive ? `${enemy.kind}.${enemy.kind === 'flying' ? 'fly' : enemy.kind === 'runner' ? 'run' : 'idle'}` : '');
    this.root.visible = enemy.alive ? enemy.active : hasSprite && !this.sprite.animator.completed;
    this.body.visible = !hasSprite;
    this.sprite.tint(enemy.alive && enemy.hitFlashTimer > 0 ? 0xfff3c4 : 0xffffff);
    this.gun.visible = enemy.alive && (enemy.kind === 'soldier' || enemy.kind === 'turret')
      && (!hasSprite || !this.assets.getSpriteSheet(this.sprite.assetId)?.includesWeapon);
    this.bounds.visible = this.debugVisible && enemy.alive;
    this.healthBar.visible = this.healthTrack.visible = enemy.alive && enemy.health < enemy.maxHealth;
    if (this.cargo) { this.cargo.root.visible = enemy.alive; this.cargo.update(dt); }
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
    this.healthBar.scale.x = enemy.width * enemy.health / enemy.maxHealth;
    this.healthBar.position.x = -enemy.width / 2 + this.healthBar.scale.x / 2;
  }

  private readAttackTimer(): number {
    return this.enemy instanceof Soldier || this.enemy instanceof Turret ? this.enemy.attackTimer : 0;
  }

  setDebug(visible: boolean): void {
    this.debugVisible = visible; this.bounds.visible = visible && this.enemy.alive;
  }

  setGraphicsDebug(visible: boolean): void { this.sprite.setDebug(visible); this.cargo?.setGraphicsDebug(visible); }

  dispose(): void {
    this.geometry.dispose();
    this.sprite.dispose();
    for (const material of this.materials) material.dispose();
    this.cargo?.dispose();
  }
}
