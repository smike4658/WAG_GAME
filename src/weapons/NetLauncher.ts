import * as THREE from 'three';

/**
 * Net projectile configuration
 */
interface NetConfig {
  range: number;           // Max distance in meters
  speed: number;           // Projectile speed
  cooldown: number;        // Seconds between shots
  radius: number;          // Projectile size
  catchRadius: number;     // Radius for catching employees
}

const DEFAULT_CONFIG: NetConfig = {
  range: 10,           // Shotgun style - must get close
  speed: 20,           // Slightly slower
  cooldown: 1,
  radius: 0.3,
  catchRadius: 1.5,    // Smaller but still fair
};

/**
 * Active net projectile
 */
interface NetProjectile {
  mesh: THREE.Mesh;
  startPosition: THREE.Vector3;
  direction: THREE.Vector3;
  distanceTraveled: number;
  active: boolean;
}

/**
 * Callback when net hits an employee
 */
type OnCatchCallback = (employeeId: string, position: THREE.Vector3) => void;

/**
 * NetLauncher - throws nets to catch employees
 * Features: 20m range, 1s cooldown, expanding net visual
 */
export class NetLauncher {
  private readonly config: NetConfig;
  private readonly scene: THREE.Scene;
  private readonly projectiles: NetProjectile[] = [];

  private cooldownTimer = 0;
  private onCatch: OnCatchCallback | null = null;

  // Powerup modifier for catch radius
  private catchRadiusMultiplier = 1.0;

  // Visual materials
  private readonly netMaterial: THREE.MeshStandardMaterial;
  private readonly netGeometry: THREE.SphereGeometry;

  constructor(scene: THREE.Scene, config: Partial<NetConfig> = {}) {
    this.scene = scene;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Create reusable geometry and material
    this.netGeometry = new THREE.SphereGeometry(this.config.radius, 8, 6);
    this.netMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ff88,
      emissive: 0x004422,
      emissiveIntensity: 0.3,
      wireframe: true,
      transparent: true,
      opacity: 0.8,
    });
  }

  /**
   * Set callback for when net catches something
   */
  public setOnCatch(callback: OnCatchCallback): void {
    this.onCatch = callback;
  }

  /**
   * Try to fire a net projectile
   */
  public fire(position: THREE.Vector3, direction: THREE.Vector3): boolean {
    // Check cooldown
    if (this.cooldownTimer > 0) {
      return false;
    }

    // Create projectile mesh
    const mesh = new THREE.Mesh(this.netGeometry.clone(), this.netMaterial.clone());
    mesh.position.copy(position);
    mesh.castShadow = true;
    this.scene.add(mesh);

    // Create projectile record
    const projectile: NetProjectile = {
      mesh,
      startPosition: position.clone(),
      direction: direction.clone().normalize(),
      distanceTraveled: 0,
      active: true,
    };

    this.projectiles.push(projectile);

    // Start cooldown
    this.cooldownTimer = this.config.cooldown;

    console.log('[NetLauncher] Fired net from', position.toArray());

    return true;
  }

  /**
   * Update projectiles each frame
   */
  public update(deltaTime: number, employeePositions: Map<string, THREE.Vector3>): void {
    // Update cooldown
    if (this.cooldownTimer > 0) {
      this.cooldownTimer -= deltaTime;
    }

    // Update each projectile
    for (const projectile of this.projectiles) {
      if (!projectile.active) continue;

      // Move projectile
      const moveDistance = this.config.speed * deltaTime;
      projectile.mesh.position.add(
        projectile.direction.clone().multiplyScalar(moveDistance)
      );

      // Calculate distance traveled
      projectile.distanceTraveled = projectile.mesh.position.distanceTo(
        projectile.startPosition
      );

      // Expand net visual as it travels
      const expandFactor = 1 + (projectile.distanceTraveled / this.config.range) * 2;
      projectile.mesh.scale.setScalar(expandFactor);

      // Check max range
      if (projectile.distanceTraveled >= this.config.range) {
        this.deactivateProjectile(projectile);
        continue;
      }

      // Check if hit ground
      if (projectile.mesh.position.y < 0.1) {
        this.deactivateProjectile(projectile);
        continue;
      }

      // Check for employee catches
      const effectiveCatchRadius = this.config.catchRadius * this.catchRadiusMultiplier;
      for (const [id, employeePos] of employeePositions) {
        const distance = projectile.mesh.position.distanceTo(employeePos);
        if (distance < effectiveCatchRadius) {
          console.log(`[NetLauncher] Caught employee ${id}!`);
          if (this.onCatch) {
            this.onCatch(id, employeePos);
          }
          this.deactivateProjectile(projectile);
          break;
        }
      }
    }

    // Clean up inactive projectiles
    this.cleanupProjectiles();
  }

  /**
   * Deactivate a projectile (visual effect + removal)
   */
  private deactivateProjectile(projectile: NetProjectile): void {
    if (!projectile.active) return;

    projectile.active = false;

    // Create catch effect
    this.createCatchEffect(projectile.mesh.position);

    // Remove from scene
    this.scene.remove(projectile.mesh);
    projectile.mesh.geometry.dispose();
    if (projectile.mesh.material instanceof THREE.Material) {
      projectile.mesh.material.dispose();
    }
  }

  /**
   * Create a visual effect when net lands/catches
   */
  private createCatchEffect(position: THREE.Vector3): void {
    // Create expanding ring effect
    const ringGeometry = new THREE.RingGeometry(0.1, 0.5, 16);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });

    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.position.copy(position);
    ring.rotation.x = -Math.PI / 2;
    this.scene.add(ring);

    // Animate and remove
    const startTime = performance.now();
    const duration = 500;

    const animate = (): void => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      ring.scale.setScalar(1 + progress * 3);
      ringMaterial.opacity = 0.8 * (1 - progress);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.scene.remove(ring);
        ringGeometry.dispose();
        ringMaterial.dispose();
      }
    };

    animate();
  }

  /**
   * Remove inactive projectiles from array
   */
  private cleanupProjectiles(): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];
      if (projectile && !projectile.active) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  /**
   * Check if weapon is ready to fire
   */
  public canFire(): boolean {
    return this.cooldownTimer <= 0;
  }

  /**
   * Get cooldown progress (0-1, 1 = ready)
   */
  public getCooldownProgress(): number {
    if (this.cooldownTimer <= 0) return 1;
    return 1 - this.cooldownTimer / this.config.cooldown;
  }

  /**
   * Get active projectile count
   */
  public getActiveProjectileCount(): number {
    return this.projectiles.filter((p) => p.active).length;
  }

  /**
   * Set catch radius multiplier (for super net powerup)
   */
  public setCatchRadiusMultiplier(multiplier: number): void {
    this.catchRadiusMultiplier = multiplier;
    console.log(`[NetLauncher] Catch radius multiplier set to ${multiplier}`);
  }

  /**
   * Get current catch radius multiplier
   */
  public getCatchRadiusMultiplier(): number {
    return this.catchRadiusMultiplier;
  }
}
