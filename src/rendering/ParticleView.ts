import { Color, DynamicDrawUsage, InstancedMesh, MeshBasicMaterial, Object3D, PlaneGeometry } from 'three';
import type { ParticleManager } from './ParticleManager';

export class ParticleView {
  readonly mesh: InstancedMesh;
  private readonly geometry = new PlaneGeometry(1, 1);
  private readonly material = new MeshBasicMaterial();
  private readonly transform = new Object3D();
  private readonly color = new Color();

  constructor(private readonly particles: ParticleManager) {
    this.mesh = new InstancedMesh(this.geometry, this.material, particles.items.length);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    for (let i = 0; i < particles.items.length; i++) this.mesh.setColorAt(i, this.color);
    this.mesh.instanceColor?.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }

  update(): void {
    let count = 0;
    for (const particle of this.particles.items) {
      if (particle.life <= 0) continue;
      this.transform.position.set(Math.round(particle.x), Math.round(particle.y), 5);
      const size = particle.life < particle.duration * 0.3 ? 1 : particle.size;
      this.transform.scale.set(size, size, 1);
      this.transform.updateMatrix();
      this.mesh.setMatrixAt(count, this.transform.matrix);
      this.mesh.setColorAt(count++, this.color.setHex(particle.color));
    }
    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  dispose(): void { this.mesh.dispose(); this.geometry.dispose(); this.material.dispose(); }
}
