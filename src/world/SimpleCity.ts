import * as THREE from 'three';
import { RoadNetwork } from './traffic/RoadNetwork';
import { AdvancedTrafficSystem } from './traffic/AdvancedTrafficSystem';
import { getCityCollider } from './collision/CityCollider';

/**
 * Road segment definition
 */
interface RoadSegmentDef {
  start: THREE.Vector2;
  end: THREE.Vector2;
  width: number;
}

/**
 * Simple city configuration
 */
interface SimpleCityConfig {
  /** Size of the city (width x depth) */
  size: THREE.Vector2;
  /** Road width */
  roadWidth: number;
  /** Number of cars to spawn */
  carCount: number;
  /** Show debug waypoints */
  debugRoads: boolean;
}

const DEFAULT_CONFIG: SimpleCityConfig = {
  size: new THREE.Vector2(200, 200),
  roadWidth: 10,
  carCount: 15,
  debugRoads: true,
};

/**
 * SimpleCity - A minimal city with hand-crafted roads for testing traffic system
 *
 * Purpose:
 * 1. Define exact road positions
 * 2. Place waypoints precisely on roads
 * 3. Test and debug traffic system with known road layout
 * 4. No external dependencies (no gen-city, no GLB models)
 */
export class SimpleCity {
  private readonly config: SimpleCityConfig;
  private readonly cityGroup: THREE.Group;
  private readonly roadNetwork: RoadNetwork;
  private readonly roads: RoadSegmentDef[] = [];
  private trafficSystem: AdvancedTrafficSystem | null = null;
  private carMeshes: THREE.Group[] = [];

  constructor(config: Partial<SimpleCityConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cityGroup = new THREE.Group();
    this.cityGroup.name = 'simple_city';
    this.roadNetwork = new RoadNetwork({ defaultSpeedLimit: 10 });
  }

  /**
   * Build the city
   */
  public async build(
    onProgress?: (progress: number, status: string) => void
  ): Promise<THREE.Group> {
    console.log('[SimpleCity] Building test city...');

    onProgress?.(10, 'Creating ground...');
    this.createGround();

    onProgress?.(20, 'Defining roads...');
    this.defineRoads();

    onProgress?.(40, 'Building road meshes...');
    this.buildRoadMeshes();

    onProgress?.(60, 'Creating waypoint network...');
    this.createRoadNetwork();

    onProgress?.(70, 'Creating vehicles...');
    this.createVehicles();

    onProgress?.(80, 'Initializing traffic...');
    this.initializeTraffic();

    if (this.config.debugRoads) {
      onProgress?.(90, 'Adding debug visualization...');
      const debugViz = this.roadNetwork.createDebugVisualization();
      this.cityGroup.add(debugViz);
    }

    onProgress?.(95, 'Setting up collision bounds...');
    this.updateColliderBounds();

    onProgress?.(100, 'City ready!');

    const stats = this.roadNetwork.getStats();
    console.log(`[SimpleCity] Road network: ${stats.waypoints} waypoints, ${stats.segments} segments`);
    console.log(`[SimpleCity] Vehicles: ${this.carMeshes.length}`);

    return this.cityGroup;
  }

  /**
   * Create ground plane
   */
  private createGround(): void {
    const { size } = this.config;

    // Grass ground
    const groundGeo = new THREE.PlaneGeometry(size.x * 1.5, size.y * 1.5);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x4a7c4e,
      roughness: 0.9,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    ground.name = 'ground';
    this.cityGroup.add(ground);
  }

  /**
   * Define the road layout
   */
  private defineRoads(): void {
    const { size, roadWidth } = this.config;
    const halfW = size.x / 2;
    const halfH = size.y / 2;

    // Main cross roads through center
    // Horizontal main road
    this.roads.push({
      start: new THREE.Vector2(-halfW + 10, 0),
      end: new THREE.Vector2(halfW - 10, 0),
      width: roadWidth,
    });

    // Vertical main road
    this.roads.push({
      start: new THREE.Vector2(0, -halfH + 10),
      end: new THREE.Vector2(0, halfH - 10),
      width: roadWidth,
    });

    // Secondary horizontal roads (top and bottom)
    this.roads.push({
      start: new THREE.Vector2(-halfW + 10, halfH * 0.5),
      end: new THREE.Vector2(halfW - 10, halfH * 0.5),
      width: roadWidth,
    });

    this.roads.push({
      start: new THREE.Vector2(-halfW + 10, -halfH * 0.5),
      end: new THREE.Vector2(halfW - 10, -halfH * 0.5),
      width: roadWidth,
    });

    // Secondary vertical roads (left and right)
    this.roads.push({
      start: new THREE.Vector2(-halfW * 0.5, -halfH + 10),
      end: new THREE.Vector2(-halfW * 0.5, halfH - 10),
      width: roadWidth,
    });

    this.roads.push({
      start: new THREE.Vector2(halfW * 0.5, -halfH + 10),
      end: new THREE.Vector2(halfW * 0.5, halfH - 10),
      width: roadWidth,
    });

    console.log(`[SimpleCity] Defined ${this.roads.length} road segments`);
  }

  /**
   * Build visual road meshes
   */
  private buildRoadMeshes(): void {
    const roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.8,
    });

    const lineMarkingMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.5,
    });

    for (const road of this.roads) {
      const direction = new THREE.Vector2().subVectors(road.end, road.start);
      const length = direction.length();
      const angle = Math.atan2(direction.y, direction.x);

      // Road surface
      const roadGeo = new THREE.PlaneGeometry(length, road.width);
      const roadMesh = new THREE.Mesh(roadGeo, roadMaterial);
      roadMesh.rotation.x = -Math.PI / 2;
      roadMesh.rotation.z = -angle;

      const center = new THREE.Vector2()
        .addVectors(road.start, road.end)
        .multiplyScalar(0.5);
      roadMesh.position.set(center.x, 0.01, center.y);
      roadMesh.receiveShadow = true;
      roadMesh.name = 'road_surface';

      this.cityGroup.add(roadMesh);

      // Center dashed line
      const dashLength = 3;
      const dashGap = 3;
      const numDashes = Math.floor(length / (dashLength + dashGap));

      for (let i = 0; i < numDashes; i++) {
        const dashGeo = new THREE.PlaneGeometry(dashLength, 0.25);
        const dashMesh = new THREE.Mesh(dashGeo, lineMarkingMaterial);
        dashMesh.rotation.x = -Math.PI / 2;
        dashMesh.rotation.z = -angle;

        const t = (i + 0.5) / numDashes;
        const dashPos = new THREE.Vector2().lerpVectors(road.start, road.end, t);
        dashMesh.position.set(dashPos.x, 0.02, dashPos.y);
        dashMesh.name = 'road_marking';

        this.cityGroup.add(dashMesh);
      }

      // Edge lines
      for (const side of [-1, 1]) {
        const edgeGeo = new THREE.PlaneGeometry(length, 0.2);
        const edgeMesh = new THREE.Mesh(edgeGeo, lineMarkingMaterial);
        edgeMesh.rotation.x = -Math.PI / 2;
        edgeMesh.rotation.z = -angle;

        const perpX = -Math.sin(angle) * (road.width / 2 - 0.3) * side;
        const perpZ = Math.cos(angle) * (road.width / 2 - 0.3) * side;
        edgeMesh.position.set(center.x + perpX, 0.02, center.y + perpZ);
        edgeMesh.name = 'road_edge';

        this.cityGroup.add(edgeMesh);
      }
    }

    // Add intersection squares where roads cross
    this.addIntersections();
  }

  /**
   * Add intersection patches where roads cross
   */
  private addIntersections(): void {
    const intersectionMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.8,
    });

    // Find intersections by checking where roads cross
    const intersectionPoints: THREE.Vector2[] = [];

    for (let i = 0; i < this.roads.length; i++) {
      for (let j = i + 1; j < this.roads.length; j++) {
        const road1 = this.roads[i]!;
        const road2 = this.roads[j]!;

        const intersection = this.findIntersection(road1, road2);
        if (intersection) {
          intersectionPoints.push(intersection);
        }
      }
    }

    // Create intersection patches
    for (const point of intersectionPoints) {
      const size = this.config.roadWidth + 2;
      const geo = new THREE.PlaneGeometry(size, size);
      const mesh = new THREE.Mesh(geo, intersectionMaterial);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(point.x, 0.015, point.y);
      mesh.receiveShadow = true;
      mesh.name = 'intersection';
      this.cityGroup.add(mesh);
    }

    console.log(`[SimpleCity] Added ${intersectionPoints.length} intersections`);
  }

  /**
   * Find intersection point of two road segments
   */
  private findIntersection(road1: RoadSegmentDef, road2: RoadSegmentDef): THREE.Vector2 | null {
    const x1 = road1.start.x, y1 = road1.start.y;
    const x2 = road1.end.x, y2 = road1.end.y;
    const x3 = road2.start.x, y3 = road2.start.y;
    const x4 = road2.end.x, y4 = road2.end.y;

    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 0.001) return null;

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      return new THREE.Vector2(
        x1 + t * (x2 - x1),
        y1 + t * (y2 - y1)
      );
    }

    return null;
  }

  /**
   * Create waypoint network along roads
   * Strategy:
   * 1. Find all intersection points where roads cross
   * 2. Create waypoints at intersections AND at road endpoints
   * 3. Create intermediate waypoints along roads between key points
   * 4. Connect everything properly
   */
  private createRoadNetwork(): void {
    const waypointSpacing = 25;

    // Step 1: Find all intersection points
    const intersectionPoints: THREE.Vector2[] = [];
    for (let i = 0; i < this.roads.length; i++) {
      for (let j = i + 1; j < this.roads.length; j++) {
        const intersection = this.findIntersection(this.roads[i]!, this.roads[j]!);
        if (intersection) {
          intersectionPoints.push(intersection);
        }
      }
    }
    console.log(`[SimpleCity] Found ${intersectionPoints.length} road intersections`);

    // Step 2: For each road, collect key points (start, intersections on this road, end)
    // Then create waypoints along each segment
    interface RoadWaypoints {
      road: RoadSegmentDef;
      waypointIds: string[];
    }
    const roadWaypointsMap: RoadWaypoints[] = [];

    // Map to reuse waypoints at same position (intersections)
    const positionToWaypointId = new Map<string, string>();
    const posKey = (x: number, z: number) => `${Math.round(x)},${Math.round(z)}`;

    for (const road of this.roads) {
      // Collect all key points on this road (start, intersections, end)
      const keyPoints: { t: number; pos: THREE.Vector2 }[] = [];

      // Start point (t=0)
      keyPoints.push({ t: 0, pos: road.start.clone() });

      // Find intersections that lie on this road
      for (const intPt of intersectionPoints) {
        // Check if this intersection is on this road
        const toInt = new THREE.Vector2().subVectors(intPt, road.start);
        const roadDir = new THREE.Vector2().subVectors(road.end, road.start);
        const roadLen = roadDir.length();
        roadDir.normalize();

        const projection = toInt.dot(roadDir);
        const perpDist = Math.abs(toInt.cross(roadDir));

        // If intersection is on this road (small perpendicular distance)
        if (perpDist < 1 && projection > 1 && projection < roadLen - 1) {
          const t = projection / roadLen;
          keyPoints.push({ t, pos: intPt.clone() });
        }
      }

      // End point (t=1)
      keyPoints.push({ t: 1, pos: road.end.clone() });

      // Sort by t
      keyPoints.sort((a, b) => a.t - b.t);

      // Create waypoints for this road
      const waypointIds: string[] = [];

      for (let i = 0; i < keyPoints.length; i++) {
        const current = keyPoints[i]!;
        const next = keyPoints[i + 1];

        // Create waypoint at current key point (or reuse if exists)
        const key = posKey(current.pos.x, current.pos.y);
        let wpId = positionToWaypointId.get(key);

        if (!wpId) {
          const pos3D = new THREE.Vector3(current.pos.x, 0.5, current.pos.y);
          const isIntersection = i > 0 && i < keyPoints.length - 1; // Middle points are intersections
          const wp = this.roadNetwork.createWaypoint(pos3D, {
            speedLimit: 10,
            isIntersection
          });
          wpId = wp.id;
          positionToWaypointId.set(key, wpId);
        }
        waypointIds.push(wpId);

        // Create intermediate waypoints between current and next
        if (next) {
          const segmentLength = current.pos.distanceTo(next.pos);
          const numIntermediates = Math.floor(segmentLength / waypointSpacing) - 1;

          for (let j = 1; j <= numIntermediates; j++) {
            const tLocal = j / (numIntermediates + 1);
            const pos2D = new THREE.Vector2().lerpVectors(current.pos, next.pos, tLocal);
            const pos3D = new THREE.Vector3(pos2D.x, 0.5, pos2D.y);

            const intKey = posKey(pos2D.x, pos2D.y);
            let intWpId = positionToWaypointId.get(intKey);

            if (!intWpId) {
              const wp = this.roadNetwork.createWaypoint(pos3D, { speedLimit: 10 });
              intWpId = wp.id;
              positionToWaypointId.set(intKey, intWpId);
            }
            waypointIds.push(intWpId);
          }
        }
      }

      roadWaypointsMap.push({ road, waypointIds });
    }

    // Step 3: Connect waypoints along each road
    for (const { waypointIds } of roadWaypointsMap) {
      for (let i = 0; i < waypointIds.length - 1; i++) {
        this.roadNetwork.connectBidirectional(waypointIds[i]!, waypointIds[i + 1]!);
      }
    }

    // Log stats
    const allWaypoints = this.roadNetwork.getAllWaypoints();
    const intersectionWps = allWaypoints.filter(wp => wp.isIntersection);
    console.log(`[SimpleCity] Created ${allWaypoints.length} waypoints, ${intersectionWps.length} at intersections`);
    intersectionWps.forEach(wp => {
      console.log(`[SimpleCity]   Intersection ${wp.id} at (${wp.position.x.toFixed(0)}, ${wp.position.z.toFixed(0)}) - ${wp.connections.length} connections`);
    });
  }

  /**
   * Create simple car meshes
   */
  private createVehicles(): void {
    const carColors = [0xff0000, 0x0066ff, 0x00cc00, 0xffcc00, 0xff6600, 0x9900ff];

    for (let i = 0; i < this.config.carCount; i++) {
      const carGroup = new THREE.Group();
      carGroup.name = `Car_${i}`;

      const color = carColors[i % carColors.length]!;

      // Car body
      const bodyGeo = new THREE.BoxGeometry(4, 1.2, 2);
      const bodyMat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.3,
        metalness: 0.5,
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.8;
      body.castShadow = true;
      carGroup.add(body);

      // Car cabin/roof
      const roofGeo = new THREE.BoxGeometry(2.2, 0.9, 1.8);
      const roof = new THREE.Mesh(roofGeo, bodyMat);
      roof.position.set(-0.2, 1.65, 0);
      roof.castShadow = true;
      carGroup.add(roof);

      // Wheels
      const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 12);
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222 });

      const wheelPositions: [number, number, number][] = [
        [1.3, 0.35, 1.0],
        [1.3, 0.35, -1.0],
        [-1.3, 0.35, 1.0],
        [-1.3, 0.35, -1.0],
      ];

      for (const [x, y, z] of wheelPositions) {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(x, y, z);
        carGroup.add(wheel);
      }

      // Headlights
      const lightGeo = new THREE.BoxGeometry(0.3, 0.2, 0.5);
      const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffcc, emissive: 0x444400 });
      const lightL = new THREE.Mesh(lightGeo, lightMat);
      lightL.position.set(2, 0.7, 0.6);
      carGroup.add(lightL);
      const lightR = new THREE.Mesh(lightGeo, lightMat);
      lightR.position.set(2, 0.7, -0.6);
      carGroup.add(lightR);

      // Position at random waypoint
      const waypoint = this.roadNetwork.getRandomWaypoint();
      if (waypoint) {
        carGroup.position.copy(waypoint.position);
        carGroup.position.y = 0;
      }

      this.carMeshes.push(carGroup);
      this.cityGroup.add(carGroup);
    }

    console.log(`[SimpleCity] Created ${this.carMeshes.length} car meshes`);
  }

  /**
   * Initialize traffic system
   */
  private initializeTraffic(): void {
    this.trafficSystem = new AdvancedTrafficSystem(this.roadNetwork, {
      maxVehicles: this.config.carCount,
    });

    // Initialize traffic system to use our car meshes
    this.trafficSystem.initializeFromModel(this.cityGroup, 1);

    console.log(`[SimpleCity] Traffic system initialized with ${this.trafficSystem.getVehicleCount()} vehicles`);
  }

  /**
   * Update city (traffic simulation)
   */
  public update(deltaTime: number): void {
    if (this.trafficSystem) {
      this.trafficSystem.update(deltaTime);
    }
  }

  /**
   * Get the city group
   */
  public getGroup(): THREE.Group {
    return this.cityGroup;
  }

  /**
   * Update CityCollider bounds to match the actual city size
   * This prevents NPCs from fleeing outside the map
   */
  private updateColliderBounds(): void {
    const { size } = this.config;
    const collider = getCityCollider();

    // Set bounds based on city size with some margin
    const halfX = size.x / 2;
    const halfZ = size.y / 2;
    const margin = 5; // Keep NPCs slightly inside the visual boundary

    const bounds = new THREE.Box3(
      new THREE.Vector3(-halfX + margin, 0, -halfZ + margin),
      new THREE.Vector3(halfX - margin, 200, halfZ - margin)
    );

    collider.updateBounds(bounds);
    console.log(`[SimpleCity] Collider bounds set to ${size.x}x${size.y}m area`);
  }

  /**
   * Get spawn position for player (center of map, on road)
   */
  public getSpawnPosition(): THREE.Vector3 {
    // Spawn near center of 200x200 map, offset to be on road
    return new THREE.Vector3(100, 0, 85);
  }

  /**
   * Get city bounds
   */
  public getBounds(): THREE.Box3 {
    return new THREE.Box3().setFromObject(this.cityGroup);
  }

  /**
   * Get road network
   */
  public getRoadNetwork(): RoadNetwork {
    return this.roadNetwork;
  }

  /**
   * Get traffic system
   */
  public getTrafficSystem(): AdvancedTrafficSystem | null {
    return this.trafficSystem;
  }
}
