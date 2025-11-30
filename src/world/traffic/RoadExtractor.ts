import * as THREE from 'three';
import { RoadNetwork, Waypoint } from './RoadNetwork';

/**
 * Road tile type - determines connection pattern
 */
type RoadTileType = 'straight' | 'corner' | 't_intersection' | 'intersection' | 'end';

/**
 * Detected road tile with position and type
 */
interface RoadTile {
  name: string;
  type: RoadTileType;
  position: THREE.Vector3;
  rotation: number; // Y rotation in radians
}

/**
 * Configuration for road extraction
 */
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
  /** Material names that indicate road surfaces */
  roadMaterialNames: string[];
}

const DEFAULT_CONFIG: RoadExtractorConfig = {
  roadPatterns: [
    /^road_\d+/i,  // road_001, road_009, etc.
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
  yOffset: 0.02,
  useGeometryDetection: true,
  maxRoadY: 1.0,          // Roads are near ground level
  roadColorThreshold: 0.3, // Dark colors (RGB < 0.3)
  tileSize: 15,           // Grid size for cartoon-city (positions at 7.5, 22.5, etc.)
  useDualLanes: false,     // TEMPORARILY DISABLED for debugging - single lane mode
  laneOffset: 1.5,  // Reduced from 2.5 - keeps waypoints closer to road center
  /** Material names that indicate road surfaces */
  roadMaterialNames: ['Roads', 'Road', 'Asphalt', 'Street', 'Asphalt_Dark_Gray'],
};

/**
 * Road tile type mappings for cartoon-city
 * Based on analysis of road positions:
 * - road_013: 4-way intersection (at corners -52.5, -67.5 etc)
 * - road_019: T-intersection
 * - road_020: T-intersection
 * - road_022: Corner or T-intersection
 * - road_009: Straight road
 * - road_001, road_003: Straight road
 */
const ROAD_TILE_TYPES: Record<string, RoadTileType> = {
  'road_013': 'intersection',   // 4-way intersection
  'road_019': 't_intersection', // T-intersection
  'road_020': 't_intersection', // T-intersection
  'road_022': 'corner',         // Corner
  'road_009': 'straight',       // Straight
  'road_001': 'straight',       // Straight
  'road_003': 'straight',       // Straight
};

/**
 * RoadExtractor - Extracts road network from 3D model
 *
 * Analyzes mesh geometry to create a waypoint-based road network.
 * Works by:
 * 1. Finding road meshes by name pattern
 * 2. Getting bounding boxes of road segments
 * 3. Creating waypoints along the road centerlines
 * 4. Connecting nearby waypoints to form the network
 */
export class RoadExtractor {
  private readonly config: RoadExtractorConfig;

  constructor(config: Partial<RoadExtractorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    // Suppress unused method warnings - kept for future use
    void this.createDualLaneNetwork;
    void this.createSingleLaneNetwork;
  }

  /**
   * Extract road network from a city model
   */
  public extractFromModel(cityModel: THREE.Group, roadNetwork: RoadNetwork): void {
    console.log('[RoadExtractor] Analyzing city model for roads...');

    // First, try tile-based extraction (for cartoon-city style models with road_xxx naming)
    const roadTiles = this.detectRoadTiles(cityModel);
    if (roadTiles.length > 0) {
      console.log(`[RoadExtractor] Found ${roadTiles.length} road tiles, using tile-based extraction`);
      this.extractFromTiles(roadTiles, roadNetwork);
      return;
    }

    // Try material-based detection for models with 'Roads' material
    console.log(`[RoadExtractor] Trying material-based road detection...`);
    const roadMeshesByMaterial = this.detectRoadsByMaterial(cityModel);

    if (roadMeshesByMaterial.length > 0) {
      console.log(`[RoadExtractor] Found ${roadMeshesByMaterial.length} road meshes by material, extracting waypoints...`);
      this.extractWaypointsFromRoadMeshes(roadMeshesByMaterial, roadNetwork);

      const stats = roadNetwork.getStats();
      if (stats.segments > 0) {
        console.log(`[RoadExtractor] Material-based extraction successful: ${stats.waypoints} waypoints, ${stats.segments} segments`);
        return;
      }
      console.log(`[RoadExtractor] Material-based extraction produced no segments, falling back to default grid`);
    }

    const roadMeshes: THREE.Mesh[] = [];

    // Try name-based detection first
    cityModel.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;

      const name = child.name || '';
      const isExcluded = this.config.excludePatterns.some(p => p.test(name));
      if (isExcluded) return;

      const isRoadByName = this.config.roadPatterns.some(p => p.test(name));
      if (isRoadByName) {
        roadMeshes.push(child);
      }
    });

    console.log(`[RoadExtractor] Found ${roadMeshes.length} road meshes by name`);

    // If name-based detection failed, try geometry-based detection
    if (roadMeshes.length === 0 && this.config.useGeometryDetection) {
      console.log('[RoadExtractor] Using geometry-based road detection...');
      this.detectRoadsByGeometry(cityModel, roadMeshes);
    }

    if (roadMeshes.length === 0) {
      console.log('[RoadExtractor] No road meshes found, creating default grid...');
      this.createDefaultGrid(cityModel, roadNetwork);
      return;
    }

    console.log(`[RoadExtractor] Processing ${roadMeshes.length} road meshes`);

    // Log first few road meshes
    roadMeshes.slice(0, 5).forEach(m => {
      const box = new THREE.Box3().setFromObject(m);
      const size = box.getSize(new THREE.Vector3());
      console.log(`[RoadExtractor] Road: "${m.name}" size: ${size.x.toFixed(1)} x ${size.z.toFixed(1)}, Y: ${box.max.y.toFixed(1)}`);
    });

    // Extract waypoints from road meshes
    this.extractWaypointsFromMeshes(roadMeshes, roadNetwork);
  }

  /**
   * Detect road tiles from model (for tile-based city models like cartoon-city)
   */
  private detectRoadTiles(cityModel: THREE.Group): RoadTile[] {
    const tiles: RoadTile[] = [];

    // Debug: log all unique node names to find road naming pattern
    const allNames = new Set<string>();
    cityModel.traverse((child) => {
      if (child.name) allNames.add(child.name);
    });
    console.log(`[RoadExtractor] All unique node names (sample):`, Array.from(allNames).slice(0, 30).join(', '));

    cityModel.traverse((child) => {
      const name = child.name || '';

      // Check for road_xxx pattern
      const match = name.match(/^(road_\d+)/i);
      if (!match) return;

      const baseName = match[1]!.toLowerCase();
      const tileType = ROAD_TILE_TYPES[baseName] || 'straight';

      // Get world position
      const worldPos = new THREE.Vector3();
      child.getWorldPosition(worldPos);

      // Get rotation
      const rotation = child.rotation.y;

      tiles.push({
        name: baseName,
        type: tileType,
        position: worldPos,
        rotation,
      });
    });

    // Debug: log positions of first few tiles grouped by type
    const byType = new Map<RoadTileType, THREE.Vector3[]>();
    for (const t of tiles) {
      const arr = byType.get(t.type) || [];
      arr.push(t.position);
      byType.set(t.type, arr);
    }
    console.log(`[RoadExtractor] Detected ${tiles.length} road tiles:`);
    for (const [type, positions] of byType.entries()) {
      console.log(`[RoadExtractor]   ${type}: ${positions.length} tiles`);
      // Log first 3 positions
      positions.slice(0, 3).forEach((p, i) => {
        console.log(`[RoadExtractor]     ${i}: (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`);
      });
    }

    return tiles;
  }

  /**
   * Extract road network from tile positions with dual-lane support
   */
  private extractFromTiles(tiles: RoadTile[], roadNetwork: RoadNetwork): void {
    const { defaultSpeedLimit, yOffset, useDualLanes, laneOffset } = this.config;

    // Detect actual tile size from the data by analyzing position differences
    const detectedTileSize = this.detectTileSizeFromPositions(tiles);
    const tileSize = detectedTileSize || this.config.tileSize;

    console.log(`[RoadExtractor] Using tile size: ${tileSize} (detected: ${detectedTileSize})`);

    // Round positions to grid based on actual tile size
    const gridPositions = new Map<string, RoadTile>();

    // First, find the grid origin (minimum position snapped to tileSize)
    let minX = Infinity, minZ = Infinity;
    for (const tile of tiles) {
      if (tile.position.x < minX) minX = tile.position.x;
      if (tile.position.z < minZ) minZ = tile.position.z;
    }

    // Snap to grid
    const gridOriginX = Math.floor(minX / tileSize) * tileSize;
    const gridOriginZ = Math.floor(minZ / tileSize) * tileSize;

    console.log(`[RoadExtractor] Grid origin: (${gridOriginX}, ${gridOriginZ})`);

    for (const tile of tiles) {
      // Snap position to nearest grid cell
      const gx = Math.round((tile.position.x - gridOriginX) / tileSize) * tileSize + gridOriginX;
      const gz = Math.round((tile.position.z - gridOriginZ) / tileSize) * tileSize + gridOriginZ;
      const key = `${gx.toFixed(1)},${gz.toFixed(1)}`;

      const existing = gridPositions.get(key);
      if (!existing || this.getTilePriority(tile.type) > this.getTilePriority(existing.type)) {
        gridPositions.set(key, {
          ...tile,
          position: new THREE.Vector3(tile.position.x, yOffset, tile.position.z),
        });
      }
    }

    console.log(`[RoadExtractor] Grid has ${gridPositions.size} unique road positions`);

    // Debug: log some grid positions
    let count = 0;
    for (const [key, tile] of gridPositions.entries()) {
      if (count++ < 5) {
        console.log(`[RoadExtractor]   ${key}: ${tile.name} (${tile.type})`);
      }
    }

    if (!useDualLanes) {
      this.extractSingleLaneTiles(gridPositions, roadNetwork, tileSize, defaultSpeedLimit);
      return;
    }

    this.extractDualLaneTiles(gridPositions, roadNetwork, tileSize, defaultSpeedLimit, laneOffset);
  }

  /**
   * Helper to create grid key with consistent formatting
   */
  private makeGridKey(x: number, z: number): string {
    return `${x.toFixed(1)},${z.toFixed(1)}`;
  }

  /**
   * Single-lane tile extraction with smooth corner waypoints
   */
  private extractSingleLaneTiles(
    gridPositions: Map<string, RoadTile>,
    roadNetwork: RoadNetwork,
    tileSize: number,
    defaultSpeedLimit: number
  ): void {
    const waypointMap = new Map<string, Waypoint>();
    // Store corner waypoints for intersections: key -> {direction -> cornerWp}
    const cornerWaypoints = new Map<string, Map<string, Waypoint>>();

    const directions = [
      { name: 'E', dx: tileSize, dz: 0 },
      { name: 'W', dx: -tileSize, dz: 0 },
      { name: 'N', dx: 0, dz: tileSize },
      { name: 'S', dx: 0, dz: -tileSize },
    ];

    // First pass: create center waypoints and detect neighbors
    const neighborInfo = new Map<string, Set<string>>();

    for (const [key, tile] of gridPositions.entries()) {
      const [gxStr, gzStr] = key.split(',');
      const gx = parseFloat(gxStr!);
      const gz = parseFloat(gzStr!);

      // Find which directions have neighbors
      const neighbors = new Set<string>();
      for (const dir of directions) {
        const neighborKey = this.makeGridKey(gx + dir.dx, gz + dir.dz);
        if (gridPositions.has(neighborKey)) {
          neighbors.add(dir.name);
        }
      }
      neighborInfo.set(key, neighbors);

      const isIntersection = tile.type === 'intersection' || tile.type === 't_intersection' || neighbors.size >= 3;
      const wp = roadNetwork.createWaypoint(tile.position, {
        speedLimit: isIntersection ? defaultSpeedLimit * 0.7 : defaultSpeedLimit,
        isIntersection,
      });
      waypointMap.set(key, wp);
    }

    // Second pass: create corner waypoints at intersections for smoother turns
    const cornerOffset = tileSize * 0.35; // Corner waypoints at 35% from center towards edge

    for (const [key, tile] of gridPositions.entries()) {
      const neighbors = neighborInfo.get(key) || new Set<string>();

      // Only add corner waypoints at intersections (3+ connections) or corners (2 perpendicular connections)
      const isCorner = neighbors.size === 2 && !this.areOppositeDirections(neighbors);
      const isIntersection = neighbors.size >= 3;

      if (!isCorner && !isIntersection) continue;

      const corners = new Map<string, Waypoint>();

      for (const dir of directions) {
        if (!neighbors.has(dir.name)) continue;

        // Create corner waypoint offset towards this direction
        const cornerPos = tile.position.clone();
        if (dir.name === 'E') cornerPos.x += cornerOffset;
        else if (dir.name === 'W') cornerPos.x -= cornerOffset;
        else if (dir.name === 'N') cornerPos.z += cornerOffset;
        else if (dir.name === 'S') cornerPos.z -= cornerOffset;

        const cornerWp = roadNetwork.createWaypoint(cornerPos, {
          speedLimit: defaultSpeedLimit * 0.6, // Slower at corners
          isIntersection: false,
        });

        corners.set(dir.name, cornerWp);
      }

      cornerWaypoints.set(key, corners);
    }

    // Third pass: connect everything
    let straightConnections = 0;
    let cornerConnections = 0;

    for (const [key, wp] of waypointMap.entries()) {
      const [gxStr, gzStr] = key.split(',');
      const gx = parseFloat(gxStr!);
      const gz = parseFloat(gzStr!);
      const corners = cornerWaypoints.get(key);

      for (const dir of directions) {
        const neighborKey = this.makeGridKey(gx + dir.dx, gz + dir.dz);
        const neighbor = waypointMap.get(neighborKey);

        if (!neighbor) continue;

        const neighborCorners = cornerWaypoints.get(neighborKey);
        const oppositeDir = this.getOppositeDirection(dir.name);

        // Get corner waypoints if they exist
        const myCorner = corners?.get(dir.name);
        const neighborCorner = neighborCorners?.get(oppositeDir);

        if (myCorner && neighborCorner) {
          // Connect: center -> myCorner -> neighborCorner -> neighbor center
          roadNetwork.connect(wp.id, myCorner.id);
          roadNetwork.connect(myCorner.id, neighborCorner.id);
          roadNetwork.connect(neighborCorner.id, neighbor.id);
          // Reverse direction
          roadNetwork.connect(neighbor.id, neighborCorner.id);
          roadNetwork.connect(neighborCorner.id, myCorner.id);
          roadNetwork.connect(myCorner.id, wp.id);
          cornerConnections++;
        } else if (myCorner) {
          // Only this tile has corners
          roadNetwork.connect(wp.id, myCorner.id);
          roadNetwork.connect(myCorner.id, neighbor.id);
          roadNetwork.connect(neighbor.id, myCorner.id);
          roadNetwork.connect(myCorner.id, wp.id);
          cornerConnections++;
        } else if (neighborCorner) {
          // Only neighbor has corners
          roadNetwork.connect(wp.id, neighborCorner.id);
          roadNetwork.connect(neighborCorner.id, neighbor.id);
          roadNetwork.connect(neighbor.id, neighborCorner.id);
          roadNetwork.connect(neighborCorner.id, wp.id);
          cornerConnections++;
        } else {
          // No corners - direct connection
          if (!wp.connections.includes(neighbor.id)) {
            roadNetwork.connectBidirectional(wp.id, neighbor.id);
            straightConnections++;
          }
        }
      }

      // Connect corner waypoints within the same intersection for turning
      if (corners && corners.size >= 2) {
        const cornerList = Array.from(corners.values());
        for (let i = 0; i < cornerList.length; i++) {
          for (let j = i + 1; j < cornerList.length; j++) {
            const c1 = cornerList[i]!;
            const c2 = cornerList[j]!;
            roadNetwork.connectBidirectional(c1.id, c2.id);
          }
        }
      }
    }

    const stats = roadNetwork.getStats();
    console.log(`[RoadExtractor] Single-lane network: ${stats.waypoints} waypoints, ${stats.segments} segments`);
    console.log(`[RoadExtractor]   Straight: ${straightConnections}, Corner: ${cornerConnections}`);
  }

  /**
   * Check if two directions are opposite (E-W or N-S)
   */
  private areOppositeDirections(dirs: Set<string>): boolean {
    return (dirs.has('E') && dirs.has('W')) || (dirs.has('N') && dirs.has('S'));
  }

  /**
   * Get opposite direction
   */
  private getOppositeDirection(dir: string): string {
    switch (dir) {
      case 'E': return 'W';
      case 'W': return 'E';
      case 'N': return 'S';
      case 'S': return 'N';
      default: return dir;
    }
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
      const [gxStr, gzStr] = key.split(',');
      const gx = parseFloat(gxStr!);
      const gz = parseFloat(gzStr!);

      for (const dir of cardinalDirs) {
        // Check if this direction has a neighbor (road continues)
        const neighborKey = this.makeGridKey(gx + dir.dx * tileSize, gz + dir.dz * tileSize);
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
    let straightConnections = 0;
    let turnConnections = 0;

    for (const [key, tile] of gridPositions.entries()) {
      const [gxStr, gzStr] = key.split(',');
      const gx = parseFloat(gxStr!);
      const gz = parseFloat(gzStr!);
      const isIntersection = tile.type === 'intersection' || tile.type === 't_intersection';

      for (const dir of cardinalDirs) {
        const wpKey = `${key}:${dir.name}`;
        const wp = directionalWaypoints.get(wpKey);
        if (!wp) continue;

        // Connect to same direction in next tile
        const neighborKey = this.makeGridKey(gx + dir.dx * tileSize, gz + dir.dz * tileSize);
        const neighborWpKey = `${neighborKey}:${dir.name}`;
        const neighborWp = directionalWaypoints.get(neighborWpKey);

        if (neighborWp) {
          roadNetwork.connect(wp.id, neighborWp.id);
          straightConnections++;
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
              turnConnections++;
            }
          }
        }
      }
    }

    const stats = roadNetwork.getStats();
    console.log(`[RoadExtractor] Dual-lane network: ${stats.waypoints} waypoints, ${stats.segments} segments`);
    console.log(`[RoadExtractor]   Straight connections: ${straightConnections}, Turn connections: ${turnConnections}`);
  }

  /**
   * Detect tile size by analyzing position differences between tiles
   * Returns the most common distance between adjacent tiles
   */
  private detectTileSizeFromPositions(tiles: RoadTile[]): number | null {
    if (tiles.length < 2) return null;

    // Collect all pairwise distances that look like adjacent tiles
    const distances: number[] = [];
    const maxAdjacentDist = 25; // Max distance to consider "adjacent"
    const minAdjacentDist = 5;  // Min distance to avoid same-tile comparisons

    for (let i = 0; i < tiles.length; i++) {
      for (let j = i + 1; j < tiles.length; j++) {
        const t1 = tiles[i]!;
        const t2 = tiles[j]!;

        // Calculate axis-aligned distances
        const dx = Math.abs(t1.position.x - t2.position.x);
        const dz = Math.abs(t1.position.z - t2.position.z);

        // If tiles are aligned on one axis, the other axis distance is the tile size
        if (dx < 2 && dz > minAdjacentDist && dz < maxAdjacentDist) {
          distances.push(dz);
        } else if (dz < 2 && dx > minAdjacentDist && dx < maxAdjacentDist) {
          distances.push(dx);
        }
      }
    }

    if (distances.length === 0) return null;

    // Find the most common distance (mode)
    const buckets = new Map<number, number>();
    for (const d of distances) {
      const rounded = Math.round(d);
      buckets.set(rounded, (buckets.get(rounded) || 0) + 1);
    }

    let bestSize = 15;
    let bestCount = 0;
    for (const [size, count] of buckets.entries()) {
      if (count > bestCount) {
        bestCount = count;
        bestSize = size;
      }
    }

    console.log(`[RoadExtractor] Detected tile size: ${bestSize} (from ${distances.length} adjacent pairs)`);
    return bestSize;
  }

  /**
   * Get priority for tile type (higher = more specific)
   */
  private getTilePriority(type: RoadTileType): number {
    switch (type) {
      case 'intersection': return 4;
      case 't_intersection': return 3;
      case 'corner': return 2;
      case 'end': return 1;
      case 'straight': return 0;
      default: return 0;
    }
  }

  /**
   * Detect roads by geometry characteristics:
   * - Flat meshes (small height)
   * - Near ground level (low Y)
   * - Large surface area
   * - Dark color (asphalt)
   */
  private detectRoadsByGeometry(cityModel: THREE.Group, roadMeshes: THREE.Mesh[]): void {
    const potentialRoads: Array<{ mesh: THREE.Mesh; score: number; info: string }> = [];

    cityModel.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;

      const name = child.name || '';
      const isExcluded = this.config.excludePatterns.some(p => p.test(name));
      if (isExcluded) return;

      // Get world bounding box
      const box = new THREE.Box3().setFromObject(child);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      // Skip if too high above ground
      if (box.max.y > this.config.maxRoadY + 2) return;

      // Calculate flatness (roads are flat - small height compared to width/depth)
      const flatness = Math.min(size.x, size.z) / Math.max(0.1, size.y);
      if (flatness < 5) return; // Not flat enough

      // Calculate area
      const area = size.x * size.z;
      if (area < 10) return; // Too small

      // Check material color
      let colorScore = 0;
      const material = child.material;
      if (material && !Array.isArray(material)) {
        const mat = material as THREE.MeshStandardMaterial;
        if (mat.color) {
          const brightness = (mat.color.r + mat.color.g + mat.color.b) / 3;
          // Dark colors get higher score (roads are dark)
          if (brightness < this.config.roadColorThreshold) {
            colorScore = 1 - brightness;
          }
        }
      }

      // Calculate overall score
      const score = flatness * 0.3 + area * 0.01 + colorScore * 50 + (1 - box.max.y) * 10;

      if (score > 10) {
        potentialRoads.push({
          mesh: child,
          score,
          info: `flatness=${flatness.toFixed(1)}, area=${area.toFixed(0)}, color=${colorScore.toFixed(2)}, Y=${center.y.toFixed(1)}`
        });
      }
    });

    // Sort by score and take top candidates
    potentialRoads.sort((a, b) => b.score - a.score);

    console.log(`[RoadExtractor] Found ${potentialRoads.length} potential road meshes by geometry`);
    potentialRoads.slice(0, 10).forEach(r => {
      console.log(`[RoadExtractor]   "${r.mesh.name}" score=${r.score.toFixed(1)} (${r.info})`);
    });

    // Add top scoring meshes as roads
    const topRoads = potentialRoads.slice(0, Math.min(50, potentialRoads.length));
    topRoads.forEach(r => roadMeshes.push(r.mesh));
  }

  /**
   * Extract waypoints from road mesh geometry
   */
  private extractWaypointsFromMeshes(meshes: THREE.Mesh[], roadNetwork: RoadNetwork): void {
    const allWaypoints: THREE.Vector3[] = [];

    for (const mesh of meshes) {
      // Get world bounding box
      const box = new THREE.Box3().setFromObject(mesh);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      // Determine road direction (longer axis)
      const isHorizontal = size.x > size.z;
      const length = isHorizontal ? size.x : size.z;
      const width = isHorizontal ? size.z : size.x;

      // Skip if too small
      if (length < this.config.minSegmentLength) continue;
      if (width < 2) continue; // Too narrow to be a road

      // Create waypoints along the road
      const numWaypoints = Math.max(2, Math.floor(length / this.config.waypointSpacing));

      for (let i = 0; i < numWaypoints; i++) {
        const t = i / (numWaypoints - 1);
        const pos = new THREE.Vector3();

        if (isHorizontal) {
          pos.x = box.min.x + t * size.x;
          pos.z = center.z;
        } else {
          pos.x = center.x;
          pos.z = box.min.z + t * size.z;
        }

        pos.y = box.max.y + this.config.yOffset;
        allWaypoints.push(pos);
      }
    }

    console.log(`[RoadExtractor] Generated ${allWaypoints.length} potential waypoints`);

    // Create waypoints and connect nearby ones
    this.connectWaypoints(allWaypoints, roadNetwork);
  }

  /**
   * Connect waypoints that are close to each other
   */
  private connectWaypoints(positions: THREE.Vector3[], roadNetwork: RoadNetwork): void {
    // Create all waypoints
    const waypoints = positions.map(pos =>
      roadNetwork.createWaypoint(pos, { speedLimit: this.config.defaultSpeedLimit })
    );

    // Connect nearby waypoints
    const connectionRadius = this.config.waypointSpacing * 1.5;

    for (let i = 0; i < waypoints.length; i++) {
      const wp1 = waypoints[i]!;

      for (let j = i + 1; j < waypoints.length; j++) {
        const wp2 = waypoints[j]!;
        const dist = wp1.position.distanceTo(wp2.position);

        if (dist < connectionRadius && dist > 1) {
          roadNetwork.connectBidirectional(wp1.id, wp2.id);
        }
      }
    }

    const stats = roadNetwork.getStats();
    console.log(`[RoadExtractor] Created network: ${stats.waypoints} waypoints, ${stats.segments} segments`);
  }

  /**
   * Create a default grid road network based on city bounds
   */
  private createDefaultGrid(cityModel: THREE.Group, roadNetwork: RoadNetwork): void {
    const box = new THREE.Box3().setFromObject(cityModel);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    // Create a grid that covers the city
    const cellSize = 30; // 30 units between intersections
    const gridWidth = Math.max(2, Math.floor(size.x / cellSize));
    const gridHeight = Math.max(2, Math.floor(size.z / cellSize));

    console.log(`[RoadExtractor] Creating default ${gridWidth}x${gridHeight} grid`);

    roadNetwork.createGrid(
      new THREE.Vector3(center.x, 0, center.z),
      gridWidth,
      gridHeight,
      cellSize,
      { speedLimit: this.config.defaultSpeedLimit }
    );
  }

  /**
   * Create a simple loop road around the city perimeter
   */
  public createPerimeterRoad(cityModel: THREE.Group, roadNetwork: RoadNetwork): void {
    const box = new THREE.Box3().setFromObject(cityModel);
    const margin = 10;

    const positions = [
      new THREE.Vector3(box.min.x + margin, 0, box.min.z + margin),
      new THREE.Vector3(box.max.x - margin, 0, box.min.z + margin),
      new THREE.Vector3(box.max.x - margin, 0, box.max.z - margin),
      new THREE.Vector3(box.min.x + margin, 0, box.max.z - margin),
    ];

    roadNetwork.createRoad(positions, {
      bidirectional: true,
      closedLoop: true,
      speedLimit: 10,
    });

    console.log('[RoadExtractor] Created perimeter road');
  }

  /**
   * Create roads along main streets (X and Z axes through center)
   */
  public createMainStreets(cityModel: THREE.Group, roadNetwork: RoadNetwork): void {
    const box = new THREE.Box3().setFromObject(cityModel);
    const center = box.getCenter(new THREE.Vector3());
    const margin = 5;

    // Main street along X axis
    const mainStreetX = [
      new THREE.Vector3(box.min.x + margin, 0, center.z),
      new THREE.Vector3(center.x, 0, center.z),
      new THREE.Vector3(box.max.x - margin, 0, center.z),
    ];

    // Main street along Z axis
    const mainStreetZ = [
      new THREE.Vector3(center.x, 0, box.min.z + margin),
      new THREE.Vector3(center.x, 0, center.z),
      new THREE.Vector3(center.x, 0, box.max.z - margin),
    ];

    roadNetwork.createRoad(mainStreetX, { bidirectional: true, speedLimit: 10 });
    roadNetwork.createRoad(mainStreetZ, { bidirectional: true, speedLimit: 10 });

    // Mark center as intersection
    const centerWp = roadNetwork.findNearestWaypoint(center);
    if (centerWp) {
      centerWp.isIntersection = true;
    }

    console.log('[RoadExtractor] Created main streets');
  }

  /**
   * Detect road meshes by material name (e.g., "Roads" material in Cartoon City GLB)
   */
  private detectRoadsByMaterial(cityModel: THREE.Group): THREE.Mesh[] {
    const roadMeshes: THREE.Mesh[] = [];
    const { roadMaterialNames, excludePatterns } = this.config;

    // Ensure world matrices are up to date for accurate bounding box calculations
    cityModel.updateMatrixWorld(true);

    console.log(`[RoadExtractor] Looking for materials: ${roadMaterialNames.join(', ')}`);

    // Debug: collect all unique material names
    const allMaterialNames = new Set<string>();

    cityModel.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;

      // Collect all material names for debug
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach(m => { if (m?.name) allMaterialNames.add(m.name); });

      // Check if excluded by name
      const name = child.name || '';
      const isExcluded = excludePatterns.some(p => p.test(name));
      if (isExcluded) return;

      // Check material name
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of materials) {
        if (!mat || !mat.name) continue;

        const isRoadMaterial = roadMaterialNames.some(
          roadMatName => mat.name.toLowerCase().includes(roadMatName.toLowerCase())
        );

        if (isRoadMaterial) {
          roadMeshes.push(child);
          break;
        }
      }
    });

    console.log(`[RoadExtractor] All material names in model: ${Array.from(allMaterialNames).join(', ')}`);
    console.log(`[RoadExtractor] Found ${roadMeshes.length} meshes with road materials`);

    // Debug: log material names found
    if (roadMeshes.length > 0) {
      const sampleMaterials = new Set<string>();
      roadMeshes.slice(0, 10).forEach(m => {
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach(mat => {
          if (mat?.name) sampleMaterials.add(mat.name);
        });
      });
      console.log(`[RoadExtractor] Road materials found: ${Array.from(sampleMaterials).join(', ')}`);
    }

    return roadMeshes;
  }

  /**
   * Extract waypoints from road mesh geometry
   * Creates a grid of waypoints based on road surface positions
   */
  private extractWaypointsFromRoadMeshes(roadMeshes: THREE.Mesh[], roadNetwork: RoadNetwork): void {
    const { waypointSpacing, yOffset, defaultSpeedLimit } = this.config;

    // Collect all road surface points by sampling mesh bounding boxes
    interface RoadPoint {
      position: THREE.Vector3;
      isLongX: boolean; // Is this road segment oriented along X axis?
    }
    const roadPoints: RoadPoint[] = [];

    // Debug: log first few road meshes to understand their positions
    console.log(`[RoadExtractor] Processing ${roadMeshes.length} road meshes, yOffset=${yOffset}`);

    for (const mesh of roadMeshes) {
      const box = new THREE.Box3().setFromObject(mesh);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      // Debug first few meshes
      if (roadPoints.length < 3) {
        console.log(`[RoadExtractor] Road mesh "${mesh.name}": Y range [${box.min.y.toFixed(2)}, ${box.max.y.toFixed(2)}], center Y=${center.y.toFixed(2)}`);
      }

      // Skip very small meshes (probably details)
      if (size.x < 3 && size.z < 3) continue;

      // Determine road orientation (longer axis is the road direction)
      const isLongX = size.x > size.z;
      const length = isLongX ? size.x : size.z;
      const width = isLongX ? size.z : size.x;

      // Skip very wide meshes (probably plazas or intersections)
      // But keep intersections - they have roughly equal width/length
      const isIntersection = Math.abs(size.x - size.z) < 5;

      if (width > 25 && !isIntersection) {
        continue;
      }

      // Sample points along the road
      const numSamples = Math.max(2, Math.ceil(length / waypointSpacing));

      for (let i = 0; i < numSamples; i++) {
        const t = numSamples === 1 ? 0.5 : i / (numSamples - 1);
        const pos = new THREE.Vector3();

        if (isLongX) {
          pos.x = box.min.x + t * size.x;
          pos.z = center.z;
        } else {
          pos.x = center.x;
          pos.z = box.min.z + t * size.z;
        }

        pos.y = box.max.y + yOffset;
        roadPoints.push({ position: pos, isLongX });
      }

      // For intersections, add center point
      if (isIntersection && size.x > 8 && size.z > 8) {
        roadPoints.push({
          position: new THREE.Vector3(center.x, box.max.y + yOffset, center.z),
          isLongX: true, // Will be treated as intersection
        });
      }
    }

    console.log(`[RoadExtractor] Collected ${roadPoints.length} road sample points`);

    // Remove duplicate points that are very close together
    // Use smaller precision to avoid snapping waypoints off the road
    const mergeDistance = 3; // Merge points within 3 units
    const uniquePoints = new Map<string, RoadPoint>();

    for (const point of roadPoints) {
      // Use actual position for key (rounded to 1 decimal for deduplication)
      const key = `${point.position.x.toFixed(1)},${point.position.z.toFixed(1)}`;

      // Check if a nearby point already exists
      let foundNearby = false;
      for (const [, existing] of uniquePoints) {
        const dx = Math.abs(existing.position.x - point.position.x);
        const dz = Math.abs(existing.position.z - point.position.z);
        if (dx < mergeDistance && dz < mergeDistance) {
          foundNearby = true;
          break;
        }
      }

      if (!foundNearby) {
        uniquePoints.set(key, {
          position: point.position.clone(),
          isLongX: point.isLongX,
        });
      }
    }

    console.log(`[RoadExtractor] Unique road points: ${uniquePoints.size}`);

    // For material-based extraction, use distance-based connection
    // because road meshes have actual road positions, not grid-aligned
    this.createDistanceBasedNetwork(uniquePoints, roadNetwork, waypointSpacing, defaultSpeedLimit);
  }

  /**
   * Create network by connecting waypoints based on distance
   * Used for material-based extraction where waypoints are at actual road positions
   */
  private createDistanceBasedNetwork(
    points: Map<string, { position: THREE.Vector3; isLongX: boolean }>,
    roadNetwork: RoadNetwork,
    maxConnectionDistance: number,
    defaultSpeedLimit: number
  ): void {
    const waypoints: Waypoint[] = [];

    // Create waypoints
    for (const [, point] of points.entries()) {
      const wp = roadNetwork.createWaypoint(point.position, {
        speedLimit: defaultSpeedLimit,
        isIntersection: false,
      });
      waypoints.push(wp);
    }

    // Connect waypoints that are within connection distance
    const connectionRadius = maxConnectionDistance * 1.2; // Slightly larger to account for spacing

    for (let i = 0; i < waypoints.length; i++) {
      const wp1 = waypoints[i]!;

      for (let j = i + 1; j < waypoints.length; j++) {
        const wp2 = waypoints[j]!;
        const dist = wp1.position.distanceTo(wp2.position);

        // Connect if within distance and not too close (avoid self-loops)
        if (dist < connectionRadius && dist > 2) {
          roadNetwork.connectBidirectional(wp1.id, wp2.id);
        }
      }

      // Mark as intersection if has 3+ connections
      if (wp1.connections.length >= 3) {
        wp1.isIntersection = true;
        wp1.speedLimit = defaultSpeedLimit * 0.7;
      }
    }

    const stats = roadNetwork.getStats();
    console.log(`[RoadExtractor] Distance-based network: ${stats.waypoints} waypoints, ${stats.segments} segments`);
  }

  /**
   * Create single-lane network from grid points (used for tile-based extraction)
   */
  private createSingleLaneNetwork(
    gridPoints: Map<string, { position: THREE.Vector3; isLongX: boolean }>,
    roadNetwork: RoadNetwork,
    gridSize: number,
    defaultSpeedLimit: number
  ): void {
    const waypointMap = new Map<string, Waypoint>();

    // Create waypoints
    for (const [key, point] of gridPoints.entries()) {
      const wp = roadNetwork.createWaypoint(point.position, {
        speedLimit: defaultSpeedLimit,
        isIntersection: false,
      });
      waypointMap.set(key, wp);
    }

    // Connect adjacent waypoints
    const directions = [
      { dx: gridSize, dz: 0 },
      { dx: -gridSize, dz: 0 },
      { dx: 0, dz: gridSize },
      { dx: 0, dz: -gridSize },
    ];

    for (const [key, wp] of waypointMap.entries()) {
      const [gxStr, gzStr] = key.split(',');
      const gx = parseFloat(gxStr!);
      const gz = parseFloat(gzStr!);

      for (const { dx, dz } of directions) {
        const neighborKey = `${(gx + dx).toFixed(1)},${(gz + dz).toFixed(1)}`;
        const neighbor = waypointMap.get(neighborKey);

        if (neighbor && !wp.connections.includes(neighbor.id)) {
          roadNetwork.connectBidirectional(wp.id, neighbor.id);
        }
      }

      // Mark as intersection if has 3+ connections
      if (wp.connections.length >= 3) {
        wp.isIntersection = true;
        wp.speedLimit = defaultSpeedLimit * 0.7;
      }
    }

    const stats = roadNetwork.getStats();
    console.log(`[RoadExtractor] Single-lane network: ${stats.waypoints} waypoints, ${stats.segments} segments`);
  }

  /**
   * Create dual-lane network from grid points
   * Each lane has separate waypoints offset from centerline
   * Note: Currently unused for material-based extraction, kept for future tile-based use
   */
  private createDualLaneNetwork(
    gridPoints: Map<string, { position: THREE.Vector3; isLongX: boolean }>,
    roadNetwork: RoadNetwork,
    gridSize: number,
    defaultSpeedLimit: number,
    laneOffset: number
  ): void {
    // For dual lanes, we need to create directional waypoints
    // Key: "x,z:direction" -> Waypoint
    const directionalWaypoints = new Map<string, Waypoint>();

    const cardinalDirs = [
      { name: 'E', dx: 1, dz: 0, vec: new THREE.Vector3(1, 0, 0) },   // East (+X)
      { name: 'W', dx: -1, dz: 0, vec: new THREE.Vector3(-1, 0, 0) }, // West (-X)
      { name: 'N', dx: 0, dz: 1, vec: new THREE.Vector3(0, 0, 1) },   // North (+Z)
      { name: 'S', dx: 0, dz: -1, vec: new THREE.Vector3(0, 0, -1) }, // South (-Z)
    ];

    // First pass: detect which directions have neighbors for each point
    const neighborInfo = new Map<string, Set<string>>();

    for (const [key] of gridPoints.entries()) {
      const [gxStr, gzStr] = key.split(',');
      const gx = parseFloat(gxStr!);
      const gz = parseFloat(gzStr!);
      const neighbors = new Set<string>();

      for (const dir of cardinalDirs) {
        const neighborKey = `${(gx + dir.dx * gridSize).toFixed(1)},${(gz + dir.dz * gridSize).toFixed(1)}`;
        if (gridPoints.has(neighborKey)) {
          neighbors.add(dir.name);
        }
      }

      neighborInfo.set(key, neighbors);
    }

    // Second pass: create waypoints for each grid point and direction
    for (const [key, point] of gridPoints.entries()) {
      const neighbors = neighborInfo.get(key) || new Set<string>();
      const isIntersection = neighbors.size >= 3;
      const speedLimit = isIntersection ? defaultSpeedLimit * 0.7 : defaultSpeedLimit;

      for (const dir of cardinalDirs) {
        // Only create waypoint if road continues in this direction OR it's an intersection
        if (!neighbors.has(dir.name) && !isIntersection) continue;

        // Calculate lane offset (right-hand traffic)
        // Cross product of direction and UP gives perpendicular (right) vector
        const up = new THREE.Vector3(0, 1, 0);
        const right = new THREE.Vector3().crossVectors(dir.vec, up).normalize();

        const wpPos = point.position.clone().add(right.multiplyScalar(laneOffset));

        const wp = roadNetwork.createWaypoint(wpPos, {
          speedLimit,
          isIntersection,
          direction: dir.vec.clone(),
        });

        directionalWaypoints.set(`${key}:${dir.name}`, wp);
      }
    }

    // Third pass: connect waypoints
    let straightConnections = 0;
    let turnConnections = 0;

    for (const [key] of gridPoints.entries()) {
      const [gxStr, gzStr] = key.split(',');
      const gx = parseFloat(gxStr!);
      const gz = parseFloat(gzStr!);
      const neighbors = neighborInfo.get(key) || new Set<string>();
      const isIntersection = neighbors.size >= 3;

      for (const dir of cardinalDirs) {
        const wpKey = `${key}:${dir.name}`;
        const wp = directionalWaypoints.get(wpKey);
        if (!wp) continue;

        // Connect to same direction in next tile (straight ahead)
        const neighborGridKey = `${(gx + dir.dx * gridSize).toFixed(1)},${(gz + dir.dz * gridSize).toFixed(1)}`;
        const neighborWpKey = `${neighborGridKey}:${dir.name}`;
        const neighborWp = directionalWaypoints.get(neighborWpKey);

        if (neighborWp) {
          roadNetwork.connect(wp.id, neighborWp.id);
          straightConnections++;
        }

        // At intersections, allow turning to perpendicular directions
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
              turnConnections++;
            }
          }
        }
      }
    }

    const stats = roadNetwork.getStats();
    console.log(`[RoadExtractor] Dual-lane network: ${stats.waypoints} waypoints, ${stats.segments} segments`);
    console.log(`[RoadExtractor]   Straight: ${straightConnections}, Turns: ${turnConnections}`);
  }
}
