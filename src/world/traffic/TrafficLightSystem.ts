import * as THREE from 'three';
import { RoadNetwork } from './RoadNetwork';

/**
 * Traffic light state
 */
export type TrafficLightState = 'red' | 'yellow' | 'green';

/**
 * Light bulb reference (individual red/yellow/green light)
 */
interface LightBulb {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  color: 'red' | 'yellow' | 'green';
  originalEmissive: THREE.Color;
}

/**
 * Single traffic light
 */
interface TrafficLight {
  id: string;
  mesh: THREE.Object3D;
  position: THREE.Vector3;
  /** Direction the light faces (cars approaching from this direction see it) */
  facingDirection: THREE.Vector3;
  /** Current state */
  state: TrafficLightState;
  /** Which intersection group this belongs to */
  intersectionId: string;
  /** Phase within the intersection (0 = N/S, 1 = E/W) */
  phase: number;
  /** Individual light bulbs for visual control */
  bulbs: LightBulb[];
}

/**
 * Intersection with traffic lights
 */
interface TrafficIntersection {
  id: string;
  center: THREE.Vector3;
  lights: TrafficLight[];
  /** Current active phase (0 or 1) */
  currentPhase: number;
  /** Time remaining in current phase */
  phaseTimer: number;
}

/**
 * Configuration for traffic light system
 */
interface TrafficLightConfig {
  /** Duration of green phase in seconds */
  greenDuration: number;
  /** Duration of yellow phase in seconds */
  yellowDuration: number;
  /** Duration of all-red phase in seconds (safety gap) */
  allRedDuration: number;
  /** Distance to group lights into same intersection */
  intersectionRadius: number;
  /** Distance at which vehicles start checking for red lights */
  stopLineDistance: number;
}

const DEFAULT_CONFIG: TrafficLightConfig = {
  greenDuration: 10, // Shorter cycles to reduce congestion
  yellowDuration: 2,
  allRedDuration: 1,
  intersectionRadius: 20,
  stopLineDistance: 15,
};

/**
 * TrafficLightSystem - Manages traffic lights at intersections
 *
 * Features:
 * - Detects traffic lights from city model
 * - Groups lights by intersection
 * - Cycles through phases (N/S green, then E/W green)
 * - Provides API for vehicles to check if they should stop
 */
export class TrafficLightSystem {
  private readonly config: TrafficLightConfig;
  private readonly lights: Map<string, TrafficLight> = new Map();
  private readonly intersections: Map<string, TrafficIntersection> = new Map();
  private lightCounter = 0;
  private intersectionCounter = 0;
  private enabled = true;

  constructor(config: Partial<TrafficLightConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize traffic lights from city model
   */
  public initializeFromModel(cityModel: THREE.Group): void {
    console.log('[TrafficLights] Scanning for traffic lights...');

    const trafficLightMeshes: Array<{ mesh: THREE.Object3D; position: THREE.Vector3; rotation: number }> = [];

    cityModel.traverse((child) => {
      const name = child.name || '';

      // Match traffic_light_xxx pattern
      if (/^traffic_light_\d+/i.test(name)) {
        const worldPos = new THREE.Vector3();
        child.getWorldPosition(worldPos);

        trafficLightMeshes.push({
          mesh: child,
          position: worldPos,
          rotation: child.rotation.y,
        });
      }
    });

    console.log(`[TrafficLights] Found ${trafficLightMeshes.length} traffic light meshes`);

    // Group lights by intersection (cluster by position)
    const intersectionGroups = this.clusterLightsByPosition(trafficLightMeshes);

    console.log(`[TrafficLights] Grouped into ${intersectionGroups.length} intersections`);

    // Create intersection objects
    for (const group of intersectionGroups) {
      const intersectionId = `intersection_${this.intersectionCounter++}`;

      // Calculate intersection center
      const center = new THREE.Vector3();
      for (const item of group) {
        center.add(item.position);
      }
      center.divideScalar(group.length);

      const intersection: TrafficIntersection = {
        id: intersectionId,
        center,
        lights: [],
        currentPhase: 0, // Start at phase cycle 0 (Phase 0 GREEN, Phase 1 RED)
        phaseTimer: this.config.greenDuration,
      };

      // Create traffic light objects
      for (const item of group) {
        const lightId = `light_${this.lightCounter++}`;

        // Determine facing direction from rotation
        // Quaternion [0, 0.707, 0, 0.707] = 90° Y rotation
        // Default facing is +Z, rotation rotates it
        const facingDirection = new THREE.Vector3(0, 0, 1);
        facingDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), item.rotation);

        // Determine phase based on facing direction
        // Phase 0: N/S (facing roughly +Z or -Z)
        // Phase 1: E/W (facing roughly +X or -X)
        const absX = Math.abs(facingDirection.x);
        const absZ = Math.abs(facingDirection.z);
        const phase = absX > absZ ? 1 : 0;

        // Find light bulbs in this traffic light
        const bulbs = this.findLightBulbs(item.mesh);

        const light: TrafficLight = {
          id: lightId,
          mesh: item.mesh,
          position: item.position.clone(),
          facingDirection: facingDirection.normalize(),
          state: phase === 0 ? 'green' : 'red', // Phase 0 starts green
          intersectionId,
          phase,
          bulbs,
        };

        this.lights.set(lightId, light);
        intersection.lights.push(light);
      }

      this.intersections.set(intersectionId, intersection);

      // Log intersection info
      const phase0Count = intersection.lights.filter(l => l.phase === 0).length;
      const phase1Count = intersection.lights.filter(l => l.phase === 1).length;
      console.log(`[TrafficLights] Intersection ${intersectionId} at (${center.x.toFixed(1)}, ${center.z.toFixed(1)}): ${phase0Count} N/S, ${phase1Count} E/W lights`);
    }

    // Update visual state
    this.updateAllLightVisuals();
  }

  /**
   * Find individual light bulbs in a traffic light mesh
   * The mesh has multiple materials - "Emissive" material contains the lights
   * We identify red/yellow/green by the emissive color
   */
  private findLightBulbs(trafficLightMesh: THREE.Object3D): LightBulb[] {
    const bulbs: LightBulb[] = [];
    let debugLogged = false;

    trafficLightMesh.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;

      // Traffic light mesh has multiple materials as an array
      const materials = Array.isArray(child.material) ? child.material : [child.material];

      materials.forEach((mat, _index) => {
        if (!(mat instanceof THREE.MeshStandardMaterial)) return;

        // Look for emissive materials (the light bulbs)
        const matName = mat.name?.toLowerCase() || '';
        const isEmissive = matName.includes('emissive') || matName.includes('light');

        // Also check if it has significant emissive color
        const hasEmission = mat.emissive && (
          mat.emissive.r > 0.1 || mat.emissive.g > 0.1 || mat.emissive.b > 0.1
        );

        if (!debugLogged) {
          console.log(`[TrafficLights] Material "${mat.name}": emissive=${mat.emissive?.getHexString()}, isEmissive=${isEmissive}, hasEmission=${hasEmission}`);
        }

        if (isEmissive || hasEmission) {
          // Determine color from emissive RGB values
          const r = mat.emissive?.r || 0;
          const g = mat.emissive?.g || 0;
          const b = mat.emissive?.b || 0;

          let color: 'red' | 'yellow' | 'green';

          // Classify by dominant color
          if (r > g && r > b) {
            color = 'red';
          } else if (g > r && g > b) {
            color = 'green';
          } else if (r > 0.3 && g > 0.3) {
            color = 'yellow';
          } else {
            // Default - treat white/bright as all colors (we'll control via intensity)
            // For now, add all three types
            color = 'green'; // Will be overridden below
          }

          // Store original emissive for restoration
          const originalEmissive = mat.emissive.clone();

          bulbs.push({
            mesh: child,
            material: mat,
            color,
            originalEmissive,
          });
        }
      });

      debugLogged = true;
    });

    // If we found emissive material but couldn't determine colors,
    // create virtual bulbs that we'll control by changing emissive color
    if (bulbs.length === 1) {
      // Single emissive material - we'll change its color directly
      const singleBulb = bulbs[0]!;
      // Create virtual red/yellow/green entries pointing to same material
      return [
        { ...singleBulb, color: 'red' },
        { ...singleBulb, color: 'yellow' },
        { ...singleBulb, color: 'green' },
      ];
    }

    return bulbs;
  }

  /**
   * Cluster traffic lights by position into intersections
   */
  private clusterLightsByPosition(
    meshes: Array<{ mesh: THREE.Object3D; position: THREE.Vector3; rotation: number }>
  ): Array<Array<{ mesh: THREE.Object3D; position: THREE.Vector3; rotation: number }>> {
    const clusters: Array<Array<{ mesh: THREE.Object3D; position: THREE.Vector3; rotation: number }>> = [];
    const used = new Set<number>();

    for (let i = 0; i < meshes.length; i++) {
      if (used.has(i)) continue;

      const cluster = [meshes[i]!];
      used.add(i);

      // Find all nearby lights
      for (let j = i + 1; j < meshes.length; j++) {
        if (used.has(j)) continue;

        const dist = meshes[i]!.position.distanceTo(meshes[j]!.position);
        if (dist < this.config.intersectionRadius) {
          cluster.push(meshes[j]!);
          used.add(j);
        }
      }

      // Only create intersection if we have multiple lights
      if (cluster.length >= 2) {
        clusters.push(cluster);
      }
    }

    return clusters;
  }

  /**
   * Update traffic light system
   */
  public update(deltaTime: number): void {
    if (!this.enabled) return;

    for (const intersection of this.intersections.values()) {
      intersection.phaseTimer -= deltaTime;

      if (intersection.phaseTimer <= 0) {
        this.advancePhase(intersection);
      }
    }
  }

  /**
   * Advance to next phase in intersection cycle
   *
   * Phase cycle:
   * 0: Phase 0 GREEN, Phase 1 RED
   * 1: Phase 0 YELLOW, Phase 1 RED
   * 2: Phase 0 RED, Phase 1 RED (all red safety gap)
   * 3: Phase 0 RED, Phase 1 GREEN
   * 4: Phase 0 RED, Phase 1 YELLOW
   * 5: Phase 0 RED, Phase 1 RED (all red safety gap)
   * -> back to 0
   */
  private advancePhase(intersection: TrafficIntersection): void {
    // Cycle through phases: 0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 0
    const nextPhase = (intersection.currentPhase + 1) % 6;
    intersection.currentPhase = nextPhase;

    switch (nextPhase) {
      case 0:
        // Phase 0 GREEN, Phase 1 RED
        this.setIntersectionState(intersection, 0, 'green');
        this.setIntersectionState(intersection, 1, 'red');
        intersection.phaseTimer = this.config.greenDuration;
        break;
      case 1:
        // Phase 0 YELLOW, Phase 1 RED
        this.setIntersectionState(intersection, 0, 'yellow');
        this.setIntersectionState(intersection, 1, 'red');
        intersection.phaseTimer = this.config.yellowDuration;
        break;
      case 2:
        // All RED (safety gap before phase 1 goes green)
        this.setIntersectionState(intersection, 0, 'red');
        this.setIntersectionState(intersection, 1, 'red');
        intersection.phaseTimer = this.config.allRedDuration;
        break;
      case 3:
        // Phase 0 RED, Phase 1 GREEN
        this.setIntersectionState(intersection, 0, 'red');
        this.setIntersectionState(intersection, 1, 'green');
        intersection.phaseTimer = this.config.greenDuration;
        break;
      case 4:
        // Phase 0 RED, Phase 1 YELLOW
        this.setIntersectionState(intersection, 0, 'red');
        this.setIntersectionState(intersection, 1, 'yellow');
        intersection.phaseTimer = this.config.yellowDuration;
        break;
      case 5:
        // All RED (safety gap before phase 0 goes green)
        this.setIntersectionState(intersection, 0, 'red');
        this.setIntersectionState(intersection, 1, 'red');
        intersection.phaseTimer = this.config.allRedDuration;
        break;
    }
  }

  /**
   * Set state for all lights in a phase
   */
  private setIntersectionState(intersection: TrafficIntersection, phase: number, state: TrafficLightState): void {
    for (const light of intersection.lights) {
      if (light.phase === phase) {
        light.state = state;
        this.updateLightVisual(light);
      }
    }
  }

  /**
   * Update visual appearance of a traffic light
   * Changes the emissive color of the "Emissive" material based on state
   */
  private updateLightVisual(light: TrafficLight): void {
    // If we have bulbs, update their emissive properties
    if (light.bulbs.length > 0) {
      // All bulbs share the same material in this model,
      // so we just change the emissive color based on state
      const targetColor = this.getEmissiveColor(light.state);

      for (const bulb of light.bulbs) {
        // Set emissive color based on current state
        bulb.material.emissive.copy(targetColor);
        bulb.material.emissiveIntensity = 2.0;
        bulb.material.needsUpdate = true;
      }
      return;
    }

    // Fallback: traverse and look for materials by name
    light.mesh.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;

      const materials = Array.isArray(child.material) ? child.material : [child.material];

      for (const mat of materials) {
        if (!(mat instanceof THREE.MeshStandardMaterial)) continue;

        const matName = mat.name?.toLowerCase() || '';

        // Update "Emissive" material based on traffic light state
        if (matName.includes('emissive')) {
          const targetColor = this.getEmissiveColor(light.state);
          mat.emissive.copy(targetColor);
          mat.emissiveIntensity = 2.0;
          mat.needsUpdate = true;
        }
      }
    });
  }

  /**
   * Get emissive color for traffic light state
   */
  private getEmissiveColor(state: TrafficLightState): THREE.Color {
    switch (state) {
      case 'red':
        return new THREE.Color(1, 0, 0); // Red
      case 'yellow':
        return new THREE.Color(1, 0.8, 0); // Orange/Yellow
      case 'green':
        return new THREE.Color(0, 1, 0); // Green
    }
  }

  /**
   * Update all light visuals
   */
  private updateAllLightVisuals(): void {
    for (const light of this.lights.values()) {
      this.updateLightVisual(light);
    }
  }

  /**
   * Check if a vehicle should stop at the current position
   * Returns true if there's a red light ahead
   */
  public shouldStop(
    vehiclePosition: THREE.Vector3,
    vehicleDirection: THREE.Vector3,
    _roadNetwork?: RoadNetwork
  ): boolean {
    // Check all intersections
    for (const intersection of this.intersections.values()) {
      const toIntersection = intersection.center.clone().sub(vehiclePosition);
      const distanceToIntersection = toIntersection.length();

      // Only check if within stop distance
      if (distanceToIntersection > this.config.stopLineDistance) continue;
      if (distanceToIntersection < 2) continue; // Already in intersection

      // Check if we're heading towards this intersection
      toIntersection.normalize();
      const dotProduct = toIntersection.dot(vehicleDirection);
      if (dotProduct < 0.5) continue; // Not heading towards it

      // Find the light that faces our direction
      for (const light of intersection.lights) {
        // Light faces opposite to our direction (we see its front)
        const facingDot = light.facingDirection.dot(vehicleDirection);

        // If light faces roughly opposite to us (we're approaching it)
        if (facingDot < -0.5) {
          if (light.state === 'red' || light.state === 'yellow') {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Get the nearest red light distance (for gradual braking)
   */
  public getRedLightDistance(
    vehiclePosition: THREE.Vector3,
    vehicleDirection: THREE.Vector3
  ): number | null {
    let nearestDistance: number | null = null;

    for (const intersection of this.intersections.values()) {
      const toIntersection = intersection.center.clone().sub(vehiclePosition);
      const distanceToIntersection = toIntersection.length();

      if (distanceToIntersection > this.config.stopLineDistance * 2) continue;
      if (distanceToIntersection < 2) continue;

      toIntersection.normalize();
      const dotProduct = toIntersection.dot(vehicleDirection);
      if (dotProduct < 0.5) continue;

      for (const light of intersection.lights) {
        const facingDot = light.facingDirection.dot(vehicleDirection);

        if (facingDot < -0.5) {
          if (light.state === 'red' || light.state === 'yellow') {
            // Calculate distance to stop line (slightly before intersection center)
            const stopDistance = distanceToIntersection - 5;
            if (nearestDistance === null || stopDistance < nearestDistance) {
              nearestDistance = stopDistance;
            }
          }
        }
      }
    }

    return nearestDistance;
  }

  /**
   * Enable/disable traffic light system
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Get statistics
   */
  public getStats(): { lights: number; intersections: number } {
    return {
      lights: this.lights.size,
      intersections: this.intersections.size,
    };
  }
}
