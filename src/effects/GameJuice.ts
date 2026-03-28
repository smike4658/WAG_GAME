import * as THREE from 'three';

/**
 * GameJuice - Centralized "game feel" effects system
 * Handles screen shake, slow-mo, flash, floating text, FOV effects, particles
 */

// ─── Screen Shake ──────────────────────────────────────────────

interface ShakeState {
  intensity: number;
  duration: number;
  elapsed: number;
  offset: THREE.Vector2;
}

// ─── Slow Motion ───────────────────────────────────────────────

interface SlowMoState {
  active: boolean;
  duration: number;
  elapsed: number;
  timeScale: number;
}

// ─── FOV Effect ────────────────────────────────────────────────

interface FOVState {
  baseFOV: number;
  targetFOV: number;
  currentFOV: number;
  lerpSpeed: number;
}

// ─── Flash Overlay ─────────────────────────────────────────────

interface FlashState {
  active: boolean;
  duration: number;
  elapsed: number;
  color: string;
  maxOpacity: number;
}

// ─── Floating Text ─────────────────────────────────────────────

interface FloatingText {
  element: HTMLDivElement;
  startTime: number;
  duration: number;
}

// ─── Particle Burst ────────────────────────────────────────────

interface ParticleBurst {
  points: THREE.Points;
  velocities: Float32Array;
  startTime: number;
  duration: number;
}

export class GameJuice {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly scene: THREE.Scene;

  // Screen shake
  private shake: ShakeState = {
    intensity: 0, duration: 0, elapsed: 0,
    offset: new THREE.Vector2(),
  };

  // Slow motion
  private slowMo: SlowMoState = {
    active: false, duration: 0, elapsed: 0, timeScale: 1,
  };

  // FOV
  private fov: FOVState;

  // Flash overlay (DOM)
  private readonly flashOverlay: HTMLDivElement;
  private flash: FlashState = {
    active: false, duration: 0, elapsed: 0, color: '#ffffff', maxOpacity: 0.2,
  };

  // Floating texts (DOM)
  private readonly floatingTexts: FloatingText[] = [];

  // Particle bursts (Three.js)
  private readonly particleBursts: ParticleBurst[] = [];

  // Vignette overlay (permanent)
  private readonly vignetteOverlay: HTMLDivElement;

  // Combo system
  private catchTimes: number[] = [];
  private comboCount = 0;
  private comboTimer = 0;
  private readonly comboWindow = 10; // seconds
  private bonusTimeCallback: ((seconds: number) => void) | null = null;

  // Reusable
  private readonly _tmpVec = new THREE.Vector3();

  constructor(camera: THREE.PerspectiveCamera, scene: THREE.Scene) {
    this.camera = camera;
    this.scene = scene;

    this.fov = {
      baseFOV: camera.fov,
      targetFOV: camera.fov,
      currentFOV: camera.fov,
      lerpSpeed: 8,
    };

    // Create flash overlay
    this.flashOverlay = document.createElement('div');
    this.flashOverlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none; z-index: 100; opacity: 0;
      transition: none;
    `;
    document.body.appendChild(this.flashOverlay);

    // Create permanent vignette
    this.vignetteOverlay = document.createElement('div');
    this.vignetteOverlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none; z-index: 49;
      background: radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.4) 100%);
    `;
    document.body.appendChild(this.vignetteOverlay);
  }

  // ─── PUBLIC API ──────────────────────────────────────────────

  /**
   * Screen shake effect
   */
  public screenShake(intensity: number, duration: number): void {
    this.shake.intensity = intensity;
    this.shake.duration = duration;
    this.shake.elapsed = 0;
  }

  /**
   * Slow motion effect
   */
  public slowMotion(timeScale: number, duration: number): void {
    this.slowMo = { active: true, duration, elapsed: 0, timeScale };
  }

  /**
   * Flash the screen
   */
  public screenFlash(color: string, duration: number, opacity: number = 0.2): void {
    this.flash = { active: true, duration, elapsed: 0, color, maxOpacity: opacity };
    this.flashOverlay.style.backgroundColor = color;
    this.flashOverlay.style.opacity = String(opacity);
  }

  /**
   * Floating text that rises and fades
   */
  public floatingText(
    worldPos: THREE.Vector3,
    text: string,
    color: string = '#FFD700',
    size: number = 32,
    duration: number = 1000,
  ): void {
    // Project world position to screen
    const screenPos = this.worldToScreen(worldPos);
    if (!screenPos) return;

    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = `
      position: fixed;
      left: ${screenPos.x}px;
      top: ${screenPos.y}px;
      color: ${color};
      font-size: ${size}px;
      font-weight: 900;
      font-family: 'Segoe UI', sans-serif;
      text-shadow: 0 2px 8px rgba(0,0,0,0.8), 0 0 20px ${color}40;
      pointer-events: none;
      z-index: 200;
      transform: translate(-50%, -50%);
      transition: transform ${duration}ms ease-out, opacity ${duration * 0.6}ms ease-in ${duration * 0.4}ms;
    `;
    document.body.appendChild(el);

    // Trigger animation on next frame
    requestAnimationFrame(() => {
      el.style.transform = `translate(-50%, -50%) translateY(-80px) scale(1.3)`;
      el.style.opacity = '0';
    });

    this.floatingTexts.push({ element: el, startTime: performance.now(), duration });
  }

  /**
   * Particle burst at position
   */
  public particleBurst(
    position: THREE.Vector3,
    count: number = 20,
    color: number = 0xFFD700,
    speed: number = 5,
    duration: number = 800,
  ): void {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = position.x;
      positions[i3 + 1] = position.y + 1; // Start at waist height
      positions[i3 + 2] = position.z;

      // Random direction
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.6; // Bias upward
      const s = speed * (0.5 + Math.random() * 0.5);
      velocities[i3] = Math.sin(phi) * Math.cos(theta) * s;
      velocities[i3 + 1] = Math.cos(phi) * s + 2; // Upward bias
      velocities[i3 + 2] = Math.sin(phi) * Math.sin(theta) * s;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color,
      size: 0.15,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });

    const points = new THREE.Points(geometry, material);
    this.scene.add(points);

    this.particleBursts.push({
      points, velocities,
      startTime: performance.now(),
      duration,
    });
  }

  /**
   * Set target FOV (for sprint, powerups)
   */
  public setTargetFOV(fov: number): void {
    this.fov.targetFOV = fov;
  }

  /**
   * Reset FOV to base
   */
  public resetFOV(): void {
    this.fov.targetFOV = this.fov.baseFOV;
  }

  /**
   * FOV kick (brief change and return)
   */
  public fovKick(amount: number, duration: number = 300): void {
    this.fov.targetFOV = this.fov.baseFOV + amount;
    setTimeout(() => {
      this.fov.targetFOV = this.fov.baseFOV;
    }, duration);
  }

  // ─── CATCH JUICE (all-in-one) ───────────────────────────────

  /**
   * Full catch effect - call when employee is caught
   */
  public onCatch(employeePosition: THREE.Vector3): void {
    // Screen shake
    this.screenShake(5, 0.2);

    // Slow motion
    this.slowMotion(0.3, 0.3);

    // White flash
    this.screenFlash('#ffffff', 150, 0.15);

    // Gold particle burst
    this.particleBurst(employeePosition, 25, 0xFFD700, 4, 800);

    // Floating +1 text
    this.floatingText(employeePosition, '+1', '#FFD700', 36, 1200);

    // FOV kick
    this.fovKick(3, 200);

    // Combo tracking
    this.registerCatch();
  }

  /**
   * Net throw effect
   */
  public onNetThrow(): void {
    this.screenShake(2, 0.1);
  }

  /**
   * Powerup pickup effect
   */
  public onPowerupCollect(color: string): void {
    this.screenFlash(color, 200, 0.15);
    this.fovKick(5, 300);
  }

  // ─── COMBO SYSTEM ───────────────────────────────────────────

  public setBonusTimeCallback(cb: (seconds: number) => void): void {
    this.bonusTimeCallback = cb;
  }

  private registerCatch(): void {
    const now = performance.now() / 1000;
    this.catchTimes.push(now);

    // Remove catches outside combo window
    this.catchTimes = this.catchTimes.filter(t => now - t < this.comboWindow);

    const count = this.catchTimes.length;
    if (count >= 2) {
      this.comboCount = count;
      this.comboTimer = 3; // Show combo for 3 seconds

      // Bonus time
      let bonus = 0;
      if (count >= 3) {
        bonus = 10;
        this.screenFlash('#FFD700', 300, 0.2);
      } else {
        bonus = 5;
      }

      if (this.bonusTimeCallback && bonus > 0) {
        this.bonusTimeCallback(bonus);
      }

      // Show combo text at screen center
      const comboEl = document.createElement('div');
      comboEl.textContent = `COMBO x${count}!`;
      comboEl.style.cssText = `
        position: fixed; left: 50%; top: 35%;
        transform: translate(-50%, -50%) scale(0.5);
        color: #FFD700; font-size: 48px; font-weight: 900;
        font-family: 'Segoe UI', sans-serif;
        text-shadow: 0 2px 12px rgba(0,0,0,0.9), 0 0 30px #FFD70060;
        pointer-events: none; z-index: 200;
        transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.5s ease-in 1s;
      `;
      document.body.appendChild(comboEl);

      requestAnimationFrame(() => {
        comboEl.style.transform = 'translate(-50%, -50%) scale(1)';
      });
      setTimeout(() => {
        comboEl.style.opacity = '0';
      }, 1500);
      setTimeout(() => {
        comboEl.remove();
      }, 2500);
    }
  }

  public getComboCount(): number {
    return this.comboTimer > 0 ? this.comboCount : 0;
  }

  // ─── UPDATE (call every frame) ──────────────────────────────

  /**
   * Update all effects. Returns adjusted deltaTime (for slow-mo).
   */
  public update(deltaTime: number): number {
    let adjustedDelta = deltaTime;

    // Slow motion
    if (this.slowMo.active) {
      this.slowMo.elapsed += deltaTime;
      if (this.slowMo.elapsed >= this.slowMo.duration) {
        this.slowMo.active = false;
      } else {
        adjustedDelta *= this.slowMo.timeScale;
      }
    }

    // Screen shake
    if (this.shake.elapsed < this.shake.duration) {
      this.shake.elapsed += deltaTime;
      const progress = this.shake.elapsed / this.shake.duration;
      const decay = 1 - progress;
      const intensity = this.shake.intensity * decay;

      this.shake.offset.set(
        (Math.random() - 0.5) * 2 * intensity / 100,
        (Math.random() - 0.5) * 2 * intensity / 100,
      );

      this.camera.position.x += this.shake.offset.x;
      this.camera.position.y += this.shake.offset.y;
    }

    // Flash overlay fade
    if (this.flash.active) {
      this.flash.elapsed += deltaTime * 1000; // ms
      const progress = this.flash.elapsed / this.flash.duration;
      if (progress >= 1) {
        this.flash.active = false;
        this.flashOverlay.style.opacity = '0';
      } else {
        const opacity = this.flash.maxOpacity * (1 - progress);
        this.flashOverlay.style.opacity = String(opacity);
      }
    }

    // FOV interpolation
    if (Math.abs(this.fov.currentFOV - this.fov.targetFOV) > 0.01) {
      this.fov.currentFOV += (this.fov.targetFOV - this.fov.currentFOV) * Math.min(this.fov.lerpSpeed * deltaTime, 1);
      this.camera.fov = this.fov.currentFOV;
      this.camera.updateProjectionMatrix();
    }

    // Floating texts cleanup
    const now = performance.now();
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i]!;
      if (now - ft.startTime > ft.duration) {
        ft.element.remove();
        this.floatingTexts.splice(i, 1);
      }
    }

    // Particle bursts update
    for (let i = this.particleBursts.length - 1; i >= 0; i--) {
      const burst = this.particleBursts[i]!;
      const elapsed = (now - burst.startTime) / 1000;
      const progress = elapsed / (burst.duration / 1000);

      if (progress >= 1) {
        this.scene.remove(burst.points);
        burst.points.geometry.dispose();
        (burst.points.material as THREE.Material).dispose();
        this.particleBursts.splice(i, 1);
        continue;
      }

      // Update particle positions
      const posAttr = burst.points.geometry.getAttribute('position') as THREE.BufferAttribute;
      const positions = posAttr.array as Float32Array;
      const gravity = -9.8;

      for (let p = 0; p < positions.length / 3; p++) {
        const p3 = p * 3;
        positions[p3]! += burst.velocities[p3]! * deltaTime;
        positions[p3 + 1]! += burst.velocities[p3 + 1]! * deltaTime;
        positions[p3 + 2]! += burst.velocities[p3 + 2]! * deltaTime;
        // Apply gravity
        burst.velocities[p3 + 1]! += gravity * deltaTime;
      }
      posAttr.needsUpdate = true;

      // Fade out
      (burst.points.material as THREE.PointsMaterial).opacity = 1 - progress;
    }

    // Combo timer
    if (this.comboTimer > 0) {
      this.comboTimer -= deltaTime;
    }

    return adjustedDelta;
  }

  // ─── HELPERS ─────────────────────────────────────────────────

  private worldToScreen(worldPos: THREE.Vector3): { x: number; y: number } | null {
    this._tmpVec.copy(worldPos);
    this._tmpVec.y += 2; // Above head
    this._tmpVec.project(this.camera);

    if (this._tmpVec.z > 1) return null; // Behind camera

    return {
      x: (this._tmpVec.x * 0.5 + 0.5) * window.innerWidth,
      y: (-this._tmpVec.y * 0.5 + 0.5) * window.innerHeight,
    };
  }

  public dispose(): void {
    this.flashOverlay.remove();
    this.vignetteOverlay.remove();
    for (const ft of this.floatingTexts) ft.element.remove();
    for (const burst of this.particleBursts) {
      this.scene.remove(burst.points);
      burst.points.geometry.dispose();
      (burst.points.material as THREE.Material).dispose();
    }
  }
}
