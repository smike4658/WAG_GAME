import * as THREE from 'three';
import { RoadNetwork, Waypoint } from './RoadNetwork';
import { ACC, createVehicleModel } from './models';
import { TrafficLightSystem } from './TrafficLightSystem';

/**
 * Vehicle state for advanced traffic simulation
 */
interface SimulatedVehicle {
  id: string;
  mesh: THREE.Object3D;

  // Position and movement
  position: THREE.Vector3;
  velocity: number;        // Current speed (units/s)
  acceleration: number;    // Current acceleration (units/s²)

  // Road following
  previousWaypointId: string; // Where we came from (to prevent U-turns)
  currentWaypointId: string;
  targetWaypointId: string;
  distanceToTarget: number;

  // Car-following model
  model: ACC;
  vehicleType: string;

  // Physical properties
  length: number;          // Vehicle length for gap calculation

  // Lane offset (right side driving)
  laneOffset: THREE.Vector3;

  // Model rotation offset: compensates for model's forward direction
  // If model's "front" is +X instead of +Z, this will be ~-PI/2
  modelRotationOffset: number;

  // Traffic light ignore timer - after turning, ignore lights for a short distance
  // This prevents stopping at bidirectional lights on the new road
  ignoreTrafficLightsDistance: number;

  /** Collision bounding box (world space) */
  collisionBox: THREE.Box3;

  // Smoothed rotation angle (prevents oscillation/flickering)
  smoothedRotationY: number;

  // Commitment timer - prevents changing waypoint decision too quickly
  waypointCommitmentTime: number;

  // Stuck timer - how long the vehicle has been nearly stopped
  stuckTime: number;
}

/**
 * Configuration for advanced traffic
 */
interface AdvancedTrafficConfig {
  /** Maximum number of vehicles */
  maxVehicles: number;
  /** Spawn interval in seconds */
  spawnInterval: number;
  /** Minimum gap for spawning */
  minSpawnGap: number;
  /** Arrival threshold - how close to waypoint before switching */
  arrivalThreshold: number;
  /** Lane offset from center line (for right-side driving) */
  laneOffset: number;
  /** Rotation smoothing factor (0-1, higher = faster rotation) */
  rotationSmoothing: number;
  /** Minimum time before vehicle can change waypoint decision (seconds) */
  waypointCommitmentDuration: number;
  /** Time after which a stuck vehicle will force its way through (seconds) */
  stuckTimeout: number;
}

const DEFAULT_CONFIG: AdvancedTrafficConfig = {
  maxVehicles: 150,     // 3x more vehicles for busier streets
  spawnInterval: 1,     // Faster spawning
  minSpawnGap: 8,       // Slightly tighter gaps
  arrivalThreshold: 3.5,
  laneOffset: 2.5,
  rotationSmoothing: 0.08,
  waypointCommitmentDuration: 0.5,
  stuckTimeout: 3.0,
};

/**
 * AdvancedTrafficSystem - Uses IDM/ACC car-following models
 *
 * Based on traffic-simulation-de by Martin Treiber:
 * - Vehicles follow waypoints on the road network
 * - Speed is controlled by IDM/ACC model considering:
 *   - Desired speed (based on vehicle type and speed limit)
 *   - Gap to vehicle ahead
 *   - Relative velocity to vehicle ahead
 */
export class AdvancedTrafficSystem {
  private readonly config: AdvancedTrafficConfig;
  private readonly roadNetwork: RoadNetwork;
  private readonly vehicles: Map<string, SimulatedVehicle> = new Map();
  private readonly vehicleGroup: THREE.Group;
  private vehicleCounter = 0;
  private enabled = true;
  private debugFrame = 0;

  // Vehicle meshes pool (from city model)
  private availableMeshes: THREE.Object3D[] = [];
  private usedMeshes: Set<THREE.Object3D> = new Set();

  // Traffic light system
  private trafficLights: TrafficLightSystem | null = null;

  // Scene reference for raycasting
  private scene: THREE.Scene | null = null;
  private raycaster: THREE.Raycaster = new THREE.Raycaster();

  constructor(
    roadNetwork: RoadNetwork,
    config: Partial<AdvancedTrafficConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.roadNetwork = roadNetwork;
    this.vehicleGroup = new THREE.Group();
    this.vehicleGroup.name = 'advanced_traffic';
  }

  /**
   * Set the scene for raycasting ground detection
   */
  public setScene(scene: THREE.Object3D): void {
    this.scene = scene as THREE.Scene; // Cast for internal usage, though we only traverse it
  }

  /**
   * Set the traffic light system for vehicles to obey
   */
  public setTrafficLightSystem(trafficLights: TrafficLightSystem): void {
    this.trafficLights = trafficLights;
    console.log('[AdvancedTraffic] Traffic light system connected');
  }

  /**
   * Raycast down to find ground level at position
   * Returns Y position of ground, or null if no ground found
   * Reserved for future terrain-following vehicle behavior
   * @internal
   */
  public findGroundLevel(position: THREE.Vector3): number | null {
    if (!this.scene) return null;

    const origin = position.clone();
    origin.y = position.y + 10;

    this.raycaster.set(origin, new THREE.Vector3(0, -1, 0));
    this.raycaster.far = 20;

    const meshes: THREE.Mesh[] = [];
    this.scene.traverse((child) => {
      if (child instanceof THREE.Mesh &&
        !child.name.toLowerCase().includes('vehicle') &&
        !child.name.toLowerCase().includes('car')) {
        meshes.push(child);
      }
    });

    const intersects = this.raycaster.intersectObjects(meshes, false);

    if (intersects.length > 0 && intersects[0]) {
      return intersects[0].point.y;
    }

    return null;
  }

  /**
   * Initialize from existing vehicle meshes in a city model
   */
  public initializeFromModel(cityModel: THREE.Group, _scale: number = 1): void {
    console.log('[AdvancedTraffic] Scanning for vehicle meshes...');

    const vehiclePatterns = [
      // Cartoon City format
      /^Car_\d+$/i,
      /^Van$/i,
      /^Futuristic_Car_\d+$/i,
      /^Truck_\d+$/i,
      /^Bus_\d+$/i,
      /^Vehicle_Car/i,
      /^Vehicle_Bus(?!_Stop)/i,
      /^Vehicle_Truck/i,
      /^Vehicle_Van/i,
      /^Vehicle_Taxi/i,
      // Low Poly City format: cars_001_362, trucks_001_xxx, etc.
      /^cars_\d+/i,
      /^trucks_\d+/i,
      /^buses_\d+/i,
      /^vans_\d+/i,
      // Generic patterns for other asset packs
      /^Food_?Truck/i,
      /^Ice_?Cream/i,
      /^Delivery/i,
      /^Pickup/i,
      /^Ambulance/i,
      /^Police/i,
      /^Fire_?Truck/i,
      /^Garbage/i,
      /^Step_?Van/i,
      /^SUV/i,
      /^Taxi/i,
      /^Jeep/i,
      /^Limo/i,
      /^School_?Bus/i,
      // Catch-all for "Car" or "Van" or "Truck" anywhere in name (risky but needed)
      /Car/i,
      /Van/i,
      /Truck/i,
      /Bus/i,
    ];

    const excludePatterns = [
      /Bus_Stop/i,
      /Tram_Stop/i,
      /_Wheel_/i,
      /_Spoiler/i,
      // Exclude vegetation
      /Tree/i,
      /Bush/i,
      /Plant/i,
      /Flower/i,
      /Grass/i,
      /Vegetation/i,
      /Palm/i,
      // Exclude static props
      /Bench/i,
      /Trash/i,
      /Lamp/i,
      /Light/i,
      /Sign/i,
      /Fence/i,
      /Building/i,
      /House/i,
      /Shop/i,
      /Store/i,
      /Prop/i,
      /Cartoon/i, // Exclude "Cartoon" prefix to avoid matching "Car" in "Cartoon"
      /Road/i,
      /Street/i,
      /Sidewalk/i,
    ];

    const processedNames = new Set<string>();

    cityModel.traverse((child) => {
      const name = child.name;
      if (!name || processedNames.has(name)) return;

      const isExcluded = excludePatterns.some(p => p.test(name));
      if (isExcluded) return;

      const isVehicle = vehiclePatterns.some(p => p.test(name));
      if (!isVehicle) return;

      processedNames.add(name);
      this.availableMeshes.push(child);
    });

    console.log(`[AdvancedTraffic] Found ${this.availableMeshes.length} vehicle meshes`);

    // Initialize vehicles on the road network
    this.spawnInitialVehicles();
  }

  /**
   * Set vehicle prefabs to use for spawning
   */
  public setVehiclePrefabs(prefabs: THREE.Object3D[]): void {
    this.availableMeshes = prefabs;
    console.log(`[AdvancedTraffic] Set ${prefabs.length} vehicle prefabs`);
    // If we haven't spawned yet (or want to add more), spawn now
    if (this.vehicles.size === 0) {
      this.spawnInitialVehicles();
    }
  }

  /**
   * Spawn initial vehicles on the road network
   * Uses existing vehicle mesh positions from the city model
   */
  private spawnInitialVehicles(): void {
    const waypoints = this.roadNetwork.getAllWaypoints();
    if (waypoints.length === 0) {
      console.warn('[AdvancedTraffic] No waypoints in road network!');
      return;
    }

    if (this.availableMeshes.length === 0) {
      console.warn('[AdvancedTraffic] No vehicle meshes available!');
      return;
    }

    // Spawn vehicles using their current positions in the model
    const toSpawn = Math.min(this.availableMeshes.length, this.config.maxVehicles);

    for (let i = 0; i < toSpawn; i++) {
      const mesh = this.availableMeshes[i];
      if (!mesh) continue;
      if (this.usedMeshes.has(mesh)) continue;

      // Get mesh's current world position
      const meshPos = new THREE.Vector3();
      mesh.getWorldPosition(meshPos);

      // Find nearest waypoint to the vehicle's position
      const nearestWp = this.roadNetwork.findNearestWaypoint(meshPos);
      if (!nearestWp) continue;

      // Spawn vehicle at its current position, targeting nearest waypoint
      this.spawnVehicleFromMesh(mesh, nearestWp);
    }

    console.log(`[AdvancedTraffic] Spawned ${this.vehicles.size} vehicles from model`);
  }

  /**
   * Spawn vehicle from existing mesh in the city model
   */
  private spawnVehicleFromMesh(mesh: THREE.Object3D, waypoint: Waypoint): SimulatedVehicle | null {
    // Get next waypoint (simple random choice for single-lane)
    const nextWp = this.roadNetwork.getNextWaypoint(waypoint.id);
    if (!nextWp) return null;

    const id = `vehicle_${this.vehicleCounter++}`;
    const vehicleType = this.extractVehicleType(mesh.name) || 'car';
    const model = createVehicleModel(vehicleType);

    // Set speed limit from waypoint
    model.speedlimit = waypoint.speedLimit;

    // Get mesh world position (use its existing position in the scene)
    const position = new THREE.Vector3();
    mesh.getWorldPosition(position);

    // Use waypoint height for vehicle position to ensure it's on the road
    // (Raycasting can hit the vehicle itself or other objects)
    position.y = waypoint.position.y;

    // Calculate vehicle length from bounding box
    const box = new THREE.Box3().setFromObject(mesh);
    const size = box.getSize(new THREE.Vector3());
    const length = Math.max(size.x, size.z);

    // Calculate initial lane offset
    const direction = nextWp.position.clone().sub(waypoint.position).normalize();
    let laneOffset = new THREE.Vector3(0, 0, 0);

    // Only apply offset if waypoint is not already lane-specific
    if (!nextWp.direction) {
      laneOffset = this.calculateLaneOffset(direction);
    }

    // Calculate expected rotation based on direction to first waypoint
    // This is what rotation.y SHOULD be if model's forward is +Z
    const initialDirection = nextWp.position.clone().sub(waypoint.position).normalize();
    const expectedAngle = Math.atan2(initialDirection.x, initialDirection.z);

    // The mesh's current rotation.y represents how it was placed in the scene
    // The difference tells us the model's forward direction offset
    // e.g., if model forward is +X, and car is facing +Z direction:
    //   - expectedAngle = 0 (for +Z)
    //   - mesh.rotation.y = -PI/2 (to rotate +X forward to +Z)
    //   - modelRotationOffset = -PI/2 - 0 = -PI/2
    let modelRotationOffset = mesh.rotation.y - expectedAngle;

    // Normalize to [-PI, PI]
    while (modelRotationOffset > Math.PI) modelRotationOffset -= 2 * Math.PI;
    while (modelRotationOffset < -Math.PI) modelRotationOffset += 2 * Math.PI;

    const vehicle: SimulatedVehicle = {
      id,
      mesh,
      position: position.clone(),
      velocity: model.v0 * 0.5, // Start at half desired speed
      acceleration: 0,
      previousWaypointId: waypoint.id,
      currentWaypointId: waypoint.id,
      targetWaypointId: nextWp.id,
      distanceToTarget: position.distanceTo(nextWp.position),
      model,
      vehicleType,
      length,
      laneOffset,
      modelRotationOffset,
      ignoreTrafficLightsDistance: 0,
      collisionBox: new THREE.Box3().setFromObject(mesh),
      smoothedRotationY: expectedAngle, // Initialize with direction to waypoint
      waypointCommitmentTime: 0,
      stuckTime: 0,
    };

    this.vehicles.set(id, vehicle);
    this.usedMeshes.add(mesh);

    return vehicle;
  }

  /**
   * Calculate lane offset vector (perpendicular to direction, to the right)
   * For right-hand traffic, offset is perpendicular to the right
   */
  private calculateLaneOffset(direction: THREE.Vector3): THREE.Vector3 {
    // Cross product with UP vector gives perpendicular direction
    // direction × UP = right vector
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(direction, up).normalize();
    return right.multiplyScalar(this.config.laneOffset);
  }

  /**
   * Extract vehicle type from mesh name
   */
  private extractVehicleType(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes('bus')) return 'bus';
    if (lower.includes('truck')) return 'truck';
    if (lower.includes('taxi')) return 'taxi';
    if (lower.includes('van')) return 'van';
    return 'car';
  }

  /**
   * Update all vehicles
   */
  public update(deltaTime: number): void {
    if (!this.enabled) return;

    // Clamp delta to avoid physics instability
    const dt = Math.min(deltaTime, 0.1);

    this.debugFrame++;

    // Update each vehicle
    for (const vehicle of this.vehicles.values()) {
      this.updateVehicle(vehicle, dt);
    }

    // Debug logging
    if (this.debugFrame % 300 === 0) {
      const avgSpeed = this.getAverageSpeed();
      console.log(`[AdvancedTraffic] ${this.vehicles.size} vehicles, avg speed: ${avgSpeed.toFixed(1)} u/s`);
    }
  }

  /**
   * Update a single vehicle using IDM/ACC
   */
  private updateVehicle(vehicle: SimulatedVehicle, dt: number): void {
    const targetWp = this.roadNetwork.getWaypoint(vehicle.targetWaypointId);
    if (!targetWp) return;

    // Update speed limit from current road
    vehicle.model.speedlimit = targetWp.speedLimit;

    // Find vehicle ahead on same road
    const { gap, leaderVelocity } = this.findLeader(vehicle);

    // Calculate acceleration using ACC model
    const acc = vehicle.model.calcAcc(
      gap,
      vehicle.velocity,
      leaderVelocity,
      0 // Leader acceleration (not tracked)
    );

    // Update velocity
    vehicle.acceleration = acc;
    vehicle.velocity = Math.max(0, vehicle.velocity + acc * dt);

    // Track stuck time - if vehicle is nearly stopped, increment stuck timer
    if (vehicle.velocity < 0.3) {
      vehicle.stuckTime += dt;
    } else {
      vehicle.stuckTime = 0; // Reset when moving
    }

    // Calculate direction to target waypoint (centerline)
    const direction = this.roadNetwork.getDirectionToWaypoint(
      vehicle.position,
      vehicle.targetWaypointId
    );

    // Check if vehicle needs to turn significantly before moving
    // This prevents "crab walking" - moving sideways while turning
    const targetAngle = Math.atan2(direction.x, direction.z);
    let angleDiffForMove = targetAngle - vehicle.smoothedRotationY;
    while (angleDiffForMove > Math.PI) angleDiffForMove -= 2 * Math.PI;
    while (angleDiffForMove < -Math.PI) angleDiffForMove += 2 * Math.PI;

    // If angle difference is too large (> 45 degrees), reduce speed significantly
    // Vehicle should turn first, then move
    const needsToTurn = Math.abs(angleDiffForMove) > 0.78; // ~45 degrees
    const turnSpeedMultiplier = needsToTurn ? 0.1 : 1.0; // Almost stop while turning

    // Debug: log when vehicle is actively turning
    if (needsToTurn && vehicle.id === 'vehicle_0' && this.debugFrame % 30 === 0) {
      console.log(`[DEBUG TURNING] Vehicle 0: angleDiff=${(angleDiffForMove * 180 / Math.PI).toFixed(0)}°, speed=${(vehicle.velocity * turnSpeedMultiplier).toFixed(1)}, targetWp=${vehicle.targetWaypointId}`);
    }

    // Update lane offset when direction changes significantly (at intersections)
    // ONLY if the waypoint doesn't specify a direction (which means it's a center-line waypoint)
    if (targetWp.direction) {
      // Waypoint is already lane-specific, so we don't need a large offset
      // We can add a small random variation to avoid cars driving in a perfect line
      // But for now, let's just zero it out to fix the "off-road" issue
      vehicle.laneOffset.set(0, 0, 0);
    } else {
      vehicle.laneOffset = this.calculateLaneOffset(direction);
    }

    // Move vehicle along centerline (reduced speed if turning)
    const moveDistance = vehicle.velocity * dt * turnSpeedMultiplier;
    vehicle.position.add(direction.clone().multiplyScalar(moveDistance));

    // Decrease traffic light ignore distance as vehicle moves
    if (vehicle.ignoreTrafficLightsDistance > 0) {
      vehicle.ignoreTrafficLightsDistance -= moveDistance;
    }

    // Calculate visual position with lane offset (right side driving)
    const visualPosition = vehicle.position.clone().add(vehicle.laneOffset);

    // Update mesh position - convert world position to local
    const parent = vehicle.mesh.parent;
    if (parent) {
      const localPos = visualPosition.clone();
      parent.worldToLocal(localPos);
      vehicle.mesh.position.copy(localPos);
    } else {
      vehicle.mesh.position.copy(visualPosition);
    }

    // Rotate to face direction with SMOOTHING to prevent oscillation
    // Car model has front facing +Z direction (front wheels at Z=+1.1)
    // atan2(x, z) gives angle from +Z axis, so no correction needed
    // IMPORTANT: Always update rotation, even when stopped - vehicle needs to turn to face new direction
    {
      const targetAngle = Math.atan2(direction.x, direction.z);

      // Smoothly interpolate rotation using shortest path (handle -PI to PI wrap)
      let angleDiff = targetAngle - vehicle.smoothedRotationY;

      // Normalize angle difference to [-PI, PI] for shortest rotation path
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

      // Use faster rotation when angle difference is large (turning at intersection)
      // Normal smoothing for small adjustments, faster for big turns
      const isLargeTurn = Math.abs(angleDiff) > 0.5; // ~30 degrees
      const isVeryLargeTurn = Math.abs(angleDiff) > 1.0; // ~57 degrees
      // Very large turns (like 90°) get aggressive smoothing for quick visual response
      const smoothingFactor = isVeryLargeTurn ? 0.25 : (isLargeTurn ? 0.15 : this.config.rotationSmoothing);

      // Apply smoothing - lerp towards target angle
      vehicle.smoothedRotationY += angleDiff * smoothingFactor;

      // Normalize smoothed angle to [-PI, PI]
      while (vehicle.smoothedRotationY > Math.PI) vehicle.smoothedRotationY -= 2 * Math.PI;
      while (vehicle.smoothedRotationY < -Math.PI) vehicle.smoothedRotationY += 2 * Math.PI;

      // Apply rotation: smoothedRotationY + modelRotationOffset
      // modelRotationOffset compensates for the model's forward direction
      // (e.g., if model forward is +X, offset is -PI/2)
      if (parent) {
        // Get parent's world rotation (handles nested hierarchies)
        const parentWorldQuat = new THREE.Quaternion();
        parent.getWorldQuaternion(parentWorldQuat);
        const parentEuler = new THREE.Euler().setFromQuaternion(parentWorldQuat, 'YXZ');
        const parentWorldRotY = parentEuler.y;

        vehicle.mesh.rotation.y = vehicle.smoothedRotationY + vehicle.modelRotationOffset - parentWorldRotY;
      } else {
        vehicle.mesh.rotation.y = vehicle.smoothedRotationY + vehicle.modelRotationOffset;
      }

      // Debug logging every 5 seconds for first vehicle
      if (this.debugFrame % 300 === 0 && vehicle.id === 'vehicle_0') {
        console.log(`[DEBUG] Vehicle 0: targetAngle=${(targetAngle * 180 / Math.PI).toFixed(1)}°, smoothedRotY=${(vehicle.smoothedRotationY * 180 / Math.PI).toFixed(1)}°, modelOffset=${(vehicle.modelRotationOffset * 180 / Math.PI).toFixed(1)}°, meshRotY=${(vehicle.mesh.rotation.y * 180 / Math.PI).toFixed(1)}°`);
      }
    }

    // Decrease waypoint commitment timer
    if (vehicle.waypointCommitmentTime > 0) {
      vehicle.waypointCommitmentTime -= dt;
    }

    // Check if reached target waypoint (use centerline position, not visual)
    vehicle.distanceToTarget = vehicle.position.distanceTo(targetWp.position);

    // Only advance to next waypoint if commitment timer expired
    if (vehicle.distanceToTarget < this.config.arrivalThreshold && vehicle.waypointCommitmentTime <= 0) {
      this.advanceToNextWaypoint(vehicle);
    }

    // Update collision box
    vehicle.collisionBox.setFromObject(vehicle.mesh);
  }

  /**
   * Find the vehicle ahead and calculate gap
   * Also considers red traffic lights as virtual stopped vehicles
   */
  private findLeader(vehicle: SimulatedVehicle): { gap: number; leaderVelocity: number } {
    let minGap = Infinity;
    let leaderVelocity = vehicle.model.v0; // Assume free road if no leader

    // Get direction we're heading
    const direction = this.roadNetwork.getDirectionToWaypoint(
      vehicle.position,
      vehicle.targetWaypointId
    );

    // Check traffic lights first - treat red light as stopped vehicle
    // BUT ignore traffic lights if we just turned (to avoid stopping at bidirectional lights)
    if (this.trafficLights && vehicle.ignoreTrafficLightsDistance <= 0) {
      const redLightDistance = this.trafficLights.getRedLightDistance(
        vehicle.position,
        direction
      );

      if (redLightDistance !== null && redLightDistance > 0) {
        // Red light ahead - treat as stopped vehicle at stop line
        if (redLightDistance < minGap) {
          minGap = redLightDistance;
          leaderVelocity = 0; // Traffic light is "stopped"
        }
      }
    }

    // Check vehicles ahead of us that are going roughly the same direction
    // Ignore vehicles coming towards us (they will pass by)
    for (const other of this.vehicles.values()) {
      if (other.id === vehicle.id) continue;

      // Calculate gap (distance minus vehicle lengths)
      const distance = vehicle.position.distanceTo(other.position);
      const gap = distance - vehicle.length / 2 - other.length / 2;

      // Skip if too far away (optimization)
      if (gap > 15) continue;

      // Check if other vehicle is ahead of us (in our direction of travel)
      const toOther = other.position.clone().sub(vehicle.position);
      const dotProduct = toOther.dot(direction);

      // Must be ahead of us (positive dot product)
      if (dotProduct <= 0) continue;

      // Get other vehicle's direction
      const otherDirection = this.roadNetwork.getDirectionToWaypoint(
        other.position,
        other.targetWaypointId
      );

      // Check if vehicles are going roughly the same direction (dot > 0)
      // If vehicles are going opposite directions (dot < 0), they will pass each other
      const sameDirection = direction.dot(otherDirection) > -0.3;

      // Skip vehicles coming towards us - they will pass by
      if (!sameDirection) continue;

      // Check if vehicle is in our path (not too far to the side)
      const lateralDistance = toOther.clone().sub(direction.clone().multiplyScalar(dotProduct)).length();

      // Only consider vehicles within ~3 units lateral distance (roughly 1.5 car widths)
      if (lateralDistance < 3 && gap < minGap) {
        minGap = gap;
        leaderVelocity = other.velocity;
      }
    }

    // Check for crossing trajectories (right-of-way rule)
    // Only yield if the other vehicle is actually moving and closer to intersection
    // Skip entirely if this vehicle has been stuck too long (force through)
    const isStuck = vehicle.stuckTime > this.config.stuckTimeout;
    if (!isStuck) {
      for (const other of this.vehicles.values()) {
        if (other.id === vehicle.id) continue;

        // Skip if other vehicle is stopped (to prevent deadlocks)
        if (other.velocity < 0.5) continue;

        if (!this.hasCrossingTrajectory(vehicle, other)) continue;
        if (!this.isToMyRight(vehicle, other)) continue;

        // Check who is closer to intersection - closer vehicle has priority
        const myTarget = this.roadNetwork.getWaypoint(vehicle.targetWaypointId);
        const otherTarget = this.roadNetwork.getWaypoint(other.targetWaypointId);
        if (myTarget && otherTarget) {
          const myDist = vehicle.position.distanceTo(myTarget.position);
          const otherDist = other.position.distanceTo(otherTarget.position);

          // If I'm significantly closer to intersection, I go first (break tie)
          if (myDist < otherDist - 3) continue;
        }

        const distance = vehicle.position.distanceTo(other.position);
        const gap = distance - vehicle.length / 2 - other.length / 2;

        // Reduced from 15 to 8 for less aggressive yielding
        if (gap < 8 && gap < minGap) {
          minGap = gap;
          leaderVelocity = 0;
        }
      }
    } // end if (!isStuck)

    return { gap: minGap, leaderVelocity };
  }

  /**
   * Check if two vehicles have crossing trajectories at an intersection
   */
  private hasCrossingTrajectory(vehicle: SimulatedVehicle, other: SimulatedVehicle): boolean {
    const myTarget = this.roadNetwork.getWaypoint(vehicle.targetWaypointId);
    const otherTarget = this.roadNetwork.getWaypoint(other.targetWaypointId);

    if (!myTarget || !otherTarget) return false;
    if (!myTarget.isIntersection && !otherTarget.isIntersection) return false;

    const myIntersectionDist = vehicle.position.distanceTo(myTarget.position);
    const otherIntersectionDist = other.position.distanceTo(otherTarget.position);

    if (myIntersectionDist > 20 || otherIntersectionDist > 20) return false;

    const myDir = this.roadNetwork.getDirectionToWaypoint(vehicle.position, vehicle.targetWaypointId);
    const otherDir = this.roadNetwork.getDirectionToWaypoint(other.position, other.targetWaypointId);

    const cross = myDir.x * otherDir.z - myDir.z * otherDir.x;

    return Math.abs(cross) > 0.3;
  }

  /**
   * Check if other vehicle is to our right (has right-of-way)
   */
  private isToMyRight(vehicle: SimulatedVehicle, other: SimulatedVehicle): boolean {
    const toOther = other.position.clone().sub(vehicle.position);
    const myDir = this.roadNetwork.getDirectionToWaypoint(vehicle.position, vehicle.targetWaypointId);

    const cross = myDir.x * toOther.z - myDir.z * toOther.x;

    return cross > 0;
  }

  /**
   * Advance vehicle to next waypoint
   * Prevents U-turns by excluding the waypoint we came from AND previous waypoint
   * Uses commitment timer to prevent oscillation
   */
  private advanceToNextWaypoint(vehicle: SimulatedVehicle): void {
    const currentWp = this.roadNetwork.getWaypoint(vehicle.targetWaypointId);
    if (!currentWp) return;

    // Get current direction (from current position to target waypoint)
    const currentDirection = currentWp.position.clone().sub(vehicle.position).normalize();

    // Exclude BOTH the current waypoint AND the previous waypoint to prevent U-turns
    // This is the key fix - we need to filter out both to prevent oscillation
    const excludeIds = new Set([vehicle.currentWaypointId, vehicle.previousWaypointId]);

    // Get all possible next waypoints, excluding where we came from
    const possibleNextIds = currentWp.connections.filter(id => !excludeIds.has(id));

    // At intersections, use more randomness to distribute traffic
    // On straight roads, prefer continuing forward
    const isAtIntersection = currentWp.isIntersection || possibleNextIds.length > 1;

    let bestNextId: string | null = null;

    if (isAtIntersection && possibleNextIds.length > 0) {
      // At intersections: weighted random choice
      // Give some preference to forward but allow turns frequently
      const candidates: Array<{ id: string; weight: number }> = [];
      let totalWeight = 0;

      for (const candidateId of possibleNextIds) {
        const candidateWp = this.roadNetwork.getWaypoint(candidateId);
        if (!candidateWp) continue;

        const toCandidate = candidateWp.position.clone().sub(currentWp.position).normalize();
        const forwardScore = currentDirection.dot(toCandidate);

        // Weight: forward gets 2x, perpendicular gets 1.5x, backward is NOT allowed
        // U-turns should never happen - they cause cars to drive in reverse
        let weight: number;
        if (forwardScore > 0.7) {
          weight = 2.0; // Forward
        } else if (forwardScore > -0.5) {
          weight = 1.5; // Turn (perpendicular, up to ~120°)
        } else {
          weight = 0; // Backwards - never allow U-turns
          continue; // Skip this candidate entirely
        }

        candidates.push({ id: candidateId, weight });
        totalWeight += weight;
      }

      // Weighted random selection
      if (candidates.length > 0 && totalWeight > 0) {
        let random = Math.random() * totalWeight;
        for (const candidate of candidates) {
          random -= candidate.weight;
          if (random <= 0) {
            bestNextId = candidate.id;
            break;
          }
        }
        // Fallback
        if (!bestNextId) {
          bestNextId = candidates[candidates.length - 1]!.id;
        }
      }
    } else {
      // On straight road: prefer forward direction
      let bestScore = -Infinity;
      for (const candidateId of possibleNextIds) {
        const candidateWp = this.roadNetwork.getWaypoint(candidateId);
        if (!candidateWp) continue;

        const toCandidate = candidateWp.position.clone().sub(currentWp.position).normalize();
        const score = currentDirection.dot(toCandidate) + (Math.random() - 0.5) * 0.2;

        if (score > bestScore) {
          bestScore = score;
          bestNextId = candidateId;
        }
      }
    }

    // If no forward candidates, try to find ANY non-backward option
    if (!bestNextId && currentWp.connections.length > 0) {
      // Filter out backward directions (U-turns) - never go back where we came from
      const nonBackwardOptions = currentWp.connections.filter(id => {
        if (excludeIds.has(id)) return false;
        const wp = this.roadNetwork.getWaypoint(id);
        if (!wp) return false;
        const toWp = wp.position.clone().sub(currentWp.position).normalize();
        // Allow anything that's not directly backward (dot > -0.5 means < 120° turn)
        return currentDirection.dot(toWp) > -0.5;
      });

      if (nonBackwardOptions.length > 0) {
        bestNextId = nonBackwardOptions[Math.floor(Math.random() * nonBackwardOptions.length)]!;
      } else {
        // Absolute last resort: stay at current waypoint and wait
        // Don't pick a backward direction - this would make the car drive in reverse
        bestNextId = null;
      }
    }

    if (bestNextId) {
      const nextWp = this.roadNetwork.getWaypoint(bestNextId);

      if (nextWp) {
        // Calculate new direction (from current to next waypoint)
        const newDirection = nextWp.position.clone().sub(currentWp.position).normalize();

        // Check if this is a significant turn (direction change > 30 degrees)
        const dotProduct = currentDirection.dot(newDirection);
        const isTurning = dotProduct < 0.866; // cos(30°) ≈ 0.866

        // Calculate turn angle for logging
        const turnAngle = Math.acos(Math.min(1, Math.max(-1, dotProduct))) * 180 / Math.PI;

        // Debug logging for turns at intersections
        if (isTurning && vehicle.id === 'vehicle_0') {
          console.log(`[DEBUG TURN] Vehicle 0 at intersection: turnAngle=${turnAngle.toFixed(0)}°, from=${vehicle.targetWaypointId} to=${bestNextId}, pos=(${vehicle.position.x.toFixed(1)}, ${vehicle.position.z.toFixed(1)})`);
        }

        // Update waypoint chain
        vehicle.previousWaypointId = vehicle.currentWaypointId;
        vehicle.currentWaypointId = vehicle.targetWaypointId;
        vehicle.targetWaypointId = bestNextId;
        vehicle.distanceToTarget = vehicle.position.distanceTo(nextWp.position);

        // Set commitment timer to prevent rapid waypoint changes (oscillation)
        vehicle.waypointCommitmentTime = this.config.waypointCommitmentDuration;

        // If turning, ignore traffic lights for a short distance after the turn
        if (isTurning) {
          vehicle.ignoreTrafficLightsDistance = 25;
        }
      }
    }
  }

  /**
   * Get average speed of all vehicles
   */
  private getAverageSpeed(): number {
    if (this.vehicles.size === 0) return 0;
    let total = 0;
    for (const v of this.vehicles.values()) {
      total += v.velocity;
    }
    return total / this.vehicles.size;
  }

  /**
   * Enable/disable traffic
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Get vehicle count
   */
  public getVehicleCount(): number {
    return this.vehicles.size;
  }

  /**
   * Get statistics
   */
  public getStats(): { vehicles: number; avgSpeed: number; avgAccel: number } {
    let totalSpeed = 0;
    let totalAccel = 0;

    for (const v of this.vehicles.values()) {
      totalSpeed += v.velocity;
      totalAccel += v.acceleration;
    }

    const count = this.vehicles.size || 1;
    return {
      vehicles: this.vehicles.size,
      avgSpeed: totalSpeed / count,
      avgAccel: totalAccel / count,
    };
  }

  /**
   * Get road network
   */
  public getRoadNetwork(): RoadNetwork {
    return this.roadNetwork;
  }

  /**
   * Get vehicle group
   */
  public getVehicleGroup(): THREE.Group {
    return this.vehicleGroup;
  }

  /**
   * Clear all vehicles
   */
  public clear(): void {
    this.vehicles.clear();
    this.usedMeshes.clear();
  }

  /**
   * Check if a position collides with any vehicle
   */
  public checkCollisionAtPosition(position: THREE.Vector3, radius: number = 1): SimulatedVehicle | null {
    const testBox = new THREE.Box3(
      position.clone().subScalar(radius),
      position.clone().addScalar(radius)
    );

    for (const vehicle of this.vehicles.values()) {
      if (vehicle.collisionBox.intersectsBox(testBox)) {
        return vehicle;
      }
    }

    return null;
  }

  /**
   * Check collision with player bounding box
   */
  public checkCollisionWithPlayer(playerBox: THREE.Box3): SimulatedVehicle | null {
    for (const vehicle of this.vehicles.values()) {
      if (vehicle.collisionBox.intersectsBox(playerBox)) {
        return vehicle;
      }
    }

    return null;
  }
}
