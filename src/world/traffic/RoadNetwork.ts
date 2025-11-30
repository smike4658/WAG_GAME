import * as THREE from 'three';

/**
 * A single point on a road that vehicles follow
 */
export interface Waypoint {
  id: string;
  position: THREE.Vector3;
  /** IDs of waypoints this one connects to */
  connections: string[];
  /** Speed limit at this waypoint (units/s) */
  speedLimit: number;
  /** Is this an intersection? */
  isIntersection: boolean;
  /** Direction of travel (normalized vector, undefined = bidirectional) */
  direction?: THREE.Vector3;
}

/**
 * A road segment between waypoints
 */
export interface RoadSegment {
  id: string;
  startWaypointId: string;
  endWaypointId: string;
  /** Number of lanes in this direction */
  lanes: number;
  /** Length of the segment */
  length: number;
}

/**
 * Configuration for road network generation
 */
export interface RoadNetworkConfig {
  /** Default speed limit (units/s) */
  defaultSpeedLimit: number;
  /** Minimum distance between waypoints */
  minWaypointDistance: number;
  /** Lane width for multi-lane roads */
  laneWidth: number;
}

const DEFAULT_CONFIG: RoadNetworkConfig = {
  defaultSpeedLimit: 8,
  minWaypointDistance: 5,
  laneWidth: 3,
};

/**
 * RoadNetwork - Manages the road topology for traffic simulation
 *
 * Based on traffic-simulation-de concepts:
 * - Roads are composed of connected waypoints
 * - Vehicles follow waypoints using car-following models (IDM/ACC)
 * - Intersections are special waypoints with multiple connections
 */
export class RoadNetwork {
  private readonly config: RoadNetworkConfig;
  private readonly waypoints: Map<string, Waypoint> = new Map();
  private readonly segments: Map<string, RoadSegment> = new Map();
  private waypointCounter = 0;
  private segmentCounter = 0;

  constructor(config: Partial<RoadNetworkConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Create a new waypoint
   */
  public createWaypoint(
    position: THREE.Vector3,
    options: Partial<Pick<Waypoint, 'speedLimit' | 'isIntersection' | 'direction'>> = {}
  ): Waypoint {
    const id = `wp_${this.waypointCounter++}`;
    const waypoint: Waypoint = {
      id,
      position: position.clone(),
      connections: [],
      speedLimit: options.speedLimit ?? this.config.defaultSpeedLimit,
      isIntersection: options.isIntersection ?? false,
      ...(options.direction ? { direction: options.direction.clone() } : {}),
    };
    this.waypoints.set(id, waypoint);
    return waypoint;
  }

  /**
   * Connect two waypoints (one-way connection)
   */
  public connect(fromId: string, toId: string, lanes: number = 1): RoadSegment | null {
    const from = this.waypoints.get(fromId);
    const to = this.waypoints.get(toId);

    if (!from || !to) {
      console.warn(`[RoadNetwork] Cannot connect: waypoint not found`);
      return null;
    }

    // Add connection
    if (!from.connections.includes(toId)) {
      from.connections.push(toId);
    }

    // Create segment
    const segmentId = `seg_${this.segmentCounter++}`;
    const segment: RoadSegment = {
      id: segmentId,
      startWaypointId: fromId,
      endWaypointId: toId,
      lanes,
      length: from.position.distanceTo(to.position),
    };
    this.segments.set(segmentId, segment);

    return segment;
  }

  /**
   * Connect two waypoints bidirectionally
   */
  public connectBidirectional(id1: string, id2: string, lanes: number = 1): void {
    this.connect(id1, id2, lanes);
    this.connect(id2, id1, lanes);
  }

  /**
   * Create a road from an array of positions
   * Returns the created waypoints
   */
  public createRoad(
    positions: THREE.Vector3[],
    options: {
      bidirectional?: boolean;
      lanes?: number;
      speedLimit?: number;
      closedLoop?: boolean;
    } = {}
  ): Waypoint[] {
    const { bidirectional = true, lanes = 1, speedLimit, closedLoop = false } = options;

    const waypoints: Waypoint[] = [];

    // Create waypoints
    for (const pos of positions) {
      const wp = this.createWaypoint(pos, speedLimit !== undefined ? { speedLimit } : {});
      waypoints.push(wp);
    }

    // Connect them
    for (let i = 0; i < waypoints.length - 1; i++) {
      const from = waypoints[i]!;
      const to = waypoints[i + 1]!;

      if (bidirectional) {
        this.connectBidirectional(from.id, to.id, lanes);
      } else {
        this.connect(from.id, to.id, lanes);
      }
    }

    // Close the loop if requested
    if (closedLoop && waypoints.length > 2) {
      const first = waypoints[0]!;
      const last = waypoints[waypoints.length - 1]!;

      if (bidirectional) {
        this.connectBidirectional(last.id, first.id, lanes);
      } else {
        this.connect(last.id, first.id, lanes);
      }
    }

    return waypoints;
  }

  /**
   * Create a grid road network (good for city blocks)
   */
  public createGrid(
    center: THREE.Vector3,
    gridWidth: number,
    gridHeight: number,
    cellSize: number,
    options: { speedLimit?: number } = {}
  ): void {
    const { speedLimit } = options;
    const halfWidth = (gridWidth * cellSize) / 2;
    const halfHeight = (gridHeight * cellSize) / 2;

    // Create intersection waypoints at grid points
    const gridWaypoints: Waypoint[][] = [];

    for (let x = 0; x <= gridWidth; x++) {
      gridWaypoints[x] = [];
      for (let z = 0; z <= gridHeight; z++) {
        const pos = new THREE.Vector3(
          center.x - halfWidth + x * cellSize,
          center.y,
          center.z - halfHeight + z * cellSize
        );
        const wpOptions: Partial<Pick<Waypoint, 'speedLimit' | 'isIntersection'>> = {
          isIntersection: true,
        };
        if (speedLimit !== undefined) {
          wpOptions.speedLimit = speedLimit;
        }
        const wp = this.createWaypoint(pos, wpOptions);
        gridWaypoints[x]![z] = wp;
      }
    }

    // Connect horizontal roads
    for (let x = 0; x < gridWidth; x++) {
      for (let z = 0; z <= gridHeight; z++) {
        const from = gridWaypoints[x]![z]!;
        const to = gridWaypoints[x + 1]![z]!;
        this.connectBidirectional(from.id, to.id);
      }
    }

    // Connect vertical roads
    for (let x = 0; x <= gridWidth; x++) {
      for (let z = 0; z < gridHeight; z++) {
        const from = gridWaypoints[x]![z]!;
        const to = gridWaypoints[x]![z + 1]!;
        this.connectBidirectional(from.id, to.id);
      }
    }

    console.log(`[RoadNetwork] Created ${gridWidth}x${gridHeight} grid with ${this.waypoints.size} waypoints`);
  }

  /**
   * Get a waypoint by ID
   */
  public getWaypoint(id: string): Waypoint | undefined {
    return this.waypoints.get(id);
  }

  /**
   * Get all waypoints
   */
  public getAllWaypoints(): Waypoint[] {
    return Array.from(this.waypoints.values());
  }

  /**
   * Get a random waypoint (for spawning vehicles)
   */
  public getRandomWaypoint(): Waypoint | null {
    const all = this.getAllWaypoints();
    if (all.length === 0) return null;
    return all[Math.floor(Math.random() * all.length)]!;
  }

  /**
   * Get the next waypoint from current (random choice if multiple)
   */
  public getNextWaypoint(currentId: string): Waypoint | null {
    const current = this.waypoints.get(currentId);
    if (!current || current.connections.length === 0) return null;

    // Random choice among connections
    const nextId = current.connections[Math.floor(Math.random() * current.connections.length)]!;
    return this.waypoints.get(nextId) ?? null;
  }

  /**
   * Find the nearest waypoint to a position
   */
  public findNearestWaypoint(position: THREE.Vector3): Waypoint | null {
    let nearest: Waypoint | null = null;
    let minDist = Infinity;

    for (const wp of this.waypoints.values()) {
      const dist = position.distanceTo(wp.position);
      if (dist < minDist) {
        minDist = dist;
        nearest = wp;
      }
    }

    return nearest;
  }

  /**
   * Find the nearest waypoint that has a direction matching the given direction
   * Used for dual-lane traffic to ensure vehicles start on the correct side
   */
  public findNearestWaypointWithDirection(
    position: THREE.Vector3,
    facingDirection: THREE.Vector3,
    maxDistance: number = 30
  ): Waypoint | null {
    let best: Waypoint | null = null;
    let bestScore = -Infinity;

    for (const wp of this.waypoints.values()) {
      const dist = position.distanceTo(wp.position);
      if (dist > maxDistance) continue;

      // If waypoint has no direction, skip it for directional matching
      if (!wp.direction) continue;

      // Score: closer is better, and direction alignment is critical
      const directionDot = facingDirection.dot(wp.direction);

      // Only consider waypoints going roughly the same direction (dot > 0.5 = < 60 degrees)
      if (directionDot < 0.5) continue;

      // Score combines distance (closer = better) and direction alignment
      const score = directionDot * 100 - dist;

      if (score > bestScore) {
        bestScore = score;
        best = wp;
      }
    }

    return best;
  }

  /**
   * Get next waypoint that continues in the same direction (for dual-lane roads)
   * Prefers forward movement over turns
   */
  public getNextWaypointForward(currentId: string, previousId?: string): Waypoint | null {
    const current = this.waypoints.get(currentId);
    if (!current || current.connections.length === 0) return null;

    // Filter out where we came from
    const candidates = current.connections
      .filter(id => id !== previousId)
      .map(id => this.waypoints.get(id))
      .filter((wp): wp is Waypoint => wp !== undefined);

    if (candidates.length === 0) {
      // Dead end - allow going back
      const backId = current.connections[0];
      return backId ? this.waypoints.get(backId) ?? null : null;
    }

    // If current waypoint has a direction, prefer continuing in that direction
    if (current.direction) {
      let bestCandidate: Waypoint | null = null;
      let bestDot = -Infinity;

      for (const candidate of candidates) {
        const toCandidate = candidate.position.clone().sub(current.position).normalize();
        const dot = current.direction.dot(toCandidate);

        if (dot > bestDot) {
          bestDot = dot;
          bestCandidate = candidate;
        }
      }

      // Return best if it's roughly forward (dot > 0), else random
      if (bestCandidate && bestDot > 0) {
        return bestCandidate;
      }
    }

    // Fallback: random choice
    return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
  }

  /**
   * Get distance to next waypoint along the road
   */
  public getDistanceToWaypoint(from: THREE.Vector3, waypointId: string): number {
    const wp = this.waypoints.get(waypointId);
    if (!wp) return Infinity;
    return from.distanceTo(wp.position);
  }

  /**
   * Get direction vector from position to waypoint
   */
  public getDirectionToWaypoint(from: THREE.Vector3, waypointId: string): THREE.Vector3 {
    const wp = this.waypoints.get(waypointId);
    if (!wp) return new THREE.Vector3(0, 0, 1);

    return wp.position.clone().sub(from).normalize();
  }

  /**
   * Get statistics
   */
  public getStats(): { waypoints: number; segments: number; intersections: number } {
    let intersections = 0;
    for (const wp of this.waypoints.values()) {
      if (wp.isIntersection) intersections++;
    }

    return {
      waypoints: this.waypoints.size,
      segments: this.segments.size,
      intersections,
    };
  }

  /**
   * Clear all roads
   */
  public clear(): void {
    this.waypoints.clear();
    this.segments.clear();
    this.waypointCounter = 0;
    this.segmentCounter = 0;
  }

  /**
   * Debug visualization - creates Three.js objects to show the road network
   */
  public createDebugVisualization(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'road_network_debug';

    // Waypoint spheres
    const wpGeometry = new THREE.SphereGeometry(0.2);
    const wpMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const intersectionMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });

    for (const wp of this.waypoints.values()) {
      const mesh = new THREE.Mesh(
        wpGeometry,
        wp.isIntersection ? intersectionMaterial : wpMaterial
      );
      mesh.position.copy(wp.position);
      // mesh.position.y += 0.5; // Don't raise - show actual position
      group.add(mesh);
    }

    // Connection lines
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x0088ff });

    for (const wp of this.waypoints.values()) {
      for (const connId of wp.connections) {
        const target = this.waypoints.get(connId);
        if (!target) continue;

        const points = [
          wp.position.clone().setY(wp.position.y + 0.3),
          target.position.clone().setY(target.position.y + 0.3),
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, lineMaterial);
        group.add(line);
      }
    }

    return group;
  }
}
