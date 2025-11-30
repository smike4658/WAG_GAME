import * as THREE from 'three';
import type { BuildingData, OSMElement, LocalCoordinate } from './types';
import { CoordinateConverter } from './CoordinateConverter';

/**
 * Color palette for different building types (warm, low-poly style)
 */
const BUILDING_COLORS: Record<string, number> = {
  cathedral: 0xd4a574,    // Warm stone
  church: 0xc9b896,       // Light stone
  chapel: 0xc9b896,       // Light stone
  civic: 0xe8d4b8,        // Cream
  public: 0xe8d4b8,       // Cream
  commercial: 0x7fb3d5,   // Light blue
  retail: 0xaed6f1,       // Sky blue
  office: 0x85c1e9,       // Corporate blue
  apartments: 0xf5b7b1,   // Soft pink
  residential: 0xfad7a0,  // Warm yellow
  house: 0xfad7a0,        // Warm yellow
  hotel: 0xd7bde2,        // Soft purple
  industrial: 0xaeb6bf,   // Gray
  warehouse: 0x99a3a4,    // Dark gray
  school: 0xf9e79f,       // Yellow
  university: 0xf4d03f,   // Bright yellow
  hospital: 0xfadbd8,     // Light pink
  default: 0xe5e7e9,      // Light gray
};

/**
 * Random colors for generic "yes" buildings (Central European palette)
 */
const GENERIC_BUILDING_COLORS: number[] = [
  0xe8d4b8,  // Cream
  0xdec4a8,  // Beige
  0xf5e6d3,  // Light cream
  0xd4c4a8,  // Tan
  0xc9b896,  // Stone
  0xe0cdb8,  // Warm gray
  0xf0e0c8,  // Ivory
  0xd8c8b0,  // Sand
  0xfad7a0,  // Warm yellow
  0xf5cba7,  // Peach
  0xf8e8d8,  // Off-white
  0xd5c4b0,  // Khaki
];

/**
 * Landmark buildings in Ostrava with special treatment
 */
const LANDMARKS: Record<string, { height: number; name: string }> = {
  // Cathedral of Divine Savior - the dominant landmark
  '49.8358_18.2890': { height: 50, name: 'Cathedral of Divine Savior' },
  // Church of St. Wenceslas
  '49.8358_18.2948': { height: 30, name: 'Church of St. Wenceslas' },
};

/**
 * Converts OSM building data to 3D Three.js meshes
 */
export class BuildingExtruder {
  private readonly converter: CoordinateConverter;
  private readonly buildingsGroup: THREE.Group;

  constructor() {
    this.converter = new CoordinateConverter();
    this.buildingsGroup = new THREE.Group();
    this.buildingsGroup.name = 'buildings';
  }

  /**
   * Process all OSM elements and create building meshes
   */
  public processElements(elements: OSMElement[]): THREE.Group {
    const buildings = elements.filter(
      (el) => el.type === 'way' && el.tags?.['building'] && el.geometry
    );

    console.log(`[BuildingExtruder] Processing ${buildings.length} buildings`);

    let successCount = 0;
    let failCount = 0;

    for (const building of buildings) {
      try {
        const mesh = this.createBuildingMesh(building);
        if (mesh) {
          this.buildingsGroup.add(mesh);
          successCount++;
        }
      } catch (error) {
        failCount++;
        console.warn(`[BuildingExtruder] Failed to create building ${building.id}:`, error);
      }
    }

    console.log(`[BuildingExtruder] Created ${successCount} buildings, ${failCount} failed`);
    return this.buildingsGroup;
  }

  /**
   * Create a single building mesh from OSM element
   */
  private createBuildingMesh(element: OSMElement): THREE.Mesh | null {
    const geometry = element.geometry;
    if (!geometry || geometry.length < 3) {
      return null;
    }

    // Convert coordinates to local
    const localCoords: LocalCoordinate[] = geometry.map((point) =>
      this.converter.toLocal(point.lat, point.lon)
    );

    // Create shape from footprint
    const shape = this.createShape(localCoords);
    if (!shape) {
      return null;
    }

    // Calculate height
    const height = this.calculateHeight(element);

    // Create extruded geometry
    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      steps: 1,
      depth: height,
      bevelEnabled: false,
    };

    const extrudedGeometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

    // Rotate to stand upright (extrude goes along Z, we need Y)
    extrudedGeometry.rotateX(-Math.PI / 2);

    // Get building color
    const color = this.getBuildingColor(element);
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.8,
      metalness: 0.1,
      flatShading: true, // Low-poly look
    });

    const mesh = new THREE.Mesh(extrudedGeometry, material);

    // Set position (geometry is already in local coords, just need to set Y)
    mesh.position.y = 0;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Store metadata
    mesh.userData = {
      osmId: element.id,
      buildingType: element.tags?.['building'],
      name: element.tags?.['name'],
      height,
    };

    return mesh;
  }

  /**
   * Create a Three.js Shape from polygon coordinates
   */
  private createShape(coords: LocalCoordinate[]): THREE.Shape | null {
    if (coords.length < 3) {
      return null;
    }

    const shape = new THREE.Shape();
    const first = coords[0];
    if (!first) return null;

    shape.moveTo(first.x, first.z);

    for (let i = 1; i < coords.length; i++) {
      const point = coords[i];
      if (point) {
        shape.lineTo(point.x, point.z);
      }
    }

    // Close the shape
    shape.lineTo(first.x, first.z);

    return shape;
  }

  /**
   * Calculate building height from OSM tags or heuristics
   */
  private calculateHeight(element: OSMElement): number {
    const tags = element.tags ?? {};

    // Check for landmark override first
    if (element.geometry && element.geometry.length > 0) {
      const firstPoint = element.geometry[0];
      if (firstPoint) {
        const key = `${firstPoint.lat.toFixed(4)}_${firstPoint.lon.toFixed(4)}`;
        const landmark = LANDMARKS[key];
        if (landmark) {
          return landmark.height;
        }
      }
    }

    // Explicit height tag
    const heightStr = tags['height'];
    if (heightStr) {
      const height = parseFloat(heightStr);
      if (!isNaN(height)) {
        return height;
      }
    }

    // Building levels
    const levelsStr = tags['building:levels'];
    if (levelsStr) {
      const levels = parseInt(levelsStr, 10);
      if (!isNaN(levels)) {
        return levels * 3.5; // ~3.5m per floor
      }
    }

    // Building type heuristics
    const buildingType = tags['building']?.toLowerCase() ?? 'default';

    switch (buildingType) {
      case 'cathedral':
        return 50;
      case 'church':
      case 'chapel':
        return 30;
      case 'apartments':
        return 15 + Math.random() * 10; // 15-25m
      case 'commercial':
      case 'office':
        return 10 + Math.random() * 5; // 10-15m
      case 'house':
      case 'residential':
        return 8 + Math.random() * 4; // 8-12m
      case 'industrial':
      case 'warehouse':
        return 8 + Math.random() * 4;
      case 'retail':
        return 5 + Math.random() * 3;
      default:
        return 6 + Math.random() * 9; // 6-15m for unknown
    }
  }

  /**
   * Get building color based on type
   */
  private getBuildingColor(element: OSMElement): number {
    const tags = element.tags ?? {};
    const buildingType = tags['building']?.toLowerCase() ?? 'default';

    // Check for specific building type
    const specificColor = BUILDING_COLORS[buildingType];
    if (specificColor !== undefined) {
      return specificColor;
    }

    // For generic "yes" buildings, pick from the palette based on OSM ID
    // This ensures consistent colors across page reloads
    if (buildingType === 'yes' || buildingType === 'default') {
      const seed = element.id % GENERIC_BUILDING_COLORS.length;
      return GENERIC_BUILDING_COLORS[seed] ?? 0xe5e7e9;
    }

    // Fallback for unknown types
    return BUILDING_COLORS['default'] ?? 0xe5e7e9;
  }

  /**
   * Get the buildings group for adding to scene
   */
  public getGroup(): THREE.Group {
    return this.buildingsGroup;
  }

  /**
   * Parse building data (for saving/loading preprocessed data)
   */
  public getBuildingData(elements: OSMElement[]): BuildingData[] {
    const buildings: BuildingData[] = [];

    for (const element of elements) {
      if (element.type !== 'way' || !element.tags?.['building'] || !element.geometry) {
        continue;
      }

      const localCoords = element.geometry.map((point) =>
        this.converter.toLocal(point.lat, point.lon)
      );

      const buildingType = element.tags['building']?.toLowerCase() ?? 'default';
      const height = this.calculateHeight(element);

      // Check if landmark
      let isLandmark = false;
      let landmarkName: string | undefined;

      if (element.geometry.length > 0) {
        const firstPoint = element.geometry[0];
        if (firstPoint) {
          const key = `${firstPoint.lat.toFixed(4)}_${firstPoint.lon.toFixed(4)}`;
          const landmark = LANDMARKS[key];
          if (landmark) {
            isLandmark = true;
            landmarkName = landmark.name;
          }
        }
      }

      const buildingName = landmarkName ?? element.tags['name'];
      const buildingData: BuildingData = {
        id: element.id.toString(),
        type: buildingType,
        footprint: localCoords,
        height,
        color: BUILDING_COLORS[buildingType] ?? BUILDING_COLORS['default'] ?? 0xe5e7e9,
        isLandmark,
      };

      if (buildingName) {
        buildingData.name = buildingName;
      }

      buildings.push(buildingData);
    }

    return buildings;
  }
}
