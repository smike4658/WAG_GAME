import * as THREE from 'three';
import type { RoadData, OSMElement, LocalCoordinate } from './types';
import { CoordinateConverter } from './CoordinateConverter';

/**
 * Road type configuration: width and color
 */
interface RoadStyle {
  width: number;
  color: number;
}

const ROAD_STYLES: Record<string, RoadStyle> = {
  primary: { width: 14, color: 0x2a2a2a },      // Main roads - asphalt black
  secondary: { width: 11, color: 0x3a3a3a },    // Secondary - dark gray
  tertiary: { width: 9, color: 0x4a4a4a },      // Tertiary - gray
  residential: { width: 7, color: 0x5a5a5a },   // Residential streets
  service: { width: 5, color: 0x6a6a6a },       // Service roads
  pedestrian: { width: 8, color: 0xc9b896 },    // Pedestrian - cobblestone beige
  footway: { width: 2.5, color: 0xd4c4a8 },     // Footways - light sandy
  cycleway: { width: 2.5, color: 0x7a9e7a },    // Cycleways - green tint
  path: { width: 2, color: 0xbeb99a },          // Paths - sandy
  steps: { width: 2.5, color: 0x9a9a9a },       // Steps - light gray
  tram: { width: 4, color: 0x5a5a5a },          // Tram tracks - steel gray
  default: { width: 6, color: 0x5a5a5a },       // Default
};

/**
 * Generates road surfaces from OSM highway data
 * Creates flat mesh strips following the road path
 */
export class RoadGenerator {
  private readonly converter: CoordinateConverter;
  private readonly roadsGroup: THREE.Group;

  constructor() {
    this.converter = new CoordinateConverter();
    this.roadsGroup = new THREE.Group();
    this.roadsGroup.name = 'roads';
  }

  /**
   * Process all OSM highway elements and create road meshes
   */
  public processElements(elements: OSMElement[]): THREE.Group {
    const roads = elements.filter(
      (el) => el.type === 'way' && el.tags?.['highway'] && el.geometry
    );

    // Also process tram tracks
    const trams = elements.filter(
      (el) => el.type === 'way' && el.tags?.['railway'] === 'tram' && el.geometry
    );

    console.log(`[RoadGenerator] Processing ${roads.length} roads and ${trams.length} tram tracks`);

    let successCount = 0;

    // Process roads
    for (const road of roads) {
      try {
        const mesh = this.createRoadMesh(road);
        if (mesh) {
          this.roadsGroup.add(mesh);
          successCount++;
        }
      } catch (error) {
        console.warn(`[RoadGenerator] Failed to create road ${road.id}:`, error);
      }
    }

    // Process tram tracks
    for (const tram of trams) {
      try {
        const mesh = this.createTramMesh(tram);
        if (mesh) {
          this.roadsGroup.add(mesh);
          successCount++;
        }
      } catch (error) {
        console.warn(`[RoadGenerator] Failed to create tram ${tram.id}:`, error);
      }
    }

    console.log(`[RoadGenerator] Created ${successCount} road/tram meshes`);

    // Always generate procedural roads for guaranteed visibility
    console.log('[RoadGenerator] Generating procedural road network...');
    this.generateProceduralRoads();

    return this.roadsGroup;
  }

  /**
   * Generate procedural road network when OSM data is insufficient
   * Creates a central square (Masarykovo namesti) and radiating streets
   */
  private generateProceduralRoads(): void {
    // Player spawns at (0, 0) so center the roads there
    const centerX = 0;
    const centerZ = 0;

    // Create the central square (Masarykovo namesti - a large paved plaza)
    this.createCentralSquare(centerX, centerZ, 80);

    // Create main roads radiating from center
    const roadLength = 200;
    const angles = [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4, Math.PI, (5 * Math.PI) / 4, (3 * Math.PI) / 2, (7 * Math.PI) / 4];

    for (const angle of angles) {
      const endX = centerX + Math.cos(angle) * roadLength;
      const endZ = centerZ + Math.sin(angle) * roadLength;
      this.createStraightRoad(centerX, centerZ, endX, endZ, 10, 0x3a3a3a);
    }

    // Create some cross streets
    const crossDistances = [50, 100, 150];
    for (const dist of crossDistances) {
      // Horizontal cross streets
      this.createStraightRoad(
        centerX - roadLength, centerZ + dist,
        centerX + roadLength, centerZ + dist,
        7, 0x4a4a4a
      );
      this.createStraightRoad(
        centerX - roadLength, centerZ - dist,
        centerX + roadLength, centerZ - dist,
        7, 0x4a4a4a
      );
      // Vertical cross streets
      this.createStraightRoad(
        centerX + dist, centerZ - roadLength,
        centerX + dist, centerZ + roadLength,
        7, 0x4a4a4a
      );
      this.createStraightRoad(
        centerX - dist, centerZ - roadLength,
        centerX - dist, centerZ + roadLength,
        7, 0x4a4a4a
      );
    }

    // Add sidewalks around the square
    this.createSidewalk(centerX, centerZ, 85);

    console.log('[RoadGenerator] Generated procedural road network');
  }

  /**
   * Create central square plaza
   */
  private createCentralSquare(x: number, z: number, size: number): void {
    const geometry = new THREE.PlaneGeometry(size, size);
    const material = new THREE.MeshStandardMaterial({
      color: 0xa08060, // Cobblestone tan
      roughness: 0.85,
      metalness: 0.0,
    });

    const square = new THREE.Mesh(geometry, material);
    square.rotation.x = -Math.PI / 2;
    square.position.set(x, 0.1, z); // Raised higher
    square.receiveShadow = true;
    square.name = 'masarykovo-namesti';

    this.roadsGroup.add(square);

    // Add decorative pattern (inner square with different color)
    const innerGeometry = new THREE.PlaneGeometry(size * 0.6, size * 0.6);
    const innerMaterial = new THREE.MeshStandardMaterial({
      color: 0xb8a080, // Lighter center
      roughness: 0.8,
      metalness: 0.0,
    });
    const innerSquare = new THREE.Mesh(innerGeometry, innerMaterial);
    innerSquare.rotation.x = -Math.PI / 2;
    innerSquare.position.set(x, 0.11, z);
    innerSquare.receiveShadow = true;

    this.roadsGroup.add(innerSquare);

    console.log(`[RoadGenerator] Created central square at (${x}, ${z}) size ${size}`);
  }

  /**
   * Create sidewalk ring around the square
   */
  private createSidewalk(x: number, z: number, size: number): void {
    const width = 4;
    const halfSize = size / 2;

    // Four sides of sidewalk
    const sides = [
      { px: x, pz: z - halfSize - width / 2, sx: size + width * 2, sz: width }, // South
      { px: x, pz: z + halfSize + width / 2, sx: size + width * 2, sz: width }, // North
      { px: x - halfSize - width / 2, pz: z, sx: width, sz: size }, // West
      { px: x + halfSize + width / 2, pz: z, sx: width, sz: size }, // East
    ];

    const material = new THREE.MeshStandardMaterial({
      color: 0xc9b896,
      roughness: 0.8,
      metalness: 0.0,
    });

    for (const side of sides) {
      const geometry = new THREE.PlaneGeometry(side.sx, side.sz);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(side.px, 0.08, side.pz);
      mesh.receiveShadow = true;
      this.roadsGroup.add(mesh);
    }
  }

  /**
   * Create a straight road between two points
   */
  private createStraightRoad(
    x1: number, z1: number,
    x2: number, z2: number,
    width: number,
    color: number
  ): void {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const length = Math.sqrt(dx * dx + dz * dz);
    const angle = Math.atan2(dz, dx);

    const geometry = new THREE.PlaneGeometry(length, width);
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.9,
      metalness: 0.0,
    });

    const road = new THREE.Mesh(geometry, material);
    road.rotation.x = -Math.PI / 2;
    road.rotation.z = -angle;
    road.position.set((x1 + x2) / 2, 0.08, (z1 + z2) / 2); // Raised higher
    road.receiveShadow = true;

    this.roadsGroup.add(road);
  }

  /**
   * Create a road mesh from OSM highway element
   */
  private createRoadMesh(element: OSMElement): THREE.Mesh | null {
    const geometry = element.geometry;
    if (!geometry || geometry.length < 2) {
      return null;
    }

    const highwayType = element.tags?.['highway'] ?? 'default';
    const style = ROAD_STYLES[highwayType] ?? ROAD_STYLES['default'];
    if (!style) return null;

    // Convert coordinates to local
    const localCoords: LocalCoordinate[] = geometry.map((point) =>
      this.converter.toLocal(point.lat, point.lon)
    );

    // Create road geometry by buffering the line
    const roadGeometry = this.createBufferedLine(localCoords, style.width);
    if (!roadGeometry) {
      return null;
    }

    const material = new THREE.MeshStandardMaterial({
      color: style.color,
      roughness: 0.95,
      metalness: 0.0,
    });

    const mesh = new THREE.Mesh(roadGeometry, material);
    mesh.position.y = 0.05; // Above ground plane
    mesh.receiveShadow = true;
    mesh.castShadow = false;

    mesh.userData = {
      osmId: element.id,
      roadType: highwayType,
      name: element.tags?.['name'],
    };

    return mesh;
  }

  /**
   * Create tram track mesh
   */
  private createTramMesh(element: OSMElement): THREE.Mesh | null {
    const geometry = element.geometry;
    if (!geometry || geometry.length < 2) {
      return null;
    }

    const style = ROAD_STYLES['tram'];
    if (!style) return null;

    const localCoords: LocalCoordinate[] = geometry.map((point) =>
      this.converter.toLocal(point.lat, point.lon)
    );

    const trackGeometry = this.createBufferedLine(localCoords, style.width);
    if (!trackGeometry) {
      return null;
    }

    // Tram tracks get a slightly metallic look
    const material = new THREE.MeshStandardMaterial({
      color: style.color,
      roughness: 0.6,
      metalness: 0.3,
    });

    const mesh = new THREE.Mesh(trackGeometry, material);
    mesh.position.y = 0.03; // Above roads
    mesh.receiveShadow = true;

    mesh.userData = {
      osmId: element.id,
      type: 'tram',
    };

    return mesh;
  }

  /**
   * Create geometry by buffering a line path
   * Creates a flat ribbon following the path
   */
  private createBufferedLine(
    coords: LocalCoordinate[],
    width: number
  ): THREE.BufferGeometry | null {
    if (coords.length < 2) {
      return null;
    }

    const halfWidth = width / 2;
    const vertices: number[] = [];
    const indices: number[] = [];

    // For each segment, create a quad
    for (let i = 0; i < coords.length - 1; i++) {
      const current = coords[i];
      const next = coords[i + 1];

      if (!current || !next) continue;

      // Direction vector
      const dx = next.x - current.x;
      const dz = next.z - current.z;
      const len = Math.sqrt(dx * dx + dz * dz);

      if (len === 0) continue;

      // Perpendicular vector (normalized)
      const perpX = -dz / len;
      const perpZ = dx / len;

      // Four corners of this segment
      const baseIndex = (vertices.length / 3);

      // Start left
      vertices.push(
        current.x + perpX * halfWidth,
        0,
        current.z + perpZ * halfWidth
      );
      // Start right
      vertices.push(
        current.x - perpX * halfWidth,
        0,
        current.z - perpZ * halfWidth
      );
      // End left
      vertices.push(
        next.x + perpX * halfWidth,
        0,
        next.z + perpZ * halfWidth
      );
      // End right
      vertices.push(
        next.x - perpX * halfWidth,
        0,
        next.z - perpZ * halfWidth
      );

      // Two triangles for the quad
      indices.push(
        baseIndex, baseIndex + 1, baseIndex + 2,
        baseIndex + 1, baseIndex + 3, baseIndex + 2
      );
    }

    if (vertices.length === 0) {
      return null;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(vertices, 3)
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return geometry;
  }

  /**
   * Get the roads group for adding to scene
   */
  public getGroup(): THREE.Group {
    return this.roadsGroup;
  }

  /**
   * Parse road data (for saving/loading preprocessed data)
   */
  public getRoadData(elements: OSMElement[]): RoadData[] {
    const roads: RoadData[] = [];

    for (const element of elements) {
      if (element.type !== 'way' || !element.tags?.['highway'] || !element.geometry) {
        continue;
      }

      const localCoords = element.geometry.map((point) =>
        this.converter.toLocal(point.lat, point.lon)
      );

      const highwayType = element.tags['highway'] ?? 'default';
      const style = ROAD_STYLES[highwayType] ?? ROAD_STYLES['default'];

      roads.push({
        id: element.id.toString(),
        type: highwayType,
        path: localCoords,
        width: style?.width ?? 4,
        color: style?.color ?? 0x666666,
      });
    }

    return roads;
  }
}
