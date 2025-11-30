import * as THREE from 'three';
import type { InputManager } from '../core/InputManager';
import type { CityCollider } from '../world/collision/CityCollider';

/**
 * Player configuration
 */
interface PlayerConfig {
  moveSpeed: number;
  jumpForce: number;
  lookSensitivity: number;
  height: number;
  collisionRadius: number;
  sprintMultiplier: number;
  sprintDuration: number;
  sprintCooldown: number;
}

/**
 * Active powerup modifiers
 */
interface PowerupModifiers {
  speedMultiplier: number;   // 1.0 = normal, 1.5 = speed boost
  sizeMultiplier: number;    // 1.0 = normal, 2.0 = grande, 0.5 = decaf
  drunkIntensity: number;    // 0 = sober, 1 = drunk
}

const DEFAULT_CONFIG: PlayerConfig = {
  moveSpeed: 5,        // Slower than fleeing NPCs - must use net tactically
  jumpForce: 10,
  lookSensitivity: 0.002,
  height: 1.7,
  collisionRadius: 0.4,
  sprintMultiplier: 1.5,  // 50% faster when sprinting
  sprintDuration: 2,      // 2 seconds of sprint
  sprintCooldown: 5,      // 5 seconds cooldown after sprint ends
};

/**
 * Player entity - Jirka the Head of Team
 * Handles movement, jumping, and camera control
 */
export class Player {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly inputManager: InputManager;
  private readonly config: PlayerConfig;
  private readonly collider: CityCollider | null;

  private readonly euler: THREE.Euler;
  private readonly direction: THREE.Vector3;

  private verticalVelocity = 0;
  private isGrounded = true;

  // Sprint state
  private sprintActive = false;
  private sprintTimeRemaining = 0;
  private sprintCooldownRemaining = 0;
  private onSprintExhausted: (() => void) | null = null;

  // Powerup modifiers
  private powerupModifiers: PowerupModifiers = {
    speedMultiplier: 1.0,
    sizeMultiplier: 1.0,
    drunkIntensity: 0,
  };
  private baseHeight: number;
  private drunkTime = 0;

  constructor(
    camera: THREE.PerspectiveCamera,
    inputManager: InputManager,
    config: Partial<PlayerConfig> = {},
    collider: CityCollider | null = null
  ) {
    this.camera = camera;
    this.inputManager = inputManager;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.collider = collider;

    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.direction = new THREE.Vector3();
    this.baseHeight = this.config.height;
  }

  /**
   * Set initial spawn position
   */
  public setSpawnPosition(x: number, y: number, z: number): void {
    this.camera.position.set(x, y + this.config.height, z);
  }

  /**
   * Set callback for when sprint is exhausted
   */
  public setOnSprintExhausted(callback: () => void): void {
    this.onSprintExhausted = callback;
  }

  /**
   * Update player each frame
   */
  public update(deltaTime: number): void {
    this.handleMouseLook();
    this.handleSprint(deltaTime);
    this.handleMovement(deltaTime);
    this.handleJump(deltaTime);
    this.handleDrunkEffect(deltaTime);
  }

  /**
   * Handle mouse look (rotation)
   */
  private handleMouseLook(): void {
    if (!this.inputManager.isLocked()) return;

    const mouseDelta = this.inputManager.getMouseDelta();

    this.euler.setFromQuaternion(this.camera.quaternion);
    this.euler.y -= mouseDelta.x * this.config.lookSensitivity;
    this.euler.x -= mouseDelta.y * this.config.lookSensitivity;

    // Clamp vertical look
    const maxPitch = Math.PI / 2 - 0.01;
    this.euler.x = Math.max(-maxPitch, Math.min(maxPitch, this.euler.x));

    // Always reset Z rotation - drunk effect will apply it separately
    this.euler.z = 0;

    this.camera.quaternion.setFromEuler(this.euler);
  }

  /**
   * Handle sprint activation and cooldown
   */
  private handleSprint(deltaTime: number): void {
    const input = this.inputManager.getState();

    // Update cooldown
    if (this.sprintCooldownRemaining > 0) {
      this.sprintCooldownRemaining -= deltaTime;
      if (this.sprintCooldownRemaining < 0) {
        this.sprintCooldownRemaining = 0;
      }
    }

    // Check if player wants to sprint and can sprint
    const wantsToSprint = input.sprint && this.isMoving();
    const canSprint = this.sprintCooldownRemaining <= 0;

    if (wantsToSprint && canSprint && !this.sprintActive) {
      // Start sprinting
      this.sprintActive = true;
      this.sprintTimeRemaining = this.config.sprintDuration;
    }

    // Update active sprint
    if (this.sprintActive) {
      this.sprintTimeRemaining -= deltaTime;

      if (this.sprintTimeRemaining <= 0) {
        // Sprint exhausted
        this.handleSprintExhaustion();
      }
    }

    // Stop sprint if player stops holding shift or stops moving
    if (this.sprintActive && (!input.sprint || !this.isMoving())) {
      // Player released sprint early - still trigger exhaustion for the voice line
      if (this.sprintTimeRemaining < this.config.sprintDuration) {
        this.handleSprintExhaustion();
      } else {
        // Player never really used sprint, just reset
        this.sprintActive = false;
        this.sprintTimeRemaining = 0;
      }
    }
  }

  /**
   * Handle sprint exhaustion - called when sprint ends
   */
  private handleSprintExhaustion(): void {
    this.sprintActive = false;
    this.sprintTimeRemaining = 0;
    this.sprintCooldownRemaining = this.config.sprintCooldown;

    // Trigger exhaustion callback (plays voice line)
    if (this.onSprintExhausted) {
      this.onSprintExhausted();
    }
  }

  /**
   * Check if player is currently moving
   */
  public isMoving(): boolean {
    const input = this.inputManager.getState();
    return input.forward || input.backward || input.left || input.right;
  }

  /**
   * Handle WASD movement with collision detection
   */
  private handleMovement(deltaTime: number): void {
    const input = this.inputManager.getState();
    this.direction.set(0, 0, 0);

    if (input.forward) this.direction.z -= 1;
    if (input.backward) this.direction.z += 1;
    if (input.left) this.direction.x -= 1;
    if (input.right) this.direction.x += 1;

    if (this.direction.lengthSq() > 0) {
      this.direction.normalize();

      // Transform by camera yaw only
      const yawQuaternion = new THREE.Quaternion();
      yawQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.euler.y);
      this.direction.applyQuaternion(yawQuaternion);

      // Calculate speed with sprint and powerup multipliers
      const baseSpeed = this.config.moveSpeed;
      const sprintMultiplier = this.sprintActive ? this.config.sprintMultiplier : 1;
      const speed = baseSpeed * sprintMultiplier * this.powerupModifiers.speedMultiplier * deltaTime;

      const currentPos = this.camera.position.clone();
      const desiredPos = new THREE.Vector3(
        currentPos.x + this.direction.x * speed,
        currentPos.y,
        currentPos.z + this.direction.z * speed
      );

      // Check collision
      if (this.collider) {
        const adjustedPos = this.collider.checkMovement(
          currentPos,
          desiredPos,
          this.config.collisionRadius
        );
        this.camera.position.x = adjustedPos.x;
        this.camera.position.z = adjustedPos.z;
      } else {
        this.camera.position.x = desiredPos.x;
        this.camera.position.z = desiredPos.z;
      }
    }
  }

  /**
   * Handle jump and gravity
   */
  private handleJump(deltaTime: number): void {
    const input = this.inputManager.getState();
    const groundY = this.config.height;

    // Ground check
    if (this.camera.position.y <= groundY) {
      this.isGrounded = true;
      this.verticalVelocity = 0;
      this.camera.position.y = groundY;
    } else {
      this.isGrounded = false;
    }

    // Jump
    if (input.jump && this.isGrounded) {
      this.verticalVelocity = this.config.jumpForce;
      this.isGrounded = false;
    }

    // Apply gravity
    if (!this.isGrounded) {
      this.verticalVelocity -= 25 * deltaTime;
      this.camera.position.y += this.verticalVelocity * deltaTime;
    }
  }

  /**
   * Get player position
   */
  public getPosition(): THREE.Vector3 {
    return this.camera.position.clone();
  }

  /**
   * Get look direction
   */
  public getLookDirection(): THREE.Vector3 {
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyQuaternion(this.camera.quaternion);
    return dir;
  }

  /**
   * Set player position (teleport)
   */
  public setPosition(x: number, y: number, z: number): void {
    this.camera.position.set(x, y + this.config.height, z);
  }

  /**
   * Check if player is on ground
   */
  public isOnGround(): boolean {
    return this.isGrounded;
  }

  /**
   * Check if player is currently sprinting
   */
  public isSprinting(): boolean {
    return this.sprintActive;
  }

  /**
   * Get sprint progress (0-1, 1 = full sprint available)
   */
  public getSprintProgress(): number {
    if (this.sprintActive) {
      return this.sprintTimeRemaining / this.config.sprintDuration;
    }
    return 1;
  }

  /**
   * Get sprint cooldown progress (0-1, 1 = ready to sprint)
   */
  public getSprintCooldownProgress(): number {
    if (this.sprintCooldownRemaining <= 0) {
      return 1;
    }
    return 1 - (this.sprintCooldownRemaining / this.config.sprintCooldown);
  }

  /**
   * Check if sprint is available (not on cooldown)
   */
  public canSprint(): boolean {
    return this.sprintCooldownRemaining <= 0;
  }

  // ============================================
  // POWERUP METHODS
  // ============================================

  /**
   * Handle drunk camera sway effect
   */
  private handleDrunkEffect(deltaTime: number): void {
    if (this.powerupModifiers.drunkIntensity <= 0) return;

    this.drunkTime += deltaTime * 3;  // Sway speed

    // Apply camera roll (Z rotation) via quaternion multiplication
    const swayAmount = this.powerupModifiers.drunkIntensity * 0.08;
    const roll = Math.sin(this.drunkTime) * swayAmount;

    // Create roll quaternion and multiply with current camera quaternion
    const rollQuat = new THREE.Quaternion();
    rollQuat.setFromAxisAngle(new THREE.Vector3(0, 0, 1), roll);
    this.camera.quaternion.multiply(rollQuat);
  }

  /**
   * Set speed multiplier (for speed boost powerup)
   */
  public setSpeedMultiplier(multiplier: number): void {
    this.powerupModifiers.speedMultiplier = multiplier;
    console.log(`[Player] Speed multiplier set to ${multiplier}`);
  }

  /**
   * Set size multiplier (for size up/down powerups)
   */
  public setSizeMultiplier(multiplier: number): void {
    this.powerupModifiers.sizeMultiplier = multiplier;

    // Adjust camera height based on size
    const newHeight = this.baseHeight * multiplier;
    this.camera.position.y = this.camera.position.y - this.config.height + newHeight;
    this.config.height = newHeight;

    console.log(`[Player] Size multiplier set to ${multiplier}, new height: ${newHeight}`);
  }

  /**
   * Set drunk intensity (for drunk powerup)
   */
  public setDrunkIntensity(intensity: number): void {
    this.powerupModifiers.drunkIntensity = intensity;
    if (intensity <= 0) {
      // Reset drunk time - camera Z rotation resets automatically via handleMouseLook
      this.drunkTime = 0;
    }
    console.log(`[Player] Drunk intensity set to ${intensity}`);
  }

  /**
   * Reset all powerup modifiers to default
   */
  public resetPowerupModifiers(): void {
    this.setSpeedMultiplier(1.0);
    this.setSizeMultiplier(1.0);
    this.setDrunkIntensity(0);
    console.log('[Player] All powerup modifiers reset');
  }

  /**
   * Get current powerup modifiers (for UI display)
   */
  public getPowerupModifiers(): PowerupModifiers {
    return { ...this.powerupModifiers };
  }
}
