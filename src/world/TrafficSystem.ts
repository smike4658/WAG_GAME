import * as THREE from 'three';

/**
 * Traffic configuration
 */
interface TrafficConfig {
  minSpeed: number;            // Minimum speed (units/s)
  maxSpeed: number;            // Maximum speed (units/s)
  maxTravelDistance: number;   // How far vehicles travel before turning around
  followDistance: number;      // Distance to start slowing for car ahead
}

const DEFAULT_CONFIG: TrafficConfig = {
  minSpeed: 5,                // Reasonable city driving speed
  maxSpeed: 12,               // Max city speed
  maxTravelDistance: 60,      // Not used in new system
  followDistance: 8,          // Not used in new system
};

/**
 * Vehicle state - uses existing meshes from the city model
 */
interface TrafficVehicle {
  mesh: THREE.Object3D;

  // Movement direction (world space)
  direction: THREE.Vector3;            // Current movement direction
  distanceSinceLastTurn: number;       // Distance since last turn
  turnDistance: number;                // Distance before next turn (randomized)

  // Speed
  speed: number;
  targetSpeed: number;

  // Type for speed adjustment
  vehicleType: string;

  // Original Y position to maintain height
  baseY: number;
}

/**
 * Simple Traffic System
 *
 * Finds existing vehicle meshes in the city model and makes them
 * drive back and forth along their initial facing direction.
 */
export class TrafficSystem {
  private readonly config: TrafficConfig;
  private readonly vehicles: TrafficVehicle[] = [];
  private enabled = true;
  private debugFrame = 0;

  constructor(config: Partial<TrafficConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    console.log('[TrafficSystem] Created - will animate existing vehicles');
  }

  /**
   * Initialize traffic from a static 3D model
   * Finds existing Vehicle_* meshes and sets them up for animation
   */
  public initializeFromModel(cityModel: THREE.Group, scale: number = 1): void {
    console.log(`[TrafficSystem] Scanning model for vehicles (scale: ${scale})`);

    // DEBUG: List all mesh names to find actual naming convention
    const allNames: string[] = [];
    cityModel.traverse((child) => {
      if (child.name) {
        allNames.push(child.name);
      }
    });
    console.log(`[TrafficSystem] DEBUG - All ${allNames.length} mesh names in model:`);
    // Show first 50 names and any containing "car", "vehicle", "auto"
    const carRelated = allNames.filter(n =>
      /car|vehicle|auto|bus|truck|van|taxi/i.test(n)
    );
    console.log(`[TrafficSystem] Car-related names (${carRelated.length}):`, carRelated);
    console.log(`[TrafficSystem] First 50 names:`, allNames.slice(0, 50));

    this.findVehiclesInModel(cityModel, scale);

    console.log(`[TrafficSystem] Found ${this.vehicles.length} vehicles to animate`);
  }

  /**
   * Find vehicle meshes in the model by name pattern
   */
  private findVehiclesInModel(cityModel: THREE.Group, _scale: number): void {
    // Patterns for vehicle names - supports multiple city model formats
    const vehiclePatterns = [
      // SimplePoly format: Vehicle_Car_01, Vehicle_Bus_02, etc.
      /^Vehicle_Car/i,
      /^Vehicle_SUV/i,
      /^Vehicle_Taxi/i,
      /^Vehicle_Bus(?!_Stop)/i,  // Bus but not Bus_Stop
      /^Vehicle_Truck/i,
      /^Vehicle_Van/i,
      /^Vehicle_Pick/i,
      /^Vehicle_Ambulance/i,
      /^Vehicle_Police/i,
      // Cartoon City format: Car_06, Van, Futuristic_Car_1, etc.
      /^Car_\d+$/i,              // Car_06, Car_13, Car_16, Car_19
      /^Van$/i,                  // Van (exact match)
      /^Futuristic_Car_\d+$/i,   // Futuristic_Car_1
      /^Truck_\d+$/i,            // Truck_01, etc.
      /^Bus_\d+$/i,              // Bus_01, etc. (but not Bus_Stop)
    ];

    // Exclude patterns (props, not actual vehicles)
    const excludePatterns = [
      /Bus_Stop/i,
      /Tram_Stop/i,
      /Props_/i,
      /_Stop/i,
      /parked/i,
      /_Wheel_/i,               // Exclude wheel children
      /_Spoiler/i,              // Exclude spoiler children
    ];

    // First pass: collect building positions for parking detection
    const buildingPositions: THREE.Vector3[] = [];
    cityModel.traverse((child) => {
      const name = child.name.toLowerCase();
      if (name.includes('building') || name.includes('house') || name.includes('shop') ||
          name.includes('store') || name.includes('office') || name.includes('apart')) {
        const pos = new THREE.Vector3();
        child.getWorldPosition(pos);
        buildingPositions.push(pos);
      }
    });

    console.log(`[TrafficSystem] Found ${buildingPositions.length} buildings for parking detection`);

    // DISABLED: Parking filter was too aggressive - filtered out ALL vehicles
    // With 0.03 scale, everything is very close together in world space
    const skipParkingFilter = true; // Always skip for now
    console.log(`[TrafficSystem] Parking filter disabled - will animate all vehicles`);

    const processedNames = new Set<string>();
    let parkedCount = 0;
    let totalVehiclesFound = 0;

    cityModel.traverse((child) => {
      const name = child.name;
      if (!name || processedNames.has(name)) return;

      // Check if excluded
      const isExcluded = excludePatterns.some(pattern => pattern.test(name));
      if (isExcluded) return;

      // Check if it's a vehicle
      const isVehicle = vehiclePatterns.some(pattern => pattern.test(name));
      if (!isVehicle) return;

      processedNames.add(name);
      totalVehiclesFound++;

      // Get vehicle world position
      const vehiclePos = new THREE.Vector3();
      child.getWorldPosition(vehiclePos);

      // Check if too close to a building (likely parked)
      // Only skip if VERY close to a building (within 2 units)
      let isParked = false;
      if (!skipParkingFilter) {
        const PARKED_DISTANCE = 2;
        isParked = buildingPositions.some(buildingPos => {
          const dist = vehiclePos.distanceTo(buildingPos);
          return dist < PARKED_DISTANCE;
        });
      }

      if (isParked) {
        parkedCount++;
        return; // Skip parked vehicles
      }

      // Get vehicle type from name
      const vehicleType = this.extractVehicleType(name);

      // Calculate initial direction from bounding box
      const initialDir = this.calculateForwardDirection(child);

      // Randomly flip direction 50% of the time
      if (Math.random() > 0.5) {
        initialDir.negate();
      }

      // Random speed based on vehicle type
      const baseSpeed = this.config.minSpeed +
        Math.random() * (this.config.maxSpeed - this.config.minSpeed);
      const speedMultiplier = this.getSpeedMultiplier(vehicleType);
      const targetSpeed = baseSpeed * speedMultiplier;

      // Get world position for base Y
      const worldPos = new THREE.Vector3();
      child.getWorldPosition(worldPos);

      // Create vehicle entry with turning behavior
      const vehicle: TrafficVehicle = {
        mesh: child,
        direction: initialDir,
        distanceSinceLastTurn: 0,
        turnDistance: 15 + Math.random() * 30, // Turn every 15-45 units
        speed: targetSpeed,
        targetSpeed: targetSpeed,
        vehicleType: vehicleType,
        baseY: worldPos.y,
      };

      this.vehicles.push(vehicle);

      // Log first few vehicles
      if (this.vehicles.length <= 5) {
        console.log(`[TrafficSystem] Vehicle: "${name}" type=${vehicleType} speed=${targetSpeed.toFixed(1)} dir=(${initialDir.x.toFixed(1)},${initialDir.z.toFixed(1)})`);
      }
    });

    console.log(`[TrafficSystem] Found ${totalVehiclesFound} vehicles total, skipped ${parkedCount} parked, animating ${this.vehicles.length}`);
  }

  /**
   * Calculate forward direction from mesh bounding box
   * Cars are longer than wide, so longest horizontal axis is forward
   */
  private calculateForwardDirection(mesh: THREE.Object3D): THREE.Vector3 {
    // Create bounding box from mesh
    const box = new THREE.Box3().setFromObject(mesh);
    const size = box.getSize(new THREE.Vector3());

    // Determine which horizontal axis is longer (that's the forward direction)
    // X and Z are horizontal, Y is up
    let forward: THREE.Vector3;

    if (size.x > size.z) {
      // Car is aligned with X axis
      forward = new THREE.Vector3(1, 0, 0);
    } else {
      // Car is aligned with Z axis
      forward = new THREE.Vector3(0, 0, 1);
    }

    // 50% chance to flip direction (cars could be facing either way)
    // Actually, let's be consistent - always use positive direction
    // The turning around logic will handle bidirectional movement

    return forward;
  }

  /**
   * Extract vehicle type from mesh name
   */
  private extractVehicleType(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes('bus')) return 'bus';
    if (lower.includes('truck')) return 'truck';
    if (lower.includes('taxi')) return 'taxi';
    if (lower.includes('ambulance')) return 'ambulance';
    if (lower.includes('police')) return 'police';
    if (lower.includes('van')) return 'van';
    if (lower.includes('suv')) return 'suv';
    return 'car';
  }

  /**
   * Get speed multiplier for vehicle type
   */
  private getSpeedMultiplier(type: string): number {
    switch (type) {
      case 'bus': return 0.6;      // Buses are slower
      case 'truck': return 0.65;   // Trucks are slower
      case 'van': return 0.85;     // Vans slightly slower
      case 'ambulance': return 1.2; // Emergency vehicles faster
      case 'police': return 1.2;
      default: return 1.0;
    }
  }

  /**
   * Update all vehicles
   */
  public update(deltaTime: number): void {
    if (!this.enabled || this.vehicles.length === 0) return;

    // Clamp delta to avoid huge jumps
    const dt = Math.min(deltaTime, 0.1);

    this.debugFrame++;
    const shouldLog = this.debugFrame % 300 === 0;
    const shouldLogDetail = this.debugFrame <= 5; // Log first 5 frames in detail

    for (const vehicle of this.vehicles) {
      this.updateVehicle(vehicle, dt);
    }

    // Log first vehicle's position for first few frames
    const firstVehicle = this.vehicles[0];
    if (shouldLogDetail && firstVehicle) {
      console.log(`[TrafficSystem] Frame ${this.debugFrame}: dt=${dt.toFixed(3)} speed=${firstVehicle.speed.toFixed(1)} distToTurn=${firstVehicle.distanceSinceLastTurn.toFixed(1)}/${firstVehicle.turnDistance.toFixed(0)} pos=(${firstVehicle.mesh.position.x.toFixed(2)}, ${firstVehicle.mesh.position.z.toFixed(2)})`);
    }

    if (shouldLog) {
      const avgSpeed = this.vehicles.reduce((sum, v) => sum + v.speed, 0) / this.vehicles.length;
      console.log(`[TrafficSystem] ${this.vehicles.length} vehicles, avg speed: ${avgSpeed.toFixed(1)} units/s`);
    }
  }

  /**
   * Update a single vehicle - drives back and forth along road
   */
  private updateVehicle(vehicle: TrafficVehicle, dt: number): void {
    vehicle.speed = vehicle.targetSpeed;

    // Calculate movement
    const moveAmount = vehicle.speed * dt;

    // Update distance traveled
    vehicle.distanceSinceLastTurn += moveAmount;

    // Turn around after traveling a distance (no random turning off road)
    if (vehicle.distanceSinceLastTurn >= vehicle.turnDistance) {
      // Just reverse direction (180 degrees) - stays on same road
      vehicle.direction.negate();

      // Rotate the mesh to face new direction
      const angle = Math.atan2(vehicle.direction.x, vehicle.direction.z);
      vehicle.mesh.rotation.y = angle;

      // Reset distance and set new travel distance before turning around
      vehicle.distanceSinceLastTurn = 0;
      vehicle.turnDistance = 30 + Math.random() * 40; // Travel 30-70 units before turning
    }

    // Move forward in current direction
    vehicle.mesh.position.x += vehicle.direction.x * moveAmount;
    vehicle.mesh.position.z += vehicle.direction.z * moveAmount;

    // Keep at original height
    const worldPos = new THREE.Vector3();
    vehicle.mesh.getWorldPosition(worldPos);
    if (Math.abs(worldPos.y - vehicle.baseY) > 0.1) {
      vehicle.mesh.position.y += (vehicle.baseY - worldPos.y) * 0.1;
    }
  }

  /**
   * Enable/disable traffic
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.log(`[TrafficSystem] ${enabled ? 'Enabled' : 'Disabled'}`);
  }

  /**
   * Get vehicle count
   */
  public getVehicleCount(): number {
    return this.vehicles.length;
  }

  /**
   * Get statistics
   */
  public getStats(): { vehicles: number; avgSpeed: number } {
    const avgSpeed = this.vehicles.length > 0
      ? this.vehicles.reduce((sum, v) => sum + v.speed, 0) / this.vehicles.length
      : 0;

    return {
      vehicles: this.vehicles.length,
      avgSpeed,
    };
  }

  /**
   * Clear all vehicles
   */
  public clear(): void {
    this.vehicles.length = 0;
  }

  /**
   * Get vehicle group - not used in this approach but kept for API compatibility
   */
  public getVehicleGroup(): THREE.Group {
    return new THREE.Group(); // Empty group, vehicles are part of cityModel
  }
}
