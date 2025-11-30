# Dual-Lane Traffic System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix traffic deadlocks by implementing proper dual-lane waypoints with right-hand traffic rules.

**Architecture:** Modify RoadExtractor to generate two parallel waypoint lanes per road segment. Each lane is one-way. Intersections use right-of-way rules. Vehicles raycast to ground at spawn. Box3 collision detection for player interaction.

**Tech Stack:** Three.js, TypeScript

---

## Task 1: Extend Waypoint Interface with Direction

**Files:**
- Modify: `src/world/traffic/RoadNetwork.ts:6-15`
- Modify: `src/world/traffic/RoadNetwork.ts:70-84`

**Step 1: Add direction to Waypoint interface**

Modify `src/world/traffic/RoadNetwork.ts` - update Waypoint interface (line 6):
```typescript
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
```

**Step 2: Update createWaypoint method**

Modify `createWaypoint` method (line 70):
```typescript
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
    direction: options.direction?.clone(),
  };
  this.waypoints.set(id, waypoint);
  return waypoint;
}
```

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(RoadNetwork): add direction property to Waypoint"
```

---

## Task 2: Update RoadExtractor Config for Dual-Lane

**Files:**
- Modify: `src/world/traffic/RoadExtractor.ts:22-75`

**Step 1: Add dual-lane config options**

Modify `RoadExtractorConfig` interface (line 22):
```typescript
interface RoadExtractorConfig {
  /** Patterns to identify road meshes by name */
  roadPatterns: RegExp[];
  /** Patterns to exclude */
  excludePatterns: RegExp[];
  /** Minimum road segment length */
  minSegmentLength: number;
  /** Waypoint spacing along roads */
  waypointSpacing: number;
  /** Default speed limit */
  defaultSpeedLimit: number;
  /** Y offset for waypoints (above road surface) */
  yOffset: number;
  /** Use geometry-based detection (flat meshes near ground) */
  useGeometryDetection: boolean;
  /** Maximum Y position for road surface */
  maxRoadY: number;
  /** Road color detection - dark gray/black colors */
  roadColorThreshold: number;
  /** Tile size for tile-based city models */
  tileSize: number;
  /** Use dual lanes for bidirectional roads */
  useDualLanes: boolean;
  /** Lane offset from centerline */
  laneOffset: number;
}
```

**Step 2: Update DEFAULT_CONFIG**

Modify DEFAULT_CONFIG (line 45):
```typescript
const DEFAULT_CONFIG: RoadExtractorConfig = {
  roadPatterns: [
    /^road_\d+/i,
    /road/i,
    /street/i,
    /highway/i,
    /asphalt/i,
    /lane/i,
  ],
  excludePatterns: [
    /Sign/i,
    /Light/i,
    /Pole/i,
    /Barrier/i,
    /Crosswalk/i,
    /Sidewalk/i,
    /Curb/i,
    /Tree/i,
    /Car/i,
    /Vehicle/i,
    /Building/i,
  ],
  minSegmentLength: 5,
  waypointSpacing: 15,
  defaultSpeedLimit: 8,
  yOffset: 0.5,
  useGeometryDetection: true,
  maxRoadY: 1.0,
  roadColorThreshold: 0.3,
  tileSize: 15,
  useDualLanes: true,
  laneOffset: 2.5,
};
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(RoadExtractor): add dual-lane config options"
```

---

## Task 3: Implement Dual-Lane Tile Extraction

**Files:**
- Modify: `src/world/traffic/RoadExtractor.ts:209-276`

**Step 1: Rewrite extractFromTiles method**

Replace entire `extractFromTiles` method (line 209):
```typescript
/**
 * Extract road network from tile positions with dual-lane support
 */
private extractFromTiles(tiles: RoadTile[], roadNetwork: RoadNetwork): void {
  const { tileSize, defaultSpeedLimit, yOffset, useDualLanes, laneOffset } = this.config;

  // Round positions to grid
  const gridPositions = new Map<string, RoadTile>();

  for (const tile of tiles) {
    const gx = Math.round(tile.position.x * 2) / 2;
    const gz = Math.round(tile.position.z * 2) / 2;
    const key = `${gx},${gz}`;

    const existing = gridPositions.get(key);
    if (!existing || this.getTilePriority(tile.type) > this.getTilePriority(existing.type)) {
      gridPositions.set(key, {
        ...tile,
        position: new THREE.Vector3(gx, yOffset, gz),
      });
    }
  }

  console.log(`[RoadExtractor] Grid has ${gridPositions.size} unique road positions`);

  if (!useDualLanes) {
    this.extractSingleLaneTiles(gridPositions, roadNetwork, tileSize, defaultSpeedLimit);
    return;
  }

  this.extractDualLaneTiles(gridPositions, roadNetwork, tileSize, defaultSpeedLimit, laneOffset);
}

/**
 * Original single-lane tile extraction (for backward compatibility)
 */
private extractSingleLaneTiles(
  gridPositions: Map<string, RoadTile>,
  roadNetwork: RoadNetwork,
  tileSize: number,
  defaultSpeedLimit: number
): void {
  const waypointMap = new Map<string, Waypoint>();

  for (const [key, tile] of gridPositions.entries()) {
    const isIntersection = tile.type === 'intersection' || tile.type === 't_intersection';
    const wp = roadNetwork.createWaypoint(tile.position, {
      speedLimit: isIntersection ? defaultSpeedLimit * 0.7 : defaultSpeedLimit,
      isIntersection,
    });
    waypointMap.set(key, wp);
  }

  const directions = [
    { dx: tileSize, dz: 0 },
    { dx: -tileSize, dz: 0 },
    { dx: 0, dz: tileSize },
    { dx: 0, dz: -tileSize },
  ];

  for (const [key, wp] of waypointMap.entries()) {
    const [gx, gz] = key.split(',').map(Number) as [number, number];

    for (const { dx, dz } of directions) {
      const neighborKey = `${gx + dx},${gz + dz}`;
      const neighbor = waypointMap.get(neighborKey);

      if (neighbor && !wp.connections.includes(neighbor.id)) {
        roadNetwork.connectBidirectional(wp.id, neighbor.id);
      }
    }
  }

  const stats = roadNetwork.getStats();
  console.log(`[RoadExtractor] Single-lane network: ${stats.waypoints} waypoints, ${stats.segments} segments`);
}

/**
 * Dual-lane tile extraction with separate waypoints per direction
 */
private extractDualLaneTiles(
  gridPositions: Map<string, RoadTile>,
  roadNetwork: RoadNetwork,
  tileSize: number,
  defaultSpeedLimit: number,
  laneOffset: number
): void {
  // For each tile, create directional waypoints for each connected direction
  // Key: "x,z:direction" -> Waypoint
  const directionalWaypoints = new Map<string, Waypoint>();

  const cardinalDirs = [
    { name: 'E', dx: 1, dz: 0, vec: new THREE.Vector3(1, 0, 0) },
    { name: 'W', dx: -1, dz: 0, vec: new THREE.Vector3(-1, 0, 0) },
    { name: 'N', dx: 0, dz: 1, vec: new THREE.Vector3(0, 0, 1) },
    { name: 'S', dx: 0, dz: -1, vec: new THREE.Vector3(0, 0, -1) },
  ];

  // First pass: create waypoints for each tile and direction
  for (const [key, tile] of gridPositions.entries()) {
    const isIntersection = tile.type === 'intersection' || tile.type === 't_intersection';
    const speedLimit = isIntersection ? defaultSpeedLimit * 0.7 : defaultSpeedLimit;
    const [gx, gz] = key.split(',').map(Number) as [number, number];

    for (const dir of cardinalDirs) {
      // Check if this direction has a neighbor (road continues)
      const neighborKey = `${gx + dir.dx * tileSize},${gz + dir.dz * tileSize}`;
      const hasNeighbor = gridPositions.has(neighborKey);

      // Only create waypoint if road continues in this direction OR it's an intersection
      if (!hasNeighbor && !isIntersection) continue;

      // Calculate position with lane offset (right-hand traffic)
      // Vehicle going East should be on the South side (negative Z)
      const up = new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(dir.vec, up).normalize();

      const wpPos = tile.position.clone().add(right.multiplyScalar(laneOffset));

      const wp = roadNetwork.createWaypoint(wpPos, {
        speedLimit,
        isIntersection,
        direction: dir.vec.clone(),
      });

      directionalWaypoints.set(`${key}:${dir.name}`, wp);
    }
  }

  // Second pass: connect waypoints
  for (const [key, tile] of gridPositions.entries()) {
    const [gx, gz] = key.split(',').map(Number) as [number, number];
    const isIntersection = tile.type === 'intersection' || tile.type === 't_intersection';

    for (const dir of cardinalDirs) {
      const wpKey = `${key}:${dir.name}`;
      const wp = directionalWaypoints.get(wpKey);
      if (!wp) continue;

      // Connect to same direction in next tile
      const neighborKey = `${gx + dir.dx * tileSize},${gz + dir.dz * tileSize}`;
      const neighborWpKey = `${neighborKey}:${dir.name}`;
      const neighborWp = directionalWaypoints.get(neighborWpKey);

      if (neighborWp) {
        roadNetwork.connect(wp.id, neighborWp.id);
      }

      // At intersections, connect to perpendicular directions (turning)
      if (isIntersection) {
        for (const turnDir of cardinalDirs) {
          if (turnDir.name === dir.name) continue;

          // Skip U-turn (opposite direction)
          const isOpposite = (dir.dx === -turnDir.dx && dir.dz === -turnDir.dz);
          if (isOpposite) continue;

          const turnWpKey = `${key}:${turnDir.name}`;
          const turnWp = directionalWaypoints.get(turnWpKey);
          if (turnWp) {
            roadNetwork.connect(wp.id, turnWp.id);
          }
        }
      }
    }
  }

  const stats = roadNetwork.getStats();
  console.log(`[RoadExtractor] Dual-lane network: ${stats.waypoints} waypoints, ${stats.segments} segments`);
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(RoadExtractor): implement dual-lane tile extraction"
```

---

## Task 4: Add Raycast for Vehicle Ground Placement

**Files:**
- Modify: `src/world/traffic/AdvancedTrafficSystem.ts`

**Step 1: Add scene reference and raycaster**

Add after line 90 (after vehicleGroup declaration):
```typescript
// Scene reference for raycasting
private scene: THREE.Scene | null = null;
private raycaster: THREE.Raycaster = new THREE.Raycaster();

/**
 * Set the scene for raycasting ground detection
 */
public setScene(scene: THREE.Scene): void {
  this.scene = scene;
}
```

**Step 2: Add findGroundLevel helper**

Add after setScene method:
```typescript
/**
 * Raycast down to find ground level at position
 * Returns Y position of ground, or null if no ground found
 */
private findGroundLevel(position: THREE.Vector3): number | null {
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
```

**Step 3: Update spawnVehicleAt to use raycast**

Modify `spawnVehicleAt` method (around line 204) - add raycast after getting world position:
```typescript
// Get mesh world position
const position = new THREE.Vector3();
mesh.getWorldPosition(position);

// Raycast to find ground level
const groundY = this.findGroundLevel(position);
if (groundY !== null) {
  position.y = groundY + 0.1;
}
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(AdvancedTraffic): add raycast ground placement for vehicles"
```

---

## Task 5: Implement Right-of-Way Rules

**Files:**
- Modify: `src/world/traffic/AdvancedTrafficSystem.ts`

**Step 1: Add crossing trajectory detection**

Add after findLeader method (around line 425):
```typescript
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
```

**Step 2: Update findLeader to check right-of-way**

Add to end of findLeader method, before the return statement:
```typescript
// Check for crossing trajectories (right-of-way rule)
for (const other of this.vehicles.values()) {
  if (other.id === vehicle.id) continue;

  if (!this.hasCrossingTrajectory(vehicle, other)) continue;
  if (!this.isToMyRight(vehicle, other)) continue;

  const distance = vehicle.position.distanceTo(other.position);
  const gap = distance - vehicle.length / 2 - other.length / 2;

  if (gap < 15 && gap < minGap) {
    minGap = gap;
    leaderVelocity = 0;
  }
}
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(AdvancedTraffic): implement right-of-way rules for intersections"
```

---

## Task 6: Add Box3 Collision Detection

**Files:**
- Modify: `src/world/traffic/AdvancedTrafficSystem.ts`

**Step 1: Add collisionBox to SimulatedVehicle**

Modify interface at top (around line 9):
```typescript
interface SimulatedVehicle {
  // ... existing properties ...

  /** Collision bounding box (world space) */
  collisionBox: THREE.Box3;
}
```

**Step 2: Initialize collision box in spawnVehicleAt**

Add to vehicle object creation (around line 235):
```typescript
collisionBox: new THREE.Box3().setFromObject(mesh),
```

**Step 3: Update collision box in updateVehicle**

Add at end of updateVehicle method (before closing brace):
```typescript
// Update collision box
vehicle.collisionBox.setFromObject(vehicle.mesh);
```

**Step 4: Add public collision check methods**

Add at end of class:
```typescript
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
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(AdvancedTraffic): add Box3 collision detection for player"
```

---

## Task 7: Integration and Browser Testing

**Step 1: Run TypeScript type check**

Run: `npm run typecheck`
Expected: No errors

**Step 2: Build the project**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Manual browser test**

Run: `npm run dev`

Test checklist:
- [ ] Auta v protisměru se míjejí bez zastavení
- [ ] Auta na křižovatkách respektují pravidlo pravé ruky
- [ ] Auta jsou usazena na silnici (nelevitují)

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete dual-lane traffic system with collision detection"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Waypoint direction | RoadNetwork.ts |
| 2 | Dual-lane config | RoadExtractor.ts |
| 3 | Dual-lane extraction | RoadExtractor.ts |
| 4 | Raycast ground | AdvancedTrafficSystem.ts |
| 5 | Right-of-way | AdvancedTrafficSystem.ts |
| 6 | Box3 collision | AdvancedTrafficSystem.ts |
| 7 | Integration test | Manual browser |
