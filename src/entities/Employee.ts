import * as THREE from 'three';
import { type Gender } from '../config/characters';
import type { CityCollider } from '../world/collision/CityCollider';
import { NameLabel } from '../ui/NameLabel';

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
  paranoid: { detectionRadius: 40, fleeRadius: 30, runSpeed: 7, panicDuration: 0.5 },
  normal: { detectionRadius: 20, fleeRadius: 15, runSpeed: 5.5, panicDuration: 0.7 },
  dreamy: { detectionRadius: 12, fleeRadius: 8, runSpeed: 4.5, panicDuration: 0.8 },
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
  walkSpeed: 2.5,
  runSpeed: 5.5,
  detectionRadius: 20,
  fleeRadius: 15,
  panicDuration: 0.7,
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

  // Reusable temp vectors to avoid per-frame allocations
  private readonly _tmpVec1 = new THREE.Vector3();
  private readonly _tmpVec2 = new THREE.Vector3();
  private readonly _tmpVec3 = new THREE.Vector3();
  private idleTimer = 0;
  private readonly idleWanderInterval = 3; // seconds between wander targets

  // Panic state
  private panicTimer = 0;
  private hasScreamedThisEncounter = false;

  // Periodic screaming while fleeing
  private screamTimer = 0;
  private readonly screamInterval = 1.5; // Scream every 1.5 seconds while fleeing

  // Obstacle avoidance
  private obstacleAvoidanceDirection: THREE.Vector3 | null = null;
  private obstacleAvoidanceTimer = 0;
  private lastPosition: THREE.Vector3 = new THREE.Vector3();
  private stuckTimer = 0;

  // Sprint burst - NPC temporarily speeds up with "I won't go to work!" shout
  private sprintBurstActive = false;
  private sprintBurstTimer = 0;
  private readonly sprintBurstDuration = 1.5; // seconds
  private readonly sprintBurstMultiplier = 2.5; // speed multiplier during burst
  private readonly sprintBurstChance = 0.3; // 30% chance on flee start
  private hasUsedSprintBurst = false; // only once per encounter

  // Sprint burst callback (for special voice line)
  private onSprintBurst: ((employee: Employee) => void) | null = null;

  // Dust trail particles during sprint burst
  private dustTrailParticles: THREE.Points | null = null;
  private dustTrailTime = 0;

  // Visual
  private characterMesh: THREE.Group | null = null;
  private fallbackBody: THREE.Mesh | null = null;
  private fallbackHead: THREE.Mesh | null = null;

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

  // Name label
  private nameLabel: NameLabel | null = null;

  constructor(
    id: string,
    position: THREE.Vector3,
    config: Partial<EmployeeConfig> & { name: string; role: string; roleId: string; gender: Gender },
    characterModel?: THREE.Group,
    animations?: THREE.AnimationClip[],
    collider: CityCollider | null = null,
    scaleOverride?: number,
    yOffset?: number
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
      this.setupCharacterModel(characterModel, scaleOverride, yOffset);
      if (animations && animations.length > 0) {
        this.setupAnimations(animations);
      }
    } else {
      this.createFallbackMesh();
    }

    // Random initial rotation
    this.mesh.rotation.y = Math.random() * Math.PI * 2;

    // Create name label
    this.nameLabel = new NameLabel(this.config.name, this.config.role);
    this.mesh.add(this.nameLabel.getLabel());

    console.log(`[Employee] ${this.config.name} personality: ${this.config.personality} (detection: ${this.config.detectionRadius}m, flee: ${this.config.fleeRadius}m)`);
  }

  /**
   * Get color based on role ID
   */
  private getColorForRole(roleId: string): number {
    return ROLE_COLORS[roleId] ?? ROLE_COLORS['default'] ?? 0x607D8B;
  }

  /**
   * Check if a mesh name indicates an accessory that should be excluded
   * from bounding box calculations (to prevent floating characters)
   */
  private isAccessoryMesh(name: string): boolean {
    const excludePatterns = [
      // Helper/technical geometry
      'icosphere', 'sphere', 'helper', 'particle', 'effect',
      'light', 'camera', 'target', 'bone', 'armature', 'rig',
      'ctrl', 'control', 'null', 'locator', 'gizmo', 'marker',
      'shadow', 'ground_shadow', 'floor_shadow',
      // Head accessories
      'cap', 'hat', 'headphone', 'headphones', 'earphone',
      'hood', 'glasses', 'hair',
      // Carried items
      'backpack', 'bag', 'laptop', 'briefcase', 'folder',
      'clipboard', 'tablet', 'phone', 'palette', 'blueprint',
      'accessory', 'acc_', 'prop_',
    ];

    // Exact name matches for common accessory node names from actual models
    const exactMatches = [
      'backpack', 'folder', 'baseball_cap', 'headphones',
      'clipboard', 'briefcase', 'laptop_bag', 'blueprints', 'tablet',
      'headphone_band', 'headphone_l', 'headphone_r',
      'clipboard_clip', 'clipboard_board',
      'laptop_base', 'laptop_display', 'laptop_screen',
      'hood_back', 'hood_left', 'hood_right', 'hood_top',
      'glasses_bridge', 'glasses_left', 'glasses_right',
      'hair_front',
    ];

    if (exactMatches.includes(name)) return true;
    return excludePatterns.some(pattern => name.includes(pattern));
  }

  /**
   * Setup the 3D character model
   */
  private setupCharacterModel(model: THREE.Group, scaleOverride?: number, yOffset?: number): void {
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

    // Calculate bounds from the model, excluding non-character objects
    // Many 3D models have helper objects, particles, or effects that inflate bounds
    const box = new THREE.Box3();
    let validMeshCount = 0;

    model.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        const name = child.name.toLowerCase();

        // Skip objects that shouldn't be included in character bounds
        if (!child.visible) return;
        if (this.isAccessoryMesh(name)) return;

        // Expand box to include this mesh
        const meshBox = new THREE.Box3().setFromObject(child);
        if (!meshBox.isEmpty()) {
          box.union(meshBox);
          validMeshCount++;
        }
      }
    });

    // Fallback if no valid meshes found
    if (box.isEmpty() || validMeshCount === 0) {
      console.warn(`[Employee] ${this.config.name} - no valid meshes found, using full model bounds`);
      box.setFromObject(model);
    }

    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    // Determine scale factor: use override if provided, otherwise auto-calculate
    let scale: number;
    if (scaleOverride !== undefined) {
      scale = scaleOverride;
      console.log(`[Employee] ${this.config.name} - using scale override: ${scale.toFixed(6)}`);
    } else {
      // Target height ~1.7m (human scale)
      const targetHeight = 1.7;
      scale = targetHeight / size.y;
      console.log(`[Employee] ${this.config.name} - original size: ${size.y.toFixed(2)}m, scale factor: ${scale.toFixed(6)}, center: ${center.x.toFixed(1)}, ${center.y.toFixed(1)}, ${center.z.toFixed(1)}`);
    }

    // Apply scale to the inner model
    model.scale.set(scale, scale, scale);

    // Initial centering - move model so center is at origin
    model.position.set(
      -center.x * scale,
      -box.min.y * scale,
      -center.z * scale
    );

    // Add wrapper to main mesh
    this.mesh.add(this.characterMesh);

    // IMPORTANT: Recalculate bounding box after scaling and positioning
    // to ensure feet are exactly at Y=0 (fixes floating character issue)
    // Use the same exclusion logic as the initial bounds calculation
    this.characterMesh.updateMatrixWorld(true);
    const finalBox = new THREE.Box3();
    let finalValidMeshCount = 0;

    model.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry && child.visible) {
        if (this.isAccessoryMesh(child.name.toLowerCase())) return;
        const meshBox = new THREE.Box3().setFromObject(child);
        if (!meshBox.isEmpty()) {
          finalBox.union(meshBox);
          finalValidMeshCount++;
        }
      }
    });

    // Fallback if no valid meshes found
    if (finalBox.isEmpty() || finalValidMeshCount === 0) {
      finalBox.setFromObject(this.characterMesh);
    }

    const finalSize = finalBox.getSize(new THREE.Vector3());

    // Correct Y position so model feet are at exactly Y=0
    const yCorrection = -finalBox.min.y;
    if (Math.abs(yCorrection) > 0.001) {
      model.position.y += yCorrection;
      console.log(`[Employee] ${this.config.name} - Y correction applied: ${yCorrection.toFixed(3)}m`);
    }

    // Apply manual Y offset if provided (for models that need fine-tuning)
    if (yOffset !== undefined && yOffset !== 0) {
      model.position.y += yOffset;
      console.log(`[Employee] ${this.config.name} - manual yOffset applied: ${yOffset}m`);
    }

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
        // Play walk animation when moving, idle when still
        if (this.velocity.length() > 0.5) {
          this.playAnimation('walk');
        } else {
          this.playAnimation('idle');
        }
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
   * Set callback when employee does a sprint burst
   */
  public setOnSprintBurst(callback: (employee: Employee) => void): void {
    this.onSprintBurst = callback;
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
   * Activate sprint burst - NPC shouts and runs faster for a short time
   */
  private activateSprintBurst(): void {
    this.sprintBurstActive = true;
    this.sprintBurstTimer = 0;
    this.hasUsedSprintBurst = true;

    // Trigger burst callback (for special voice line)
    if (this.onSprintBurst) {
      this.onSprintBurst(this);
    }

    // Create dust trail particles
    this.createDustTrail();
  }

  /**
   * Create dust trail particles behind sprinting NPC
   */
  private createDustTrail(): void {
    if (this.dustTrailParticles) return;

    const count = 30;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    // Initialize all at NPC position
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = this.mesh.position.x;
      positions[i3 + 1] = 0.2;
      positions[i3 + 2] = this.mesh.position.z;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0xCCBB99,
      size: 0.2,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });

    this.dustTrailParticles = new THREE.Points(geometry, material);
    this.dustTrailParticles.frustumCulled = false;
    this.mesh.parent?.add(this.dustTrailParticles);
  }

  /**
   * Update dust trail particles
   */
  private updateDustTrail(deltaTime: number): void {
    if (!this.dustTrailParticles) return;

    this.dustTrailTime += deltaTime;
    const posAttr = this.dustTrailParticles.geometry.getAttribute('position') as THREE.BufferAttribute;
    const positions = posAttr.array as Float32Array;
    const count = positions.length / 3;

    // Shift particles back, oldest at end
    for (let i = count - 1; i > 0; i--) {
      const i3 = i * 3;
      const prev3 = (i - 1) * 3;
      positions[i3] = positions[prev3]!;
      positions[i3 + 1] = positions[prev3 + 1]! + (Math.random() - 0.3) * 0.05;
      positions[i3 + 2] = positions[prev3]! !== undefined ? positions[prev3 + 2]! : 0;
    }

    // Newest particle at NPC feet with jitter
    positions[0] = this.mesh.position.x + (Math.random() - 0.5) * 0.3;
    positions[1] = 0.15 + Math.random() * 0.2;
    positions[2] = this.mesh.position.z + (Math.random() - 0.5) * 0.3;

    posAttr.needsUpdate = true;

    // Fade out when burst ends
    const material = this.dustTrailParticles.material as THREE.PointsMaterial;
    if (!this.sprintBurstActive) {
      material.opacity -= deltaTime * 2;
      if (material.opacity <= 0) {
        this.removeDustTrail();
      }
    }
  }

  /**
   * Remove dust trail particles
   */
  private removeDustTrail(): void {
    if (this.dustTrailParticles) {
      this.dustTrailParticles.parent?.remove(this.dustTrailParticles);
      this.dustTrailParticles.geometry.dispose();
      (this.dustTrailParticles.material as THREE.Material).dispose();
      this.dustTrailParticles = null;
    }
  }

  /**
   * Scatter - triggered when nearby employee is caught
   * Forces immediate flee state regardless of distance to player
   */
  public triggerScatter(): void {
    if (this.state === 'caught' || this.state === 'fleeing') return;
    this.state = 'fleeing';
    this.hasScreamedThisEncounter = false; // Allow scream on scatter
    if (this.onScream) {
      this.onScream(this);
    }
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


    if (this.onCaught) {
      this.onCaught(this);
    }
  }

  /**
   * Update employee each frame
   */
  // Nearby fleeing employees (set by EmployeeManager each frame)
  private nearbyFleeingPositions: THREE.Vector3[] = [];

  /**
   * Set positions of nearby fleeing employees for avoidance during flee
   */
  public setNearbyFleeingPositions(positions: THREE.Vector3[]): void {
    this.nearbyFleeingPositions = positions;
  }

  public update(deltaTime: number, playerPosition: THREE.Vector3): void {
    if (this.state === 'caught') return;

    // Handle sleeping state during night
    if (this.state === 'sleeping') {
      this.updateSleeping(deltaTime, playerPosition);
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
    const moveAmount = this._tmpVec1.copy(this.velocity).multiplyScalar(deltaTime);
    const currentPos = this._tmpVec2.copy(this.mesh.position);
    const desiredPos = this._tmpVec3.copy(currentPos).add(moveAmount);

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

    // Hard clamp to map bounds - prevent employees from escaping play area
    if (this.collider) {
      const bounds = this.collider.getBounds();
      const margin = 2;
      this.mesh.position.x = Math.max(bounds.min.x + margin, Math.min(this.mesh.position.x, bounds.max.x - margin));
      this.mesh.position.z = Math.max(bounds.min.z + margin, Math.min(this.mesh.position.z, bounds.max.z - margin));
    }

    // Update last position for stuck detection
    this.lastPosition.copy(this.mesh.position);

    // Face movement direction
    if (this.velocity.lengthSq() > 0.01) {
      const angle = Math.atan2(this.velocity.x, this.velocity.z);
      this.mesh.rotation.y = angle;
    }

    // Update animations
    if (this.mixer) {
      this.mixer.update(deltaTime);
    }

    // Update name label visibility - hide behind buildings
    if (this.nameLabel) {
      let occluded = false;
      if (this.collider && distanceToPlayer < 25) {
        // Check if there's a building between player and NPC
        const npcPos = this.mesh.position.clone();
        npcPos.y += 1.5; // Head height
        const toPlayer = playerPosition.clone().sub(npcPos);
        toPlayer.y = 0; // Only check horizontally
        const dist2D = toPlayer.length();
        if (dist2D > 0.1) {
          toPlayer.normalize();
          // Sample a point halfway between NPC and player
          const midPoint = npcPos.clone().add(toPlayer.multiplyScalar(dist2D * 0.5));
          midPoint.y = 1.0;
          occluded = this.collider.checkSphere(midPoint, 0.3) !== null;
        }
      }
      this.nameLabel.updateVisibility(distanceToPlayer, occluded);
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
        this.hasUsedSprintBurst = false; // Reset sprint burst for next encounter
        this.sprintBurstActive = false;
        this.screamTimer = 0; // Reset periodic scream timer
      }
      return;
    }

    // Normal state transitions
    if (distanceToPlayer < this.config.fleeRadius) {
      // Enter panic state first (not fleeing directly)
      this.state = 'panic';
      this.panicTimer = 0;

      // Note: scream is triggered when transitioning to fleeing, not here
    } else if (distanceToPlayer < this.config.detectionRadius) {
      this.state = 'alert';
    } else {
      if (prevState === 'alert') {
        // Stay alert for a moment after player leaves detection range
        // (handled by alert state itself)
      }
      this.state = 'idle';
      this.hasScreamedThisEncounter = false; // Reset for next encounter
      this.screamTimer = 0; // Reset periodic scream timer
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
      // Clamp wander target to map bounds
      if (this.collider) {
        const bounds = this.collider.getBounds();
        const margin = 5;
        this.targetPosition.x = Math.max(bounds.min.x + margin, Math.min(this.targetPosition.x, bounds.max.x - margin));
        this.targetPosition.z = Math.max(bounds.min.z + margin, Math.min(this.targetPosition.z, bounds.max.z - margin));
      }
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

      // Trigger scream when starting to flee (not during panic)
      if (!this.hasScreamedThisEncounter) {
        this.hasScreamedThisEncounter = true;
        if (this.onScream) {
          this.onScream(this);
        }
      }

      // 30% chance for sprint burst on first flee
      if (!this.hasUsedSprintBurst && Math.random() < this.sprintBurstChance) {
        this.activateSprintBurst();
      }
    }
  }

  /**
   * Fleeing behavior - smart escape that avoids walls and map edges
   */
  private updateFleeing(deltaTime: number, playerPosition: THREE.Vector3): void {
    const currentPos = this.mesh.position.clone();

    // Periodic screaming while fleeing
    this.screamTimer += deltaTime;
    if (this.screamTimer >= this.screamInterval) {
      this.screamTimer = 0;
      if (this.onScream) {
        this.onScream(this);
      }
    }

    // Get map bounds for edge awareness
    const bounds = this.collider?.getBounds();
    const mapCenter = bounds
      ? new THREE.Vector3(
          (bounds.min.x + bounds.max.x) / 2,
          0,
          (bounds.min.z + bounds.max.z) / 2
        )
      : new THREE.Vector3(0, 0, 0);

    // Calculate base direction away from player
    const awayFromPlayer = currentPos.clone().sub(playerPosition);
    awayFromPlayer.y = 0;

    if (awayFromPlayer.length() < 0.1) {
      // Player is on top of us, pick random direction
      awayFromPlayer.set(Math.random() - 0.5, 0, Math.random() - 0.5);
    }
    awayFromPlayer.normalize();

    // Sample multiple escape directions and pick the best one
    const bestDirection = this.findBestEscapeDirection(
      currentPos,
      playerPosition,
      awayFromPlayer,
      mapCenter,
      bounds,
      this.nearbyFleeingPositions
    );

    // Apply speed with sprint burst multiplier
    const speed = this.sprintBurstActive
      ? this.config.runSpeed * this.sprintBurstMultiplier
      : this.config.runSpeed;
    this.velocity.copy(bestDirection.multiplyScalar(speed));

    // Update sprint burst timer
    if (this.sprintBurstActive) {
      this.sprintBurstTimer += deltaTime;
      if (this.sprintBurstTimer >= this.sprintBurstDuration) {
        this.sprintBurstActive = false;
      }
    }

    // Update dust trail
    this.updateDustTrail(deltaTime);
  }

  /**
   * Find the best escape direction by sampling multiple options
   */
  private findBestEscapeDirection(
    currentPos: THREE.Vector3,
    playerPos: THREE.Vector3,
    awayFromPlayer: THREE.Vector3,
    mapCenter: THREE.Vector3,
    bounds: THREE.Box3 | undefined,
    nearbyFleeing: THREE.Vector3[] = []
  ): THREE.Vector3 {
    // Sample 8 directions: away from player + 7 variations
    const candidates: { direction: THREE.Vector3; score: number }[] = [];

    // Direction toward map center
    const toCenter = mapCenter.clone().sub(currentPos);
    toCenter.y = 0;
    toCenter.normalize();

    // Check how close we are to edges
    const edgeMargin = 15; // Start worrying about edges at 15m
    const edgeProximity = this.getEdgeProximity(currentPos, bounds, edgeMargin);

    // Sample directions: -90° to +90° from "away from player"
    for (let angleOffset = -90; angleOffset <= 90; angleOffset += 30) {
      const radians = (angleOffset * Math.PI) / 180;
      const direction = this.rotateVector(awayFromPlayer.clone(), radians);

      const score = this.scoreEscapeDirection(
        currentPos,
        playerPos,
        direction,
        toCenter,
        bounds,
        edgeProximity,
        nearbyFleeing
      );

      candidates.push({ direction, score });
    }

    // Sort by score (higher is better) and pick the best
    candidates.sort((a, b) => b.score - a.score);

    // Add small randomness to the best direction to avoid robotic movement
    const best = candidates[0]!.direction;
    best.x += (Math.random() - 0.5) * 0.15;
    best.z += (Math.random() - 0.5) * 0.15;
    best.normalize();

    return best;
  }

  /**
   * Score an escape direction (higher is better)
   */
  private scoreEscapeDirection(
    currentPos: THREE.Vector3,
    playerPos: THREE.Vector3,
    direction: THREE.Vector3,
    toCenter: THREE.Vector3,
    bounds: THREE.Box3 | undefined,
    edgeProximity: number,
    nearbyFleeing: THREE.Vector3[] = []
  ): number {
    let score = 0;

    // 1. Prefer directions away from player (dot product with away direction)
    const awayFromPlayer = currentPos.clone().sub(playerPos).normalize();
    const awayScore = direction.dot(awayFromPlayer);
    score += awayScore * 50; // Strong preference to run away

    // 2. Avoid edges - prefer directions toward center when near edges
    if (edgeProximity > 0 && bounds) {
      // The closer to edge, the more we prefer moving toward center
      const centerScore = direction.dot(toCenter);
      score += centerScore * edgeProximity * 40; // Scale by how close to edge
    }

    // 3. Check if this direction leads into a wall (look ahead)
    if (this.collider && bounds) {
      const lookAhead = 5; // Check 5m ahead
      const futurePos = currentPos.clone().add(direction.clone().multiplyScalar(lookAhead));

      // Check if future position is outside bounds
      if (!bounds.containsPoint(futurePos)) {
        score -= 100; // Heavy penalty for running into boundary
      }

      // Check for obstacle collision
      const collisionCheck = futurePos.clone();
      collisionCheck.y = 1.0; // Waist height
      const adjusted = this.collider.checkMovement(
        currentPos.clone().setY(1.0),
        collisionCheck,
        0.5
      );

      // If adjusted position is much closer than desired, there's an obstacle
      const actualDistance = adjusted.distanceTo(currentPos.clone().setY(1.0));
      if (actualDistance < lookAhead * 0.5) {
        score -= 60; // Penalty for obstacles
      }
    }

    // 4. Avoid running toward other fleeing employees - spread out!
    const avoidRadius = 8; // Start avoiding within 8m
    for (const otherPos of nearbyFleeing) {
      const toOther = otherPos.clone().sub(currentPos);
      toOther.y = 0;
      const dist = toOther.length();

      if (dist < avoidRadius && dist > 0.1) {
        // How much does this direction point toward the other employee?
        toOther.normalize();
        const towardOther = direction.dot(toOther);

        if (towardOther > 0) {
          // Penalty scales with proximity and how directly we'd run into them
          const proximityFactor = 1 - dist / avoidRadius; // 0 at edge, 1 at contact
          score -= towardOther * proximityFactor * 35;
        }
      }
    }

    return score;
  }

  /**
   * Get how close we are to any edge (0 = not near, 1 = at edge)
   */
  private getEdgeProximity(pos: THREE.Vector3, bounds: THREE.Box3 | undefined, margin: number): number {
    if (!bounds) return 0;

    const distToMinX = pos.x - bounds.min.x;
    const distToMaxX = bounds.max.x - pos.x;
    const distToMinZ = pos.z - bounds.min.z;
    const distToMaxZ = bounds.max.z - pos.z;

    const minDist = Math.min(distToMinX, distToMaxX, distToMinZ, distToMaxZ);

    if (minDist >= margin) return 0;
    return 1 - (minDist / margin); // 0 at margin distance, 1 at edge
  }

  /**
   * Rotate a vector around Y axis
   */
  private rotateVector(v: THREE.Vector3, radians: number): THREE.Vector3 {
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return new THREE.Vector3(
      v.x * cos - v.z * sin,
      0,
      v.x * sin + v.z * cos
    );
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    // Dispose name label
    if (this.nameLabel) {
      this.nameLabel.dispose();
      this.nameLabel = null;
    }

    // Dispose sleep indicator
    this.hideSleepIndicator();

    // Dispose dust trail
    this.removeDustTrail();

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
