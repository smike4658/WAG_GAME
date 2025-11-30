import * as THREE from 'three';
import { type Gender } from '../config/characters';
import type { CityCollider } from '../world/collision/CityCollider';

/**
 * Employee states for AI behavior
 */
export type EmployeeState = 'idle' | 'alert' | 'panic' | 'fleeing' | 'caught' | 'sleeping';

/**
 * Personality types affect detection ranges and behavior
 */
export type PersonalityType = 'paranoid' | 'normal' | 'dreamy';

/**
 * Personality configuration
 */
interface PersonalityConfig {
  detectionRadius: number;
  fleeRadius: number;
  runSpeed: number;
  panicDuration: number;  // How long the "shock" state lasts
}

/**
 * Personality presets
 */
const PERSONALITIES: Record<PersonalityType, PersonalityConfig> = {
  paranoid: { detectionRadius: 25, fleeRadius: 18, runSpeed: 7, panicDuration: 0.3 },
  normal: { detectionRadius: 15, fleeRadius: 12, runSpeed: 6, panicDuration: 0.4 },
  dreamy: { detectionRadius: 10, fleeRadius: 8, runSpeed: 5.5, panicDuration: 0.6 },
};

/**
 * Map roles to personality types
 */
const ROLE_PERSONALITY: Record<string, PersonalityType> = {
  'qa-tester': 'paranoid',
  'devops': 'paranoid',
  'frontend-developer': 'normal',
  'backend-developer': 'normal',
  'ui-ux-designer': 'dreamy',
  'business-analyst': 'dreamy',
  'product-owner': 'dreamy',
};

/**
 * Employee configuration
 */
export interface EmployeeConfig {
  name: string;
  role: string;
  roleId: string;
  gender: Gender;
  color: number;
  walkSpeed: number;
  runSpeed: number;
  detectionRadius: number;  // When to become alert
  fleeRadius: number;       // When to start panicking/fleeing
  personality?: PersonalityType;
  panicDuration: number;    // How long panic state lasts before fleeing
}

const DEFAULT_CONFIG: Omit<EmployeeConfig, 'name' | 'role' | 'roleId' | 'gender' | 'color' | 'personality'> = {
  walkSpeed: 2,
  runSpeed: 6,
  detectionRadius: 15,
  fleeRadius: 12,
  panicDuration: 0.4,
};

/**
 * Role-based colors for visual distinction
 */
const ROLE_COLORS: Record<string, number> = {
  'frontend-developer': 0x61DAFB,  // React blue
  'backend-developer': 0x68A063,   // Node green
  'ui-ux-designer': 0xE91E63,      // Pink
  'qa-tester': 0xFF9800,           // Orange
  'business-analyst': 0x2196F3,    // Blue
  'product-owner': 0x4CAF50,       // Green
  'devops': 0x9C27B0,              // Purple
  'default': 0x607D8B,             // Gray
};

/**
 * Employee entity - NPCs that Jirka must catch
 * Features: Idle wandering, alert when player approaches, flee when close
 */
export class Employee {
  public readonly id: string;
  public readonly config: EmployeeConfig;

  private readonly mesh: THREE.Group;
  private readonly collider: CityCollider | null;
  private state: EmployeeState = 'idle';

  // Movement
  private readonly velocity: THREE.Vector3 = new THREE.Vector3();
  private targetPosition: THREE.Vector3 | null = null;
  private idleTimer = 0;
  private readonly idleWanderInterval = 3; // seconds between wander targets

  // Panic state
  private panicTimer = 0;
  private hasScreamedThisEncounter = false;

  // Obstacle avoidance
  private obstacleAvoidanceDirection: THREE.Vector3 | null = null;
  private obstacleAvoidanceTimer = 0;
  private lastPosition: THREE.Vector3 = new THREE.Vector3();
  private stuckTimer = 0;

  // Visual
  private characterMesh: THREE.Group | null = null;
  private fallbackBody: THREE.Mesh | null = null;
  private fallbackHead: THREE.Mesh | null = null;
  private readonly alertIndicator: THREE.Mesh;

  // Animation
  private mixer: THREE.AnimationMixer | null = null;
  private animations: Map<string, THREE.AnimationAction> = new Map();
  private currentAnimation: string | null = null;
  private hasNamedAnimations = false;

  // Programmatic animation state
  private animationTime = 0;

  // Callbacks
  private onCaught: ((employee: Employee) => void) | null = null;
  private onScream: ((employee: Employee) => void) | null = null;
  private onNightRefuse: ((employee: Employee) => void) | null = null;

  // Night state
  private isNightTime = false;
  private hasRefusedThisNight = false;
  private sleepIndicator: THREE.Sprite | null = null;

  constructor(
    id: string,
    position: THREE.Vector3,
    config: Partial<EmployeeConfig> & { name: string; role: string; roleId: string; gender: Gender },
    characterModel?: THREE.Group,
    animations?: THREE.AnimationClip[],
    collider: CityCollider | null = null
  ) {
    this.id = id;
    this.collider = collider;

    // Determine personality from role
    const personality: PersonalityType = ROLE_PERSONALITY[config.roleId] ?? 'normal';
    const personalityConfig = PERSONALITIES[personality];

    this.config = {
      ...DEFAULT_CONFIG,
      color: this.getColorForRole(config.roleId),
      personality,
      // Apply personality-based values
      detectionRadius: personalityConfig.detectionRadius,
      fleeRadius: personalityConfig.fleeRadius,
      runSpeed: personalityConfig.runSpeed,
      panicDuration: personalityConfig.panicDuration,
      ...config,
    };

    // Create mesh group
    this.mesh = new THREE.Group();
    this.mesh.name = id;
    this.mesh.position.copy(position);

    // Force Frontend Developer to move immediately
    if (this.config.roleId === 'frontend-developer') {
      this.idleTimer = 0;
    } else {
      this.idleTimer = Math.random() * 2; // Random start delay
    }

    // Use provided 3D character model or create fallback
    if (characterModel) {
      this.setupCharacterModel(characterModel);
      if (animations && animations.length > 0) {
        this.setupAnimations(animations);
      }
    } else {
      this.createFallbackMesh();
    }

    // Create alert indicator (floating exclamation)
    const alertGeometry = new THREE.ConeGeometry(0.15, 0.4, 4);
    const alertMaterial = new THREE.MeshBasicMaterial({
      color: 0xFFFF00,
      transparent: true,
      opacity: 0,
    });
    this.alertIndicator = new THREE.Mesh(alertGeometry, alertMaterial);
    this.alertIndicator.position.y = 2.2;
    this.alertIndicator.rotation.z = Math.PI; // Point up
    this.mesh.add(this.alertIndicator);

    // Random initial rotation
    this.mesh.rotation.y = Math.random() * Math.PI * 2;

    console.log(`[Employee] ${this.config.name} personality: ${this.config.personality} (detection: ${this.config.detectionRadius}m, flee: ${this.config.fleeRadius}m)`);
  }

  /**
   * Get color based on role ID
   */
  private getColorForRole(roleId: string): number {
    return ROLE_COLORS[roleId] ?? ROLE_COLORS['default'] ?? 0x607D8B;
  }

  /**
   * Setup the 3D character model
   */
  private setupCharacterModel(model: THREE.Group): void {
    // Create a wrapper group for the character
    this.characterMesh = new THREE.Group();
    this.characterMesh.name = 'character_wrapper';

    // Reset model transforms
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    model.scale.set(1, 1, 1);

    // Add original model to wrapper
    this.characterMesh.add(model);

    // Update all matrices recursively
    model.updateMatrixWorld(true);

    // Calculate bounds from the model
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    // Target height ~1.7m (human scale)
    const targetHeight = 1.7;

    // Calculate scale factor
    const scale = targetHeight / size.y;

    console.log(`[Employee] ${this.config.name} - original size: ${size.y.toFixed(2)}m, scale factor: ${scale.toFixed(6)}, center: ${center.x.toFixed(1)}, ${center.y.toFixed(1)}, ${center.z.toFixed(1)}`);

    // Apply scale to the inner model
    model.scale.set(scale, scale, scale);

    // Center the model - move it so the center is at origin and feet at y=0
    model.position.set(
      -center.x * scale,
      -box.min.y * scale,
      -center.z * scale
    );

    // Add wrapper to main mesh
    this.mesh.add(this.characterMesh);

    // Verify final bounds
    this.characterMesh.updateMatrixWorld(true);
    const finalBox = new THREE.Box3().setFromObject(this.characterMesh);
    const finalSize = finalBox.getSize(new THREE.Vector3());
    console.log(`[Employee] ${this.config.name} - final size: ${finalSize.y.toFixed(2)}m`);

    // Apply role-based tint to materials (subtle)
    model.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        // Clone material to avoid affecting other instances
        if (Array.isArray(child.material)) {
          child.material = child.material.map(m => m.clone());
        } else {
          child.material = child.material.clone();
        }

        // Add subtle color tint based on role
        const mat = child.material as THREE.MeshStandardMaterial;
        if (mat.emissive) {
          mat.emissive.setHex(this.config.color);
          mat.emissiveIntensity = 0.1; // Subtle glow
        }

        child.castShadow = true;
        child.receiveShadow = true;

        // Disable frustum culling to prevent model from disappearing
        // when animation moves vertices outside the initial bounding box
        child.frustumCulled = false;
      }
    });
  }

  /**
   * Setup animations if available
   */
  private setupAnimations(clips: THREE.AnimationClip[]): void {
    if (!this.characterMesh || clips.length === 0) return;

    // Debug: Log available animations
    if (this.config.roleId === 'frontend-developer') {
      console.log(`[Employee] Setting up animations for ${this.config.name}:`, clips.map(c => c.name));
    }

    this.mixer = new THREE.AnimationMixer(this.characterMesh);

    // Check if this model has named animations (Idle, Walk, Run, Flee)
    const hasIdle = clips.some(c => c.name.toLowerCase().includes('idle'));
    const hasWalk = clips.some(c => c.name.toLowerCase().includes('walk'));
    const hasRun = clips.some(c => c.name.toLowerCase().includes('run'));
    const hasFlee = clips.some(c => c.name.toLowerCase().includes('flee'));

    this.hasNamedAnimations = hasIdle && (hasWalk || hasRun || hasFlee);

    if (this.hasNamedAnimations) {
      // Store all named animations
      for (const clip of clips) {
        const action = this.mixer.clipAction(clip);
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.timeScale = 1; // Ensure timeScale is 1
        // Determine animation type from name
        const name = clip.name.toLowerCase();
        if (name.includes('idle')) {
          this.animations.set('idle', action);
        } else if (name.includes('walk')) {
          this.animations.set('walk', action);
        } else if (name.includes('run')) {
          this.animations.set('run', action);
        } else if (name.includes('flee')) {
          this.animations.set('flee', action);
        }
      }

      console.log(`[Employee] ${this.config.name} - loaded ${this.animations.size} named animations: ${Array.from(this.animations.keys()).join(', ')}`);

      // Start with idle animation
      this.playAnimation('idle');
    } else {
      // Fallback animation logic - play ANYTHING
      console.log(`[Employee] No named animations found for ${this.config.name}, trying fallback...`);

      const idleClip = clips.find(c => c.name.toLowerCase().includes('idle') || c.name.toLowerCase().includes('stand'));
      if (idleClip) {
        const action = this.mixer.clipAction(idleClip);
        action.play();
      } else if (clips.length > 0 && clips[0]) {
        // Play first animation as fallback
        const action = this.mixer.clipAction(clips[0]);
        action.play();
      }
    }
  }

  /**
   * Play a specific animation with crossfade
   */
  private playAnimation(name: string): void {
    if (!this.hasNamedAnimations || !this.mixer) return;
    if (this.currentAnimation === name) return;

    const newAction = this.animations.get(name);
    if (!newAction) return;

    const oldAction = this.currentAnimation ? this.animations.get(this.currentAnimation) : null;

    // Crossfade from old to new animation
    const fadeTime = 0.2;

    if (oldAction) {
      oldAction.fadeOut(fadeTime);
    }

    newAction.reset();
    newAction.fadeIn(fadeTime);
    newAction.play();

    this.currentAnimation = name;
  }

  /**
   * Update animation based on current state
   */
  private updateAnimationForState(): void {
    if (!this.hasNamedAnimations) return;

    // Map state to animation
    switch (this.state) {
      case 'idle':
      case 'sleeping':
        this.playAnimation('idle');
        break;
      case 'alert':
        // Alert state - still idle but watching
        this.playAnimation('idle');
        break;
      case 'panic':
        // Panic state - use flee animation (arms up, panicking)
        this.playAnimation('flee');
        break;
      case 'fleeing':
        // Fleeing - use flee animation for dramatic effect, or run as fallback
        if (this.animations.has('flee')) {
          this.playAnimation('flee');
        } else {
          this.playAnimation('run');
        }
        break;
    }

    // Also check if we're moving and should play walk animation
    const speed = this.velocity.length();
    if (this.state === 'idle' && speed > 0.5) {
      this.playAnimation('walk');
    }
  }

  /**
   * Create fallback mesh when no 3D model is available
   */
  private createFallbackMesh(): void {
    // Create body (cylinder)
    const bodyGeometry = new THREE.CylinderGeometry(0.3, 0.35, 1.2, 8);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: this.config.color,
      roughness: 0.7,
      metalness: 0.1,
    });
    this.fallbackBody = new THREE.Mesh(bodyGeometry, bodyMaterial);
    this.fallbackBody.position.y = 0.6;
    this.fallbackBody.castShadow = true;
    this.mesh.add(this.fallbackBody);

    // Create head (sphere)
    const headGeometry = new THREE.SphereGeometry(0.25, 8, 6);
    const headMaterial = new THREE.MeshStandardMaterial({
      color: 0xFFDBAC, // Skin tone
      roughness: 0.8,
      metalness: 0,
    });
    this.fallbackHead = new THREE.Mesh(headGeometry, headMaterial);
    this.fallbackHead.position.y = 1.45;
    this.fallbackHead.castShadow = true;
    this.mesh.add(this.fallbackHead);

    console.log(`[Employee] ${this.config.name} using fallback mesh`);
  }

  /**
   * Set callback when employee is caught
   */
  public setOnCaught(callback: (employee: Employee) => void): void {
    this.onCaught = callback;
  }

  /**
   * Set callback when employee screams
   */
  public setOnScream(callback: (employee: Employee) => void): void {
    this.onScream = callback;
  }

  /**
   * Set callback when employee refuses to work at night
   */
  public setOnNightRefuse(callback: (employee: Employee) => void): void {
    this.onNightRefuse = callback;
  }

  /**
   * Set night time state - employees won't flee at night
   */
  public setNightTime(isNight: boolean): void {
    const wasNight = this.isNightTime;
    this.isNightTime = isNight;

    if (isNight && !wasNight) {
      // Entering night - reset refusal flag and enter sleeping state
      this.hasRefusedThisNight = false;
      if (this.state !== 'caught') {
        this.state = 'sleeping';
        this.velocity.set(0, 0, 0);
        this.showSleepIndicator();
      }
    } else if (!isNight && wasNight) {
      // Leaving night - wake up
      if (this.state === 'sleeping') {
        this.state = 'idle';
        this.hideSleepIndicator();
      }
    }
  }

  /**
   * Check if it's night time
   */
  public isNight(): boolean {
    return this.isNightTime;
  }

  /**
   * Show sleep indicator (Zzz) above employee
   */
  private showSleepIndicator(): void {
    if (this.sleepIndicator) return;

    // Create a canvas for the Zzz text
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#AAAAFF';
      ctx.font = 'bold 40px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💤', 32, 32);
    }

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0.9,
    });
    this.sleepIndicator = new THREE.Sprite(material);
    this.sleepIndicator.position.y = 2.5;
    this.sleepIndicator.scale.set(0.8, 0.8, 1);
    this.mesh.add(this.sleepIndicator);
  }

  /**
   * Hide sleep indicator
   */
  private hideSleepIndicator(): void {
    if (this.sleepIndicator) {
      this.mesh.remove(this.sleepIndicator);
      this.sleepIndicator.material.map?.dispose();
      this.sleepIndicator.material.dispose();
      this.sleepIndicator = null;
    }
  }

  /**
   * Get the Three.js mesh group
   */
  public getMesh(): THREE.Group {
    return this.mesh;
  }

  /**
   * Get current position
   */
  public getPosition(): THREE.Vector3 {
    return this.mesh.position.clone();
  }

  /**
   * Get current state
   */
  public getState(): EmployeeState {
    return this.state;
  }

  /**
   * Mark as caught
   */
  public catch(): void {
    if (this.state === 'caught') return;

    this.state = 'caught';
    this.velocity.set(0, 0, 0);

    // Visual feedback - fall down
    this.mesh.rotation.x = Math.PI / 2;
    this.mesh.position.y = 0.4;

    // Gray out the character
    if (this.characterMesh) {
      this.characterMesh.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          const mat = child.material as THREE.MeshStandardMaterial;
          if (mat.color) {
            mat.color.setHex(0x888888);
          }
          if (mat.emissive) {
            mat.emissive.setHex(0x004400);
            mat.emissiveIntensity = 0.3;
          }
        }
      });
    }

    // Gray out fallback mesh
    if (this.fallbackBody?.material instanceof THREE.MeshStandardMaterial) {
      this.fallbackBody.material.color.setHex(0x888888);
      this.fallbackBody.material.emissive.setHex(0x004400);
      this.fallbackBody.material.emissiveIntensity = 0.3;
    }

    // Hide alert indicator
    if (this.alertIndicator.material instanceof THREE.MeshBasicMaterial) {
      this.alertIndicator.material.opacity = 0;
    }

    if (this.onCaught) {
      this.onCaught(this);
    }
  }

  /**
   * Update employee each frame
   */
  public update(deltaTime: number, playerPosition: THREE.Vector3): void {
    if (this.state === 'caught') return;

    // Handle sleeping state during night
    if (this.state === 'sleeping') {
      this.updateSleeping(deltaTime, playerPosition);
      // Still update animations and alert indicator
      this.updateAlertIndicator(deltaTime);
      if (this.mixer) {
        this.mixer.update(deltaTime);
      }
      return;
    }

    const distanceToPlayer = this.mesh.position.distanceTo(playerPosition);

    // State transitions based on distance
    this.updateState(distanceToPlayer);

    // Update animation based on state (for models with named animations)
    this.updateAnimationForState();

    // Behavior based on state
    switch (this.state) {
      case 'idle':
        this.updateIdle(deltaTime);
        break;
      case 'alert':
        this.updateAlert(deltaTime, playerPosition);
        break;
      case 'panic':
        this.updatePanic(deltaTime, playerPosition);
        break;
      case 'fleeing':
        this.updateFleeing(deltaTime, playerPosition);
        break;
    }

    // Apply velocity with collision detection and obstacle avoidance
    const moveAmount = this.velocity.clone().multiplyScalar(deltaTime);
    const currentPos = this.mesh.position.clone();
    const desiredPos = currentPos.clone().add(moveAmount);

    if (this.collider && moveAmount.lengthSq() > 0.000001) {
      // Use collision radius of 0.4 (same as player)
      // Check collision at waist height (y+1.0) to avoid ground collisions
      const collisionStart = currentPos.clone();
      collisionStart.y += 1.0;

      const collisionEnd = desiredPos.clone();
      collisionEnd.y += 1.0;

      const adjustedCenter = this.collider.checkMovement(collisionStart, collisionEnd, 0.4);

      // Convert back to feet position
      const adjustedPos = adjustedCenter.clone();
      adjustedPos.y -= 1.0;

      // Check if we're stuck (collision blocked movement)
      const actualMovement = adjustedPos.clone().sub(currentPos);
      const expectedMovement = moveAmount.length();
      const actualMovementLength = actualMovement.length();

      // Debug movement for Frontend Developer
      if (this.config.roleId === 'frontend-developer' && Math.random() < 0.05) {
        console.log(`[Employee Debug] ${this.config.name} (${this.state}):
          Vel: ${this.velocity.length().toFixed(3)}
          Desired Move: ${moveAmount.length().toFixed(3)}
          Actual Move: ${actualMovement.length().toFixed(3)}
          Pos: ${currentPos.y.toFixed(2)} -> ${adjustedPos.y.toFixed(2)}
        `);
      }

      if (expectedMovement > 0.01 && actualMovementLength < expectedMovement * 0.3) {
        // We're blocked - try to find alternative direction
        this.stuckTimer += deltaTime;

        if (this.stuckTimer > 0.1) {
          // Generate avoidance direction perpendicular to desired movement
          if (!this.obstacleAvoidanceDirection || this.obstacleAvoidanceTimer <= 0) {
            // Randomly choose left or right perpendicular direction
            const perpendicular = new THREE.Vector3(-this.velocity.z, 0, this.velocity.x);
            if (Math.random() > 0.5) {
              perpendicular.negate();
            }
            perpendicular.normalize();
            this.obstacleAvoidanceDirection = perpendicular;
            this.obstacleAvoidanceTimer = 0.5 + Math.random() * 0.5; // Try for 0.5-1s
          }

          // Try moving in avoidance direction
          const avoidMove = this.obstacleAvoidanceDirection.clone().multiplyScalar(this.config.runSpeed * deltaTime);
          const avoidDesired = currentPos.clone().add(avoidMove);
          const avoidAdjusted = this.collider.checkMovement(currentPos, avoidDesired, 0.4);
          this.mesh.position.copy(avoidAdjusted);
        }
      } else {
        // Normal movement succeeded
        this.mesh.position.copy(adjustedPos);
        this.stuckTimer = 0;
        this.obstacleAvoidanceDirection = null;
      }

      // Update avoidance timer
      if (this.obstacleAvoidanceTimer > 0) {
        this.obstacleAvoidanceTimer -= deltaTime;
        if (this.obstacleAvoidanceTimer <= 0) {
          this.obstacleAvoidanceDirection = null;
        }
      }
    } else {
      this.mesh.position.add(moveAmount);
    }

    // Keep on ground
    this.mesh.position.y = 0;

    // Update last position for stuck detection
    this.lastPosition.copy(this.mesh.position);

    // Face movement direction
    if (this.velocity.lengthSq() > 0.01) {
      const angle = Math.atan2(this.velocity.x, this.velocity.z);
      this.mesh.rotation.y = angle;
    }

    // Update alert indicator
    this.updateAlertIndicator(deltaTime);

    // Update animations
    if (this.mixer) {
      this.mixer.update(deltaTime);
    }

    // Update programmatic animation (bobbing, tilting)
    this.updateProceduralAnimation(deltaTime);
  }

  /**
   * Update procedural animation (bobbing, tilting) based on movement
   * This creates walk/run animation effect for static models
   */
  private updateProceduralAnimation(deltaTime: number): void {
    // Skip procedural animation if we have named animations from the model
    if (this.hasNamedAnimations) return;

    const speed = this.velocity.length();

    // Only animate when moving
    if (speed < 0.1) {
      // Reset to neutral position when stopped
      if (this.characterMesh) {
        this.characterMesh.position.y = THREE.MathUtils.lerp(this.characterMesh.position.y, 0, deltaTime * 5);
        this.characterMesh.rotation.x = THREE.MathUtils.lerp(this.characterMesh.rotation.x, 0, deltaTime * 5);
        this.characterMesh.rotation.z = THREE.MathUtils.lerp(this.characterMesh.rotation.z, 0, deltaTime * 5);
      }
      return;
    }

    // Update animation time based on speed
    // Running = faster animation, walking = slower
    const animationSpeed = this.state === 'fleeing' ? 15 : 8;
    this.animationTime += deltaTime * animationSpeed;

    // Bobbing effect (up/down movement while walking)
    const bobAmount = this.state === 'fleeing' ? 0.08 : 0.04;
    const bobY = Math.abs(Math.sin(this.animationTime * 2)) * bobAmount;

    // Side-to-side tilt (simulates weight shifting)
    const tiltAmount = this.state === 'fleeing' ? 0.06 : 0.03;
    const tiltZ = Math.sin(this.animationTime) * tiltAmount;

    // Forward lean when running
    const leanAmount = this.state === 'fleeing' ? 0.15 : 0.05;

    // Apply to character mesh
    if (this.characterMesh) {
      this.characterMesh.position.y = bobY;
      this.characterMesh.rotation.z = tiltZ;
      this.characterMesh.rotation.x = leanAmount;
    }

    // Also apply to fallback mesh if using it
    if (this.fallbackBody) {
      this.fallbackBody.position.y = 0.6 + bobY;
    }
    if (this.fallbackHead) {
      this.fallbackHead.position.y = 1.45 + bobY;
      // Head bobbing is slightly delayed
      this.fallbackHead.rotation.z = Math.sin(this.animationTime + 0.3) * tiltAmount * 0.5;
    }
  }

  /**
   * Update state based on player distance
   */
  private updateState(distanceToPlayer: number): void {
    const prevState = this.state;

    // Don't interrupt panic or fleeing states based on distance alone
    if (this.state === 'panic') {
      // Panic state is managed by updatePanic with timer
      return;
    }

    if (this.state === 'fleeing') {
      // Once fleeing, only stop if player is far enough away
      if (distanceToPlayer > this.config.detectionRadius) {
        this.state = 'alert'; // Stay alert, don't go back to idle immediately
        this.hasScreamedThisEncounter = false; // Reset for next encounter
      }
      return;
    }

    // Normal state transitions
    if (distanceToPlayer < this.config.fleeRadius) {
      // Enter panic state first (not fleeing directly)
      this.state = 'panic';
      this.panicTimer = 0;

      // Trigger scream when entering panic state
      if (!this.hasScreamedThisEncounter) {
        this.hasScreamedThisEncounter = true;
        if (this.onScream) {
          this.onScream(this);
        }
      }
    } else if (distanceToPlayer < this.config.detectionRadius) {
      this.state = 'alert';
    } else {
      if (prevState === 'alert') {
        // Stay alert for a moment after player leaves detection range
        // (handled by alert state itself)
      }
      this.state = 'idle';
      this.hasScreamedThisEncounter = false; // Reset for next encounter
    }
  }

  /**
   * Sleeping behavior - employees stay still and refuse work at night
   */
  private updateSleeping(_deltaTime: number, playerPosition: THREE.Vector3): void {
    const distanceToPlayer = this.mesh.position.distanceTo(playerPosition);

    // If player gets close, refuse to work
    if (distanceToPlayer < this.config.fleeRadius && !this.hasRefusedThisNight) {
      this.hasRefusedThisNight = true;

      // Trigger night refuse callback (plays voice line)
      if (this.onNightRefuse) {
        this.onNightRefuse(this);
      }
    }

    // Stay still
    this.velocity.set(0, 0, 0);

    // Animate sleep indicator bobbing
    if (this.sleepIndicator) {
      this.sleepIndicator.position.y = 2.5 + Math.sin(Date.now() * 0.002) * 0.1;
    }
  }

  /**
   * Idle behavior - wander randomly
   */
  private updateIdle(deltaTime: number): void {
    this.idleTimer += deltaTime;

    if (this.idleTimer >= this.idleWanderInterval || !this.targetPosition) {
      this.idleTimer = 0;
      // Pick random nearby target
      const angle = Math.random() * Math.PI * 2;
      const distance = 3 + Math.random() * 5;
      this.targetPosition = new THREE.Vector3(
        this.mesh.position.x + Math.cos(angle) * distance,
        0,
        this.mesh.position.z + Math.sin(angle) * distance
      );
    }

    // Move toward target
    if (this.targetPosition) {
      const direction = this.targetPosition.clone().sub(this.mesh.position);
      direction.y = 0;

      if (direction.length() > 0.5) {
        direction.normalize();
        this.velocity.copy(direction.multiplyScalar(this.config.walkSpeed));
      } else {
        this.velocity.set(0, 0, 0);
      }
    }
  }

  /**
   * Alert behavior - face player, slow movement
   */
  private updateAlert(deltaTime: number, playerPosition: THREE.Vector3): void {
    // Face player
    const toPlayer = playerPosition.clone().sub(this.mesh.position);
    toPlayer.y = 0;

    if (toPlayer.length() > 0.1) {
      const targetAngle = Math.atan2(toPlayer.x, toPlayer.z);
      // Smooth rotation
      const currentAngle = this.mesh.rotation.y;
      const angleDiff = targetAngle - currentAngle;
      this.mesh.rotation.y += angleDiff * deltaTime * 5;
    }

    // Slow down
    this.velocity.multiplyScalar(0.9);
  }

  /**
   * Panic behavior - freeze momentarily, then transition to fleeing
   * This is the "shock" moment where NPC realizes danger
   */
  private updatePanic(deltaTime: number, playerPosition: THREE.Vector3): void {
    this.panicTimer += deltaTime;

    // Stop moving during panic
    this.velocity.set(0, 0, 0);

    // Face away from player (preparing to flee)
    const awayFromPlayer = this.mesh.position.clone().sub(playerPosition);
    awayFromPlayer.y = 0;

    if (awayFromPlayer.length() > 0.1) {
      const targetAngle = Math.atan2(awayFromPlayer.x, awayFromPlayer.z);
      // Quick rotation to face escape direction
      const currentAngle = this.mesh.rotation.y;
      let angleDiff = targetAngle - currentAngle;
      // Normalize angle difference
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      this.mesh.rotation.y += angleDiff * deltaTime * 8;
    }

    // Transition to fleeing after panic duration
    if (this.panicTimer >= this.config.panicDuration) {
      this.state = 'fleeing';
    }
  }

  /**
   * Fleeing behavior - run away from player
   */
  private updateFleeing(_deltaTime: number, playerPosition: THREE.Vector3): void {
    // Direction away from player
    const awayFromPlayer = this.mesh.position.clone().sub(playerPosition);
    awayFromPlayer.y = 0;

    if (awayFromPlayer.length() > 0.1) {
      awayFromPlayer.normalize();

      // Add some randomness to avoid predictable paths
      awayFromPlayer.x += (Math.random() - 0.5) * 0.3;
      awayFromPlayer.z += (Math.random() - 0.5) * 0.3;
      awayFromPlayer.normalize();

      this.velocity.copy(awayFromPlayer.multiplyScalar(this.config.runSpeed));
    }
  }

  /**
   * Update alert indicator visual
   */
  private updateAlertIndicator(deltaTime: number): void {
    if (!(this.alertIndicator.material instanceof THREE.MeshBasicMaterial)) return;

    const material = this.alertIndicator.material;

    switch (this.state) {
      case 'idle':
        material.opacity = Math.max(0, material.opacity - deltaTime * 3);
        this.alertIndicator.scale.setScalar(1);
        break;
      case 'sleeping':
        // Blue/purple - sleeping, no alert indicator needed
        material.opacity = Math.max(0, material.opacity - deltaTime * 3);
        this.alertIndicator.scale.setScalar(1);
        break;
      case 'alert':
        material.color.setHex(0xFFFF00); // Yellow
        material.opacity = Math.min(0.8, material.opacity + deltaTime * 3);
        this.alertIndicator.scale.setScalar(1);
        break;
      case 'panic': {
        // Orange, rapidly pulsing - the "oh no!" moment
        material.color.setHex(0xFF8800);
        material.opacity = 1;
        const panicPulse = (Math.sin(Date.now() * 0.03) + 1) / 2; // Faster pulse
        this.alertIndicator.scale.setScalar(1.2 + panicPulse * 0.6);
        break;
      }
      case 'fleeing': {
        material.color.setHex(0xFF0000); // Red
        material.opacity = 1;
        // Pulsing effect
        const fleePulse = (Math.sin(Date.now() * 0.01) + 1) / 2;
        this.alertIndicator.scale.setScalar(0.8 + fleePulse * 0.4);
        break;
      }
    }

    // Bob up and down
    if (material.opacity > 0) {
      this.alertIndicator.position.y = 2.2 + Math.sin(Date.now() * 0.005) * 0.1;
    }
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    // Dispose sleep indicator
    this.hideSleepIndicator();

    // Dispose fallback meshes
    if (this.fallbackBody) {
      this.fallbackBody.geometry.dispose();
      if (this.fallbackBody.material instanceof THREE.Material) {
        this.fallbackBody.material.dispose();
      }
    }

    if (this.fallbackHead) {
      this.fallbackHead.geometry.dispose();
      if (this.fallbackHead.material instanceof THREE.Material) {
        this.fallbackHead.material.dispose();
      }
    }

    // Dispose alert indicator
    this.alertIndicator.geometry.dispose();
    if (this.alertIndicator.material instanceof THREE.Material) {
      this.alertIndicator.material.dispose();
    }

    // Dispose character mesh materials
    if (this.characterMesh) {
      this.characterMesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else if (child.material) {
            child.material.dispose();
          }
        }
      });
    }

    // Stop animations
    if (this.mixer) {
      this.mixer.stopAllAction();
    }
  }

  // ============================================
  // POWERUP EFFECTS
  // ============================================

  private originalMaterials: Map<THREE.Mesh, THREE.Material | THREE.Material[]> = new Map();
  private xrayActive = false;

  /**
   * Enable/disable X-Ray vision effect (visible through walls)
   */
  public setXRayVision(enabled: boolean): void {
    if (enabled === this.xrayActive) return;
    this.xrayActive = enabled;

    if (enabled) {
      // Store original materials and apply X-Ray effect
      this.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          // Store original
          this.originalMaterials.set(child, child.material);

          // Create X-Ray material (emissive, visible through walls)
          const xrayMaterial = new THREE.MeshBasicMaterial({
            color: 0xff00ff,  // Neon magenta
            transparent: true,
            opacity: 0.8,
            depthTest: false,  // Render on top of everything
            depthWrite: false,
          });

          child.material = xrayMaterial;
          child.renderOrder = 999;  // Render last
        }
      });
    } else {
      // Restore original materials
      this.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const original = this.originalMaterials.get(child);
          if (original) {
            // Dispose X-Ray material
            if (child.material instanceof THREE.Material) {
              child.material.dispose();
            }
            child.material = original;
            child.renderOrder = 0;
          }
        }
      });
      this.originalMaterials.clear();
    }
  }

  /**
   * Check if X-Ray vision is active
   */
  public isXRayActive(): boolean {
    return this.xrayActive;
  }
}
