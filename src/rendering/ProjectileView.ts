import { Color, DynamicDrawUsage, InstancedMesh, MeshBasicMaterial, Object3D, PlaneGeometry } from 'three';
import { LASER, PROJECTILES } from '../config/constants';
import type { ProjectileManager } from '../projectiles/ProjectileManager';

export class ProjectileView {
  readonly mesh: InstancedMesh;
  readonly bounds: InstancedMesh;
  private readonly geometry = new PlaneGeometry(PROJECTILES.size, PROJECTILES.size);
  private readonly material = new MeshBasicMaterial({ color: 0xffffff });
  private readonly boundsMaterial = new MeshBasicMaterial({ color: 0xe7a2ff, wireframe: true });
  private readonly playerColor = new Color(0xffe3a2);
  private readonly enemyColor = new Color(0xff776b);
  private readonly laserColor = new Color(0x99edff);
  private readonly transform = new Object3D();

  constructor(capacity: number) {
    this.mesh = new InstancedMesh(this.geometry, this.material, capacity);
    this.bounds = new InstancedMesh(this.geometry, this.boundsMaterial, capacity);
    this.bounds.instanceMatrix.setUsage(DynamicDrawUsage);
    this.bounds.frustumCulled = false;
    this.bounds.visible = false;
    this.bounds.count = 0;
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.count = 0;
    for (let i = 0; i < capacity; i++) this.mesh.setColorAt(i, this.playerColor);
    this.mesh.instanceColor?.setUsage(DynamicDrawUsage);
    // Positions change across the entire level; the initial bounds are not valid for culling.
    this.mesh.frustumCulled = false;
  }

  update(projectiles: ProjectileManager): void {
    let count = 0;
    for (const projectile of projectiles.items) {
      if (!projectile.active) continue;
      this.transform.position.set(Math.round(projectile.position.x), Math.round(projectile.position.y), 4);
      this.transform.scale.set(projectile.style === 'laser' ? LASER.visualLength / PROJECTILES.size : 1, 1, 1);
      this.transform.rotation.z = projectile.style === 'laser'
        ? Math.atan2(projectile.velocity.y, projectile.velocity.x) : 0;
      this.transform.updateMatrix();
      this.mesh.setMatrixAt(count, this.transform.matrix);
      this.mesh.setColorAt(count, projectile.owner === 'enemy' ? this.enemyColor
        : projectile.style === 'laser' ? this.laserColor : this.playerColor);
      this.transform.scale.set(1, 1, 1);
      this.transform.rotation.z = 0;
      this.transform.position.z = 5.1;
      this.transform.updateMatrix();
      this.bounds.setMatrixAt(count++, this.transform.matrix);
    }
    this.mesh.count = count;
    this.bounds.count = count;
    this.bounds.instanceMatrix.needsUpdate = true;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.dispose();
    this.bounds.dispose();
    this.boundsMaterial.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }

  setDebug(visible: boolean): void { this.bounds.visible = visible; }
}
