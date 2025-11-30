import * as THREE from 'three';

/**
 * Collision shape types
 */
interface BoxCollider {
  type: 'box';
  box: THREE.Box3;
  object: THREE.Object3D;
}

interface CylinderCollider {
  type: 'cylinder';
  position: THREE.Vector3;
  radius: number;
  height: number;
  object: THREE.Object3D;
}

type Collider = BoxCollider | CylinderCollider;

/**
 * Spatial grid cell
 */
interface GridCell {
  colliders: Collider[];
}

/**
 * City collision manager
 * Uses spatial hashing for efficient collision detection
 */
export class CityCollider {
  private colliders: Collider[] = [];
  private dynamicColliders: ((center: THREE.Vector3, radius: number) => Collider | null)[] = [];
  private grid: Map<string, GridCell> = new Map();
  private readonly cellSize: number;
  private bounds: THREE.Box3;

  constructor(citySize: number = 600, cellSize: number = 20) {
    this.cellSize = cellSize;
    this.bounds = new THREE.Box3(
      new THREE.Vector3(-citySize / 2, 0, -citySize / 2),
      new THREE.Vector3(citySize / 2, 200, citySize / 2)
    );
  }

  /**
   * Update bounds to match actual city size
   * Called after city is loaded to set correct boundaries
   */
  public updateBounds(newBounds: THREE.Box3): void {
    this.bounds.copy(newBounds);
    console.log(`[CityCollider] Bounds updated: (${newBounds.min.x.toFixed(0)}, ${newBounds.min.z.toFixed(0)}) to (${newBounds.max.x.toFixed(0)}, ${newBounds.max.z.toFixed(0)})`);
  }

  /**
   * Get current bounds
   */
  public getBounds(): THREE.Box3 {
    return this.bounds.clone();
  }

  /**
   * Get grid cell key from position
   */
  private getCellKey(x: number, z: number): string {
    const cellX = Math.floor(x / this.cellSize);
    const cellZ = Math.floor(z / this.cellSize);
    return `${cellX},${cellZ}`;
  }

  /**
   * Get all cell keys that a box overlaps
   */
  private getOverlappingCells(box: THREE.Box3): string[] {
    const keys: string[] = [];
    const minCellX = Math.floor(box.min.x / this.cellSize);
    const maxCellX = Math.floor(box.max.x / this.cellSize);
    const minCellZ = Math.floor(box.min.z / this.cellSize);
    const maxCellZ = Math.floor(box.max.z / this.cellSize);

    for (let x = minCellX; x <= maxCellX; x++) {
      for (let z = minCellZ; z <= maxCellZ; z++) {
        keys.push(`${x},${z}`);
      }
    }

    return keys;
  }

  /**
   * Register a box collider
   */
  public registerBox(object: THREE.Object3D, customBox?: THREE.Box3): void {
    const box = customBox ?? new THREE.Box3().setFromObject(object);

    const collider: BoxCollider = {
      type: 'box',
      box,
      object,
    };

    this.colliders.push(collider);

    // Add to spatial grid
    const cellKeys = this.getOverlappingCells(box);
    cellKeys.forEach(key => {
      if (!this.grid.has(key)) {
        this.grid.set(key, { colliders: [] });
      }
      this.grid.get(key)!.colliders.push(collider);
    });
  }

  /**
   * Register a cylinder collider
   */
  public registerCylinder(
    object: THREE.Object3D,
    radius: number,
    height: number = 10
  ): void {
    const position = new THREE.Vector3();
    object.getWorldPosition(position);

    const collider: CylinderCollider = {
      type: 'cylinder',
      position,
      radius,
      height,
      object,
    };

    this.colliders.push(collider);

    // Add to spatial grid (approximate as box)
    const box = new THREE.Box3(
      new THREE.Vector3(position.x - radius, 0, position.z - radius),
      new THREE.Vector3(position.x + radius, height, position.z + radius)
    );

    const cellKeys = this.getOverlappingCells(box);
    cellKeys.forEach(key => {
      if (!this.grid.has(key)) {
        this.grid.set(key, { colliders: [] });
      }
      this.grid.get(key)!.colliders.push(collider);
    });
  }

  /**
   * Register a dynamic collider check callback
   */
  public registerDynamicCollider(callback: (center: THREE.Vector3, radius: number) => Collider | null): void {
    this.dynamicColliders.push(callback);
  }

  /**
   * Check if a point is inside any collider
   */
  public checkPoint(point: THREE.Vector3): boolean {
    const cellKey = this.getCellKey(point.x, point.z);
    const cell = this.grid.get(cellKey);

    if (!cell) return false;

    for (const collider of cell.colliders) {
      if (collider.type === 'box') {
        if (collider.box.containsPoint(point)) {
          return true;
        }
      } else if (collider.type === 'cylinder') {
        const dx = point.x - collider.position.x;
        const dz = point.z - collider.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        if (distance < collider.radius && point.y < collider.height) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if a sphere/cylinder would collide
   */
  public checkSphere(center: THREE.Vector3, radius: number): Collider | null {
    // Get all nearby cells
    const checkBox = new THREE.Box3(
      new THREE.Vector3(center.x - radius, 0, center.z - radius),
      new THREE.Vector3(center.x + radius, center.y + radius, center.z + radius)
    );

    // Check dynamic colliders first
    for (const callback of this.dynamicColliders) {
      const dynamicCollision = callback(center, radius);
      if (dynamicCollision) {
        return dynamicCollision;
      }
    }

    const cellKeys = this.getOverlappingCells(checkBox);
    const checkedColliders = new Set<Collider>();

    for (const key of cellKeys) {
      const cell = this.grid.get(key);
      if (!cell) continue;

      for (const collider of cell.colliders) {
        if (checkedColliders.has(collider)) continue;
        checkedColliders.add(collider);

        if (collider.type === 'box') {
          // Sphere-AABB collision
          const closestPoint = new THREE.Vector3(
            Math.max(collider.box.min.x, Math.min(center.x, collider.box.max.x)),
            Math.max(collider.box.min.y, Math.min(center.y, collider.box.max.y)),
            Math.max(collider.box.min.z, Math.min(center.z, collider.box.max.z))
          );

          const distance = center.distanceTo(closestPoint);
          if (distance < radius) {
            return collider;
          }
        } else if (collider.type === 'cylinder') {
          // Cylinder-cylinder collision (simplified as circles in XZ plane)
          const dx = center.x - collider.position.x;
          const dz = center.z - collider.position.z;
          const distance = Math.sqrt(dx * dx + dz * dz);
          if (distance < radius + collider.radius) {
            return collider;
          }
        }
      }
    }

    return null;
  }

  /**
   * Check if movement from start to end is valid
   * Returns adjusted end position that doesn't collide
   */
  public checkMovement(
    start: THREE.Vector3,
    end: THREE.Vector3,
    radius: number
  ): THREE.Vector3 {
    // Check if end position collides
    const collision = this.checkSphere(end, radius);

    if (!collision) {
      // Check city bounds
      if (!this.bounds.containsPoint(end)) {
        // Clamp to bounds
        return new THREE.Vector3(
          Math.max(this.bounds.min.x + radius, Math.min(end.x, this.bounds.max.x - radius)),
          end.y,
          Math.max(this.bounds.min.z + radius, Math.min(end.z, this.bounds.max.z - radius))
        );
      }
      return end.clone();
    }

    // Debug collision
    if (Math.random() < 0.01) { // Throttle logs
      if (collision.type === 'box') {
        console.log(`[CityCollider] Collision with box: ${collision.object.name}`);
      } else {
        console.log(`[CityCollider] Collision with cylinder`);
      }
    }

    // Collision detected - try sliding along walls
    const adjustedEnd = end.clone();

    // Try moving only in X
    const tryX = new THREE.Vector3(end.x, start.y, start.z);
    if (!this.checkSphere(tryX, radius)) {
      adjustedEnd.z = start.z;
      return adjustedEnd;
    }

    // Try moving only in Z
    const tryZ = new THREE.Vector3(start.x, start.y, end.z);
    if (!this.checkSphere(tryZ, radius)) {
      adjustedEnd.x = start.x;
      return adjustedEnd;
    }

    // Can't move at all
    return start.clone();
  }

  /**
   * Raycast against colliders
   */
  public raycast(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number = 100): {
    hit: boolean;
    distance: number;
    point: THREE.Vector3 | null;
    collider: Collider | null;
  } {
    const raycaster = new THREE.Raycaster(origin, direction.normalize(), 0, maxDistance);

    let closestHit = {
      hit: false,
      distance: maxDistance,
      point: null as THREE.Vector3 | null,
      collider: null as Collider | null,
    };

    // Check against all colliders (could be optimized with spatial queries)
    for (const collider of this.colliders) {
      if (collider.type === 'box') {
        const intersection = new THREE.Vector3();
        if (raycaster.ray.intersectBox(collider.box, intersection)) {
          const distance = origin.distanceTo(intersection);
          if (distance < closestHit.distance) {
            closestHit = {
              hit: true,
              distance,
              point: intersection,
              collider,
            };
          }
        }
      }
    }

    return closestHit;
  }

  /**
   * Get all colliders (for debug visualization)
   */
  public getColliders(): Collider[] {
    return this.colliders;
  }

  /**
   * Clear all colliders
   */
  public clear(): void {
    this.colliders = [];
    this.dynamicColliders = [];
    this.grid.clear();
  }
}

/**
 * Singleton instance
 */
let instance: CityCollider | null = null;

export function getCityCollider(): CityCollider {
  if (!instance) {
    instance = new CityCollider();
  }
  return instance;
}

export function resetCityCollider(): void {
  if (instance) {
    instance.clear();
  }
  instance = null;
}
