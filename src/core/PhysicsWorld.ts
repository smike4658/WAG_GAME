import RAPIER from '@dimforge/rapier3d-compat';

/**
 * Manages the Rapier.js physics world
 * Handles initialization, stepping, and body management
 */
export class PhysicsWorld {
  private static instance: PhysicsWorld | null = null;
  private world: RAPIER.World | null = null;
  private initialized = false;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): PhysicsWorld {
    if (!PhysicsWorld.instance) {
      PhysicsWorld.instance = new PhysicsWorld();
    }
    return PhysicsWorld.instance;
  }

  /**
   * Initialize Rapier.js (must be called before using physics)
   */
  public async init(): Promise<void> {
    if (this.initialized) return;

    console.log('[PhysicsWorld] Initializing Rapier.js...');

    await RAPIER.init();

    // Create physics world with gravity
    const gravity = { x: 0.0, y: -9.81, z: 0.0 };
    this.world = new RAPIER.World(gravity);

    this.initialized = true;
    console.log('[PhysicsWorld] Rapier.js initialized');
  }

  /**
   * Step the physics simulation
   */
  public step(): void {
    if (!this.world) return;
    this.world.step();
  }

  /**
   * Get the Rapier world instance
   */
  public getWorld(): RAPIER.World {
    if (!this.world) {
      throw new Error('PhysicsWorld not initialized. Call init() first.');
    }
    return this.world;
  }

  /**
   * Create a static ground collider
   */
  public createGround(width: number, depth: number): RAPIER.Collider {
    const world = this.getWorld();

    // Ground body (static)
    const groundBodyDesc = RAPIER.RigidBodyDesc.fixed();
    const groundBody = world.createRigidBody(groundBodyDesc);

    // Ground collider (cuboid shape)
    const groundColliderDesc = RAPIER.ColliderDesc.cuboid(
      width / 2,
      0.1, // thin
      depth / 2
    );
    groundColliderDesc.setTranslation(0, -0.1, 0);

    return world.createCollider(groundColliderDesc, groundBody);
  }

  /**
   * Create a dynamic capsule body (for player)
   */
  public createPlayerBody(
    x: number,
    y: number,
    z: number,
    radius: number,
    height: number
  ): RAPIER.RigidBody {
    const world = this.getWorld();

    // Kinematic body for player control
    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(x, y, z);

    const body = world.createRigidBody(bodyDesc);

    // Capsule collider
    const colliderDesc = RAPIER.ColliderDesc.capsule(height / 2, radius);
    world.createCollider(colliderDesc, body);

    return body;
  }

  /**
   * Create a dynamic sphere (for net projectile)
   */
  public createProjectile(
    x: number,
    y: number,
    z: number,
    radius: number
  ): RAPIER.RigidBody {
    const world = this.getWorld();

    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(x, y, z)
      .setCcdEnabled(true); // Continuous collision detection for fast objects

    const body = world.createRigidBody(bodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.ball(radius)
      .setRestitution(0.3)
      .setFriction(0.5);

    world.createCollider(colliderDesc, body);

    return body;
  }

  /**
   * Create a static box collider (for buildings)
   */
  public createStaticBox(
    x: number,
    y: number,
    z: number,
    halfWidth: number,
    halfHeight: number,
    halfDepth: number
  ): RAPIER.Collider {
    const world = this.getWorld();

    const bodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(x, y, z);

    const body = world.createRigidBody(bodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.cuboid(
      halfWidth,
      halfHeight,
      halfDepth
    );

    return world.createCollider(colliderDesc, body);
  }

  /**
   * Cast a ray and return the first hit
   */
  public raycast(
    originX: number,
    originY: number,
    originZ: number,
    dirX: number,
    dirY: number,
    dirZ: number,
    maxToi: number
  ): RAPIER.RayColliderHit | null {
    const world = this.getWorld();

    const ray = new RAPIER.Ray(
      { x: originX, y: originY, z: originZ },
      { x: dirX, y: dirY, z: dirZ }
    );

    return world.castRay(ray, maxToi, true);
  }

  /**
   * Check if initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Remove a rigid body
   */
  public removeBody(body: RAPIER.RigidBody): void {
    const world = this.getWorld();
    world.removeRigidBody(body);
  }
}
