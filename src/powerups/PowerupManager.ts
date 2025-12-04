import * as THREE from 'three';

/**
 * Powerup effect types
 */
export enum PowerupType {
  SPEED_BOOST = 'speed_boost',       // Turbo káva - +50% speed
  SIZE_UP = 'size_up',               // Grande káva - 2x size
  SUPER_NET = 'super_net',           // Espresso focus - +100% net radius
  XRAY_VISION = 'xray_vision',       // Rentgen - see NPCs through walls
  SIZE_DOWN = 'size_down',           // Decaf - 0.5x size
  DRUNK = 'drunk',                   // Opilost - camera sway
  BLUR = 'blur',                     // Rozmazání - blur effect
}

/**
 * Powerup definition with weight for random selection
 */
interface PowerupDefinition {
  type: PowerupType;
  name: string;
  nameCz: string;
  isAdvantage: boolean;
  weight: number;  // Probability weight
  color: number;   // Effect color
}

/**
 * All available powerups with 70/30 advantage/disadvantage split
 */
const POWERUP_DEFINITIONS: PowerupDefinition[] = [
  // Advantages (70% total = 17.5% each)
  { type: PowerupType.SPEED_BOOST, name: 'Speed Boost', nameCz: 'Turbo káva', isAdvantage: true, weight: 17.5, color: 0xffff00 },
  { type: PowerupType.SIZE_UP, name: 'Size Up', nameCz: 'Grande káva', isAdvantage: true, weight: 17.5, color: 0x00ff00 },
  { type: PowerupType.SUPER_NET, name: 'Super Net', nameCz: 'Espresso focus', isAdvantage: true, weight: 17.5, color: 0x00ffff },
  { type: PowerupType.XRAY_VISION, name: 'X-Ray Vision', nameCz: 'Rentgen', isAdvantage: true, weight: 17.5, color: 0xff00ff },
  // Disadvantages (30% total = 10% each)
  { type: PowerupType.SIZE_DOWN, name: 'Size Down', nameCz: 'Decaf', isAdvantage: false, weight: 10, color: 0xff8800 },
  { type: PowerupType.DRUNK, name: 'Drunk', nameCz: 'Opilost', isAdvantage: false, weight: 10, color: 0x8800ff },
  { type: PowerupType.BLUR, name: 'Blur', nameCz: 'Rozmazání', isAdvantage: false, weight: 10, color: 0x888888 },
];

/**
 * Active powerup effect on player
 */
export interface ActivePowerup {
  type: PowerupType;
  definition: PowerupDefinition;
  remainingTime: number;
  totalTime: number;
}

/**
 * Waypoint state - each waypoint has its own state
 */
interface WaypointState {
  position: THREE.Vector3;
  groundCircle: THREE.Group;
  pickup: THREE.Group | null;        // Current pickup mesh (null if on cooldown)
  cooldownRemaining: number;          // Cooldown timer (0 = powerup is present)
  isOnCooldown: boolean;              // True if pickup was taken and waiting to respawn
}

/**
 * Test mode pickup with fixed powerup type
 */
interface TestPickup {
  mesh: THREE.Group;
  position: THREE.Vector3;
  definition: PowerupDefinition;
}

/**
 * Callbacks for powerup events
 */
interface PowerupCallbacks {
  onCollect?: (powerup: ActivePowerup) => void;
  onExpire?: (powerup: ActivePowerup) => void;
  onSpawn?: (position: THREE.Vector3) => void;
}

/**
 * PowerupManager configuration
 */
interface PowerupConfig {
  effectDuration: number;       // How long effect lasts (seconds)
  waypointCooldown: number;     // Per-waypoint cooldown after collection (seconds)
  pickupRadius: number;         // Distance to collect powerup
  floatHeight: number;          // Height above ground
  rotationSpeed: number;        // Rotation speed (radians/sec)
}

const DEFAULT_CONFIG: PowerupConfig = {
  effectDuration: 5,   // Shorter boost duration for faster gameplay
  waypointCooldown: 10, // 10 second cooldown per waypoint
  pickupRadius: 2.5,   // Slightly larger pickup radius
  floatHeight: 1.5,
  rotationSpeed: 3,    // Faster rotation
};

/**
 * PowerupManager - Manages "Kávová loterie" powerup system
 *
 * Features:
 * - 9 waypoints (4 corners, 1 center, 4 between)
 * - All waypoints always have powerups (unless on cooldown)
 * - Per-waypoint 10 second cooldown after collection
 * - Rotating coffee cup pickup
 * - Random effect on collection (70% advantage, 30% disadvantage)
 */
export class PowerupManager {
  private readonly scene: THREE.Scene;
  private readonly config: PowerupConfig;
  private readonly waypoints: WaypointState[] = [];
  private readonly callbacks: PowerupCallbacks = {};

  private activePowerup: ActivePowerup | null = null;

  // Test mode - all 7 powerups spawned at once
  private isTestMode = false;
  private testPickups: TestPickup[] = [];

  // Reusable materials
  private readonly cupMaterial: THREE.MeshStandardMaterial;
  private readonly steamMaterial: THREE.MeshBasicMaterial;
  private readonly hexagonMaterial: THREE.MeshBasicMaterial;
  private readonly hexagonGlowMaterial: THREE.MeshBasicMaterial;
  private readonly hexagonRingMaterial: THREE.LineBasicMaterial;

  constructor(scene: THREE.Scene, config: Partial<PowerupConfig> = {}) {
    this.scene = scene;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Create materials - cyan/turquoise neon theme
    this.cupMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x00ffff,
      emissiveIntensity: 0.4,
    });

    this.steamMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
    });

    // Neon hexagon materials - cyan/turquoise color scheme
    this.hexagonMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
    });

    this.hexagonGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    });

    this.hexagonRingMaterial = new THREE.LineBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.9,
      linewidth: 2,
    });
  }

  /**
   * Initialize 9 waypoints based on city bounds
   * Layout: 4 corners, 1 center (offset from player), 4 between (mid-edges)
   * @param cityBounds - City boundaries
   * @param centerOffset - Optional offset from center to avoid player spawn [x, z]
   */
  public initialize(
    cityBounds: { min: THREE.Vector2; max: THREE.Vector2 },
    centerOffset?: [number, number]
  ): void {
    const centerX = (cityBounds.min.x + cityBounds.max.x) / 2;
    const centerZ = (cityBounds.min.y + cityBounds.max.y) / 2;
    const width = cityBounds.max.x - cityBounds.min.x;
    const depth = cityBounds.max.y - cityBounds.min.y;

    // Margin from edges (so corners aren't right at the wall)
    const marginFactor = 0.35;

    // Apply offset for center to avoid player spawn
    const offsetX = centerOffset?.[0] ?? 15;  // Default offset if not provided
    const offsetZ = centerOffset?.[1] ?? -15;

    // 9 waypoints:
    // - 4 corners
    // - 1 center (offset from player spawn)
    // - 4 mid-edges (between corners and center)
    const positions = [
      // 4 CORNERS
      new THREE.Vector3(centerX - width * marginFactor, 0, centerZ - depth * marginFactor), // NW
      new THREE.Vector3(centerX + width * marginFactor, 0, centerZ - depth * marginFactor), // NE
      new THREE.Vector3(centerX - width * marginFactor, 0, centerZ + depth * marginFactor), // SW
      new THREE.Vector3(centerX + width * marginFactor, 0, centerZ + depth * marginFactor), // SE

      // 1 CENTER (offset to avoid player spawn)
      new THREE.Vector3(centerX + offsetX, 0, centerZ + offsetZ),

      // 4 MID-EDGES (between corners and center)
      new THREE.Vector3(centerX, 0, centerZ - depth * 0.25),          // North
      new THREE.Vector3(centerX, 0, centerZ + depth * 0.25),          // South
      new THREE.Vector3(centerX - width * 0.25, 0, centerZ),          // West
      new THREE.Vector3(centerX + width * 0.25, 0, centerZ),          // East
    ];

    console.log(`[PowerupManager] Initializing 9 waypoints (center offset: [${offsetX}, ${offsetZ}])`);

    for (const pos of positions) {
      const groundCircle = this.createGroundCircle(pos);
      this.scene.add(groundCircle);

      // Create pickup immediately (all waypoints start with powerups)
      const pickup = this.createCoffeeCup();
      pickup.position.copy(pos);
      pickup.position.y = this.config.floatHeight;
      this.scene.add(pickup);

      this.waypoints.push({
        position: pos.clone(),
        groundCircle,
        pickup,
        cooldownRemaining: 0,
        isOnCooldown: false,
      });
    }

    console.log(`[PowerupManager] Initialized ${this.waypoints.length} waypoints - all with powerups ready`);
  }

  /**
   * Initialize TEST MODE - spawns all 7 powerups at once for testing
   * Each powerup has a fixed type and respawns immediately after collection
   * Powerups are arranged in a semicircle at the center of the map (100, 100)
   */
  public initializeTestMode(_playerSpawn: THREE.Vector3): void {
    this.isTestMode = true;

    // Clear normal mode waypoints
    for (const wp of this.waypoints) {
      this.scene.remove(wp.groundCircle);
      this.disposeHexagon(wp.groundCircle);
      if (wp.pickup) {
        this.scene.remove(wp.pickup);
        this.disposeCoffeeCup(wp.pickup);
      }
    }
    this.waypoints.length = 0;

    // Spawn all 7 powerups in a semicircle at map center (100, 100)
    // This is the main intersection/square area
    const centerX = 100;
    const centerZ = 100;
    const radius = 12;  // Distance from center

    for (let i = 0; i < POWERUP_DEFINITIONS.length; i++) {
      const definition = POWERUP_DEFINITIONS[i]!;

      // Arrange in semicircle (facing player spawn which is at z=85)
      const angle = Math.PI + (i / (POWERUP_DEFINITIONS.length - 1)) * Math.PI;
      const position = new THREE.Vector3(
        centerX + Math.cos(angle) * radius,
        0,
        centerZ + Math.sin(angle) * radius
      );

      // Create ground circle with powerup color
      const circleGeometry = new THREE.CircleGeometry(2, 32);
      const circleMaterial = new THREE.MeshBasicMaterial({
        color: definition.color,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
      });
      const groundCircle = new THREE.Mesh(circleGeometry, circleMaterial);
      groundCircle.position.copy(position);
      groundCircle.position.y = 0.05;
      groundCircle.rotation.x = -Math.PI / 2;
      this.scene.add(groundCircle);

      // Create coffee cup mesh
      const mesh = this.createCoffeeCup();
      mesh.position.copy(position);
      mesh.position.y = this.config.floatHeight;
      this.scene.add(mesh);

      this.testPickups.push({
        mesh,
        position: position.clone(),
        definition,
      });
    }

    console.log(`[PowerupManager] TEST MODE: Spawned ${POWERUP_DEFINITIONS.length} powerups in semicircle at (${centerX}, ${centerZ})`);
  }

  /**
   * Set waypoint positions manually
   */
  public setSpawnPositions(positions: THREE.Vector3[]): void {
    // Clear existing waypoints
    for (const wp of this.waypoints) {
      this.scene.remove(wp.groundCircle);
      this.disposeHexagon(wp.groundCircle);
      if (wp.pickup) {
        this.scene.remove(wp.pickup);
        this.disposeCoffeeCup(wp.pickup);
      }
    }
    this.waypoints.length = 0;

    // Create new waypoints with powerups
    for (const pos of positions) {
      const groundCircle = this.createGroundCircle(pos);
      this.scene.add(groundCircle);

      const pickup = this.createCoffeeCup();
      pickup.position.copy(pos);
      pickup.position.y = this.config.floatHeight;
      this.scene.add(pickup);

      this.waypoints.push({
        position: pos.clone(),
        groundCircle,
        pickup,
        cooldownRemaining: 0,
        isOnCooldown: false,
      });
    }

    console.log(`[PowerupManager] Set ${positions.length} waypoint positions`);
  }

  /**
   * Create hexagon shape geometry
   */
  private createHexagonGeometry(radius: number): THREE.BufferGeometry {
    const shape = new THREE.Shape();
    const sides = 6;

    for (let i = 0; i <= sides; i++) {
      const angle = (i / sides) * Math.PI * 2 - Math.PI / 2; // Start from top
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      if (i === 0) {
        shape.moveTo(x, y);
      } else {
        shape.lineTo(x, y);
      }
    }

    return new THREE.ShapeGeometry(shape);
  }

  /**
   * Create neon hexagon platform indicator at spawn location
   */
  private createGroundCircle(position: THREE.Vector3): THREE.Group {
    const group = new THREE.Group();
    group.position.copy(position);
    group.position.y = 0.05;
    group.rotation.x = -Math.PI / 2;

    // Inner filled hexagon (subtle glow)
    const innerHex = new THREE.Mesh(
      this.createHexagonGeometry(1.5),
      this.hexagonMaterial.clone()
    );
    group.add(innerHex);

    // Middle hexagon ring (brighter)
    const middleHex = new THREE.Mesh(
      this.createHexagonGeometry(1.8),
      this.hexagonGlowMaterial.clone()
    );
    // Cut out center to make a ring
    const middleInner = new THREE.Mesh(
      this.createHexagonGeometry(1.5),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0 })
    );
    middleHex.add(middleInner);
    group.add(middleHex);

    // Outer neon line ring
    const outerPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= 6; i++) {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
      outerPoints.push(new THREE.Vector3(
        Math.cos(angle) * 2,
        Math.sin(angle) * 2,
        0
      ));
    }
    const outerGeometry = new THREE.BufferGeometry().setFromPoints(outerPoints);
    const outerRing = new THREE.Line(outerGeometry, this.hexagonRingMaterial.clone());
    group.add(outerRing);

    // Second outer ring (larger, more faint)
    const outerPoints2: THREE.Vector3[] = [];
    for (let i = 0; i <= 6; i++) {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
      outerPoints2.push(new THREE.Vector3(
        Math.cos(angle) * 2.3,
        Math.sin(angle) * 2.3,
        0
      ));
    }
    const outerGeometry2 = new THREE.BufferGeometry().setFromPoints(outerPoints2);
    const outerRingMat2 = this.hexagonRingMaterial.clone();
    outerRingMat2.opacity = 0.4;
    const outerRing2 = new THREE.Line(outerGeometry2, outerRingMat2);
    group.add(outerRing2);

    // Corner accents (small triangles at each vertex)
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const cornerShape = new THREE.Shape();
      const cx = Math.cos(angle) * 2;
      const cy = Math.sin(angle) * 2;

      cornerShape.moveTo(cx, cy);
      cornerShape.lineTo(cx + Math.cos(angle) * 0.3, cy + Math.sin(angle) * 0.3);
      cornerShape.lineTo(cx + Math.cos(angle + 0.3) * 0.2, cy + Math.sin(angle + 0.3) * 0.2);
      cornerShape.lineTo(cx, cy);

      const cornerGeom = new THREE.ShapeGeometry(cornerShape);
      const cornerMesh = new THREE.Mesh(cornerGeom, this.hexagonGlowMaterial.clone());
      group.add(cornerMesh);
    }

    // Store reference for animation
    group.userData.innerHex = innerHex;
    group.userData.outerRing = outerRing;
    group.userData.outerRing2 = outerRing2;

    return group;
  }

  /**
   * Create coffee cup mesh
   */
  private createCoffeeCup(): THREE.Group {
    const group = new THREE.Group();

    // Cup body (cylinder)
    const cupGeometry = new THREE.CylinderGeometry(0.3, 0.25, 0.5, 8);
    const cup = new THREE.Mesh(cupGeometry, this.cupMaterial.clone());
    cup.position.y = 0.25;
    group.add(cup);

    // Cup handle (torus segment)
    const handleGeometry = new THREE.TorusGeometry(0.15, 0.04, 8, 8, Math.PI);
    const handle = new THREE.Mesh(handleGeometry, this.cupMaterial.clone());
    handle.position.set(0.35, 0.25, 0);
    handle.rotation.z = Math.PI / 2;
    group.add(handle);

    // Coffee inside (dark circle on top)
    const coffeeGeometry = new THREE.CircleGeometry(0.25, 8);
    const coffeeMaterial = new THREE.MeshBasicMaterial({ color: 0x3d2314 });
    const coffee = new THREE.Mesh(coffeeGeometry, coffeeMaterial);
    coffee.position.y = 0.49;
    coffee.rotation.x = -Math.PI / 2;
    group.add(coffee);

    // Steam particles (simple geometry for now)
    const steamGroup = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const steamGeometry = new THREE.SphereGeometry(0.08, 4, 4);
      const steam = new THREE.Mesh(steamGeometry, this.steamMaterial.clone());
      steam.position.set(
        (Math.random() - 0.5) * 0.2,
        0.6 + i * 0.15,
        (Math.random() - 0.5) * 0.2
      );
      steamGroup.add(steam);
    }
    group.add(steamGroup);
    group.userData.steamGroup = steamGroup;

    // Add glow effect - cyan neon glow
    const glowGeometry = new THREE.SphereGeometry(0.6, 16, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.3,
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.y = 0.25;
    group.add(glow);
    group.userData.glow = glow;

    return group;
  }

  /**
   * Spawn a powerup at a specific waypoint
   */
  private spawnAtWaypoint(waypoint: WaypointState): void {
    if (waypoint.pickup) return; // Already has a pickup

    const pickup = this.createCoffeeCup();
    pickup.position.copy(waypoint.position);
    pickup.position.y = this.config.floatHeight;
    this.scene.add(pickup);

    waypoint.pickup = pickup;
    waypoint.isOnCooldown = false;
    waypoint.cooldownRemaining = 0;
    waypoint.groundCircle.userData.isActive = true;

    this.callbacks.onSpawn?.(waypoint.position);
  }

  /**
   * Remove pickup from a specific waypoint (on collection)
   */
  private removePickupFromWaypoint(waypoint: WaypointState): void {
    if (!waypoint.pickup) return;

    this.scene.remove(waypoint.pickup);
    this.disposeCoffeeCup(waypoint.pickup);
    waypoint.pickup = null;
    waypoint.groundCircle.userData.isActive = false;
  }

  /**
   * Dispose a coffee cup mesh and its materials
   */
  private disposeCoffeeCup(cup: THREE.Group): void {
    cup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    });
  }

  /**
   * Select random powerup type based on weights
   */
  private selectRandomPowerup(): PowerupDefinition {
    const totalWeight = POWERUP_DEFINITIONS.reduce((sum, p) => sum + p.weight, 0);
    let random = Math.random() * totalWeight;

    for (const powerup of POWERUP_DEFINITIONS) {
      random -= powerup.weight;
      if (random <= 0) {
        return powerup;
      }
    }

    // Fallback (should never happen)
    return POWERUP_DEFINITIONS[0]!;
  }

  /**
   * Collect powerup from a waypoint
   */
  private collectPowerupFromWaypoint(waypoint: WaypointState, definition: PowerupDefinition): void {
    // Remove pickup and start cooldown for this waypoint
    this.removePickupFromWaypoint(waypoint);
    waypoint.isOnCooldown = true;
    waypoint.cooldownRemaining = this.config.waypointCooldown;

    // If there's an existing active powerup, expire it first
    if (this.activePowerup) {
      console.log(`[PowerupManager] Replacing active powerup: ${this.activePowerup.definition.nameCz}`);
      this.callbacks.onExpire?.(this.activePowerup);
      this.activePowerup = null;
    }

    // Create active effect
    this.activePowerup = {
      type: definition.type,
      definition,
      remainingTime: this.config.effectDuration,
      totalTime: this.config.effectDuration,
    };

    console.log(`[PowerupManager] Collected: ${definition.nameCz} (${definition.isAdvantage ? 'advantage' : 'disadvantage'})`);
    this.callbacks.onCollect?.(this.activePowerup);
  }

  /**
   * Set callbacks
   */
  public setCallbacks(callbacks: PowerupCallbacks): void {
    Object.assign(this.callbacks, callbacks);
  }

  /**
   * Update each frame
   */
  public update(deltaTime: number, playerPosition: THREE.Vector3): void {
    // TEST MODE: Update all test pickups
    if (this.isTestMode) {
      for (const pickup of this.testPickups) {
        // Rotate and animate
        pickup.mesh.rotation.y += this.config.rotationSpeed * deltaTime;
        pickup.mesh.position.y = this.config.floatHeight + Math.sin(performance.now() * 0.003) * 0.1;

        // Animate steam
        this.animateSteam(pickup.mesh, deltaTime);

        // Pulse glow
        this.animateGlow(pickup.mesh);

        // Check player distance - collect specific powerup type
        const distance = playerPosition.distanceTo(pickup.position);
        if (distance < this.config.pickupRadius) {
          // In test mode, use the old collectPowerup logic (direct collection)
          if (this.activePowerup) {
            this.callbacks.onExpire?.(this.activePowerup);
            this.activePowerup = null;
          }
          this.activePowerup = {
            type: pickup.definition.type,
            definition: pickup.definition,
            remainingTime: this.config.effectDuration,
            totalTime: this.config.effectDuration,
          };
          this.callbacks.onCollect?.(this.activePowerup);
        }
      }

      // Update active powerup timer
      if (this.activePowerup) {
        this.activePowerup.remainingTime -= deltaTime;
        if (this.activePowerup.remainingTime <= 0) {
          this.callbacks.onExpire?.(this.activePowerup);
          this.activePowerup = null;
        }
      }
      return;
    }

    // NORMAL MODE: Update all waypoints
    for (const waypoint of this.waypoints) {
      // Handle waypoint cooldowns
      if (waypoint.isOnCooldown) {
        waypoint.cooldownRemaining -= deltaTime;
        if (waypoint.cooldownRemaining <= 0) {
          // Cooldown done, respawn the powerup
          this.spawnAtWaypoint(waypoint);
        }
      }

      // Animate active pickups
      if (waypoint.pickup) {
        // Rotate coffee cup
        waypoint.pickup.rotation.y += this.config.rotationSpeed * deltaTime;

        // Animate steam and glow
        this.animateSteam(waypoint.pickup, deltaTime);
        this.animateGlow(waypoint.pickup);

        // Bob up and down
        waypoint.pickup.position.y = this.config.floatHeight + Math.sin(performance.now() * 0.003) * 0.1;

        // Check player distance for collection
        const distance = playerPosition.distanceTo(waypoint.position);
        if (distance < this.config.pickupRadius) {
          // Collect!
          const powerup = this.selectRandomPowerup();
          this.collectPowerupFromWaypoint(waypoint, powerup);
        }
      }
    }

    // Update active powerup duration
    if (this.activePowerup) {
      this.activePowerup.remainingTime -= deltaTime;
      if (this.activePowerup.remainingTime <= 0) {
        console.log(`[PowerupManager] Effect expired: ${this.activePowerup.definition.nameCz}`);
        this.callbacks.onExpire?.(this.activePowerup);
        this.activePowerup = null;
      }
    }

    // Animate all hexagon platforms (steady glow, no blinking)
    this.animateHexagons();
  }

  /**
   * Animate steam particles on a coffee cup
   */
  private animateSteam(mesh: THREE.Group, deltaTime: number): void {
    const steamGroup = mesh.userData.steamGroup as THREE.Group | undefined;
    if (steamGroup) {
      steamGroup.children.forEach((steam, i) => {
        steam.position.y += deltaTime * 0.3;
        if (steam.position.y > 1.2) {
          steam.position.y = 0.6 + i * 0.15;
        }
        if (steam instanceof THREE.Mesh && steam.material instanceof THREE.MeshBasicMaterial) {
          steam.material.opacity = Math.max(0, 0.5 - (steam.position.y - 0.6) * 0.5);
        }
      });
    }
  }

  /**
   * Animate glow effect on a coffee cup (steady, no pulsing)
   */
  private animateGlow(mesh: THREE.Group): void {
    const glow = mesh.userData.glow as THREE.Mesh | undefined;
    if (glow && glow.material instanceof THREE.MeshBasicMaterial) {
      // Steady glow - no pulsing/blinking
      glow.material.opacity = 0.25;
    }
  }

  /**
   * Animate hexagon platforms (rotation, steady glow - NO blinking)
   */
  private animateHexagons(): void {
    for (const waypoint of this.waypoints) {
      const hex = waypoint.groundCircle;
      const hasPickup = waypoint.pickup !== null;
      const isOnCooldown = waypoint.isOnCooldown;

      // Slow rotation
      hex.rotation.z += 0.002;

      // Steady brightness - brighter when has pickup, dim during cooldown
      const brightness = hasPickup ? 1.0 : (isOnCooldown ? 0.3 : 0.5);

      // Update material opacities (steady, no pulsing)
      hex.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
          const mat = child.material;
          if (mat instanceof THREE.MeshBasicMaterial) {
            // Inner hex base opacity
            if (child === hex.userData.innerHex) {
              mat.opacity = 0.15 * brightness;
            }
          }
          if (mat instanceof THREE.LineBasicMaterial) {
            // Outer ring - steady glow
            if (child === hex.userData.outerRing) {
              mat.opacity = 0.7 * brightness;
            }
            if (child === hex.userData.outerRing2) {
              mat.opacity = 0.4 * brightness;
            }
          }
        }
      });
    }
  }

  /**
   * Get currently active powerup (if any)
   */
  public getActivePowerup(): ActivePowerup | null {
    return this.activePowerup;
  }

  /**
   * Check if specific powerup type is active
   */
  public isPowerupActive(type: PowerupType): boolean {
    return this.activePowerup?.type === type;
  }

  /**
   * Get remaining time for active powerup (0-1 progress)
   */
  public getActiveProgress(): number {
    if (!this.activePowerup) return 0;
    return this.activePowerup.remainingTime / this.activePowerup.totalTime;
  }

  /**
   * Get all waypoint positions (for minimap)
   */
  public getSpawnPositions(): THREE.Vector3[] {
    return this.waypoints.map(wp => wp.position.clone());
  }

  /**
   * Get positions of all active pickups (for minimap)
   */
  public getActivePickupPositions(): THREE.Vector3[] {
    return this.waypoints
      .filter(wp => wp.pickup !== null)
      .map(wp => wp.position.clone());
  }

  /**
   * Get active pickup position (for minimap compatibility) - returns first active or null
   * @deprecated Use getActivePickupPositions() instead
   */
  public getActivePickupPosition(): THREE.Vector3 | null {
    const activeWaypoint = this.waypoints.find(wp => wp.pickup !== null);
    return activeWaypoint ? activeWaypoint.position.clone() : null;
  }

  /**
   * Dispose a hexagon group and all its children
   */
  private disposeHexagon(group: THREE.Group): void {
    group.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    });
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    // Clean up all waypoints
    for (const wp of this.waypoints) {
      this.scene.remove(wp.groundCircle);
      this.disposeHexagon(wp.groundCircle);
      if (wp.pickup) {
        this.scene.remove(wp.pickup);
        this.disposeCoffeeCup(wp.pickup);
      }
    }

    // Clean up test mode pickups
    for (const pickup of this.testPickups) {
      this.scene.remove(pickup.mesh);
      this.disposeCoffeeCup(pickup.mesh);
    }

    this.waypoints.length = 0;
    this.testPickups.length = 0;
    this.cupMaterial.dispose();
    this.steamMaterial.dispose();
    this.hexagonMaterial.dispose();
    this.hexagonGlowMaterial.dispose();
    this.hexagonRingMaterial.dispose();
  }
}
