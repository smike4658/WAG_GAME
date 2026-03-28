import * as THREE from 'three';

/**
 * AtmosphereParticles - Floating dust/pollen particles for visual depth
 * Creates a volume of gently drifting particles around the camera
 */
export class AtmosphereParticles {
  private readonly points: THREE.Points;
  private readonly velocities: Float32Array;
  private readonly count: number;
  private readonly spread: number;
  private time = 0;

  constructor(scene: THREE.Scene, count: number = 200, spread: number = 60) {
    this.count = count;
    this.spread = spread;

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * spread;
      positions[i3 + 1] = Math.random() * 20 + 1; // 1-21m height
      positions[i3 + 2] = (Math.random() - 0.5) * spread;

      // Slow random drift
      this.velocities[i3] = (Math.random() - 0.5) * 0.3;
      this.velocities[i3 + 1] = (Math.random() - 0.5) * 0.1;
      this.velocities[i3 + 2] = (Math.random() - 0.5) * 0.3;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.08,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  /**
   * Update particles - keep them centered around camera
   */
  public update(deltaTime: number, cameraPosition: THREE.Vector3): void {
    this.time += deltaTime;
    const posAttr = this.points.geometry.getAttribute('position') as THREE.BufferAttribute;
    const positions = posAttr.array as Float32Array;

    const halfSpread = this.spread / 2;

    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;

      // Gentle drift + sine wave for organic motion
      positions[i3]! += this.velocities[i3]! * deltaTime + Math.sin(this.time + i) * 0.002;
      positions[i3 + 1]! += this.velocities[i3 + 1]! * deltaTime + Math.sin(this.time * 0.5 + i * 0.7) * 0.003;
      positions[i3 + 2]! += this.velocities[i3 + 2]! * deltaTime + Math.cos(this.time + i * 0.3) * 0.002;

      // Wrap around camera position
      if (positions[i3]! > cameraPosition.x + halfSpread) positions[i3]! -= this.spread;
      if (positions[i3]! < cameraPosition.x - halfSpread) positions[i3]! += this.spread;
      if (positions[i3 + 1]! > 22) positions[i3 + 1]! = 1;
      if (positions[i3 + 1]! < 0) positions[i3 + 1]! = 21;
      if (positions[i3 + 2]! > cameraPosition.z + halfSpread) positions[i3 + 2]! -= this.spread;
      if (positions[i3 + 2]! < cameraPosition.z - halfSpread) positions[i3 + 2]! += this.spread;
    }

    posAttr.needsUpdate = true;
  }

  public dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
    this.points.parent?.remove(this.points);
  }
}
