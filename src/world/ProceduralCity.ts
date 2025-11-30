import * as THREE from 'three';
import { City } from 'gen-city';
import type { Building, Path } from 'gen-city';
import { CityCollider, getCityCollider, resetCityCollider } from './collision/CityCollider';
import { getAssetLoader, type BuildingModel } from '../core/AssetLoader';

/**
 * City generation configuration
 */
interface GenCityConfig {
  mapSize: number;           // gen-city grid size (larger = more streets)
  scale: number;             // Conversion from gen-city units to world units
  streetWidth: number;       // Width of streets in world units
  minBuildingHeight: number; // Minimum building height
  maxBuildingHeight: number; // Maximum building height
}

const DEFAULT_CONFIG: GenCityConfig = {
  mapSize: 80,           // Smaller grid for better performance
  scale: 4,              // 1 gen-city unit = 4 world units
  streetWidth: 8,        // Street width
  minBuildingHeight: 8,  // Minimum height
  maxBuildingHeight: 25, // Maximum height for variety
};

/**
 * Building color palettes for variety
 */
const BUILDING_COLORS = [
  0xE8E4E1, // Light gray/beige
  0xD4C4B5, // Warm beige
  0xB8C4CE, // Cool gray-blue
  0xCCD5DB, // Light blue-gray
  0xE0D5C7, // Cream
  0xC9B99A, // Tan
  0xA8B5A0, // Sage green
  0xD9CEC5, // Warm white
  0xBFB5A8, // Taupe
  0xC4C4C4, // Neutral gray
];

/**
 * Accent colors for variety
 */
const ACCENT_COLORS = [
  0x4A90D9, // Blue
  0xE91E63, // Pink
  0x2E7D32, // Green
  0xFF9800, // Orange
  0x9C27B0, // Purple
];

// Cache for building textures to avoid regenerating
const textureCache = new Map<string, THREE.CanvasTexture>();

/**
 * Create a procedural building texture with windows
 */
function createBuildingTexture(
  baseColor: number,
  width: number,
  height: number
): THREE.CanvasTexture {
  const key = `${baseColor}-${Math.round(width)}-${Math.round(height)}`;

  if (textureCache.has(key)) {
    return textureCache.get(key)!;
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  // Texture resolution
  canvas.width = 128;
  canvas.height = 256;

  // Base color
  const r = (baseColor >> 16) & 255;
  const g = (baseColor >> 8) & 255;
  const b = baseColor & 255;
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Window grid
  const windowWidth = 12;
  const windowHeight = 16;
  const windowSpacingX = 24;
  const windowSpacingY = 32;
  const marginX = 12;
  const marginY = 20;

  const cols = Math.floor((canvas.width - marginX * 2) / windowSpacingX);
  const rows = Math.floor((canvas.height - marginY * 2) / windowSpacingY);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = marginX + col * windowSpacingX;
      const y = marginY + row * windowSpacingY;

      // Random lit or dark window
      const isLit = Math.random() > 0.4;
      ctx.fillStyle = isLit ? '#88CCFF' : '#334455';
      ctx.fillRect(x, y, windowWidth, windowHeight);

      // Window frame
      ctx.strokeStyle = '#222222';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, windowWidth, windowHeight);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;

  textureCache.set(key, texture);
  return texture;
}

/**
 * Fully Procedural City Generator using gen-city
 * Creates organic street layouts and building placements
 */
export class ProceduralCity {
  private readonly config: GenCityConfig;
  private readonly cityGroup: THREE.Group;
  private readonly collider: CityCollider;
  private city: City | null = null;
  private spawnPosition: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private useCityPackModels = false;
  private buildingModelPool: BuildingModel[] = [];

  constructor(config: Partial<GenCityConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cityGroup = new THREE.Group();
    this.cityGroup.name = 'procedural_city';

    resetCityCollider();
    this.collider = getCityCollider();

    // Check if CityPack models are available
    const assetLoader = getAssetLoader();
    if (assetLoader.hasCityPackAssets()) {
      this.useCityPackModels = true;
      this.buildingModelPool = assetLoader.getAllBuildingModels();
      console.log(`[GenCity] Using ${this.buildingModelPool.length} CityPack building models`);
    }
  }

  /**
   * Generate the entire city using gen-city
   */
  public async generate(
    onProgress?: (progress: number, status: string) => void
  ): Promise<THREE.Group> {
    console.log('[GenCity] Starting procedural city generation...');

    onProgress?.(5, 'Initializing city generator...');

    // Create gen-city instance
    this.city = new City({
      width: this.config.mapSize,
      height: this.config.mapSize,
    });

    onProgress?.(10, 'Generating street layout...');

    // Generate the city with parameters for realistic urban layout
    await this.city.generate({
      streetMinLength: 6,           // Medium street length
      probabilityIntersection: 0.15,// Moderate intersections
      probabilityTurn: 0.08,        // Some turns
      probabilityStreetEnd: 0.003,  // Few dead ends
      buildingMinSize: 3,           // Minimum building footprint
      buildingMaxSize: 7,           // Maximum building footprint
      buildingMinSpace: 1,          // Small gap between buildings
      buildingMaxSpace: 2,          // Maximum gap
      buildingOffset: 1,            // Setback from street
    });

    onProgress?.(25, 'Creating ground...');
    this.createGround();

    onProgress?.(35, 'Rendering streets...');
    await this.renderStreets(onProgress);

    onProgress?.(55, 'Placing buildings...');
    await this.renderBuildings(onProgress);

    onProgress?.(80, 'Adding street furniture...');
    this.addStreetFurniture();

    onProgress?.(90, 'Creating boundary...');
    this.createBoundary();

    onProgress?.(95, 'Registering collisions...');
    this.registerAllCollisions();

    onProgress?.(100, 'City complete!');

    const buildings = this.city.getAllBuildings();
    const paths = this.city.getAllPaths();
    console.log(`[GenCity] Generated ${buildings.length} buildings, ${paths.length} street segments`);

    return this.cityGroup;
  }

  /**
   * Convert gen-city position to world position
   */
  private toWorldPosition(x: number, y: number): THREE.Vector2 {
    const { mapSize, scale } = this.config;
    return new THREE.Vector2(
      (x - mapSize / 2) * scale,
      (y - mapSize / 2) * scale
    );
  }

  /**
   * Get world size
   */
  private getWorldSize(): number {
    return this.config.mapSize * this.config.scale;
  }

  /**
   * Create ground plane
   */
  private createGround(): void {
    const worldSize = this.getWorldSize();
    const groundSize = worldSize + 100;

    // Grass base
    const grassGeo = new THREE.PlaneGeometry(groundSize, groundSize);
    const grassMat = new THREE.MeshLambertMaterial({ color: 0x4a7c3f });
    const grass = new THREE.Mesh(grassGeo, grassMat);
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = -0.05;
    grass.receiveShadow = true;
    this.cityGroup.add(grass);
  }

  /**
   * Render all streets from gen-city paths
   */
  private async renderStreets(
    onProgress?: (progress: number, status: string) => void
  ): Promise<void> {
    if (!this.city) return;

    const paths = this.city.getAllPaths();
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
    const sidewalkMat = new THREE.MeshLambertMaterial({ color: 0x999999 });

    let processed = 0;
    const total = paths.length;

    for (const path of paths) {
      this.renderPath(path, roadMat, lineMat, sidewalkMat);

      processed++;
      if (processed % 20 === 0) {
        const progress = 35 + (processed / total) * 20;
        onProgress?.(Math.min(progress, 55), `Rendering streets... (${processed}/${total})`);
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    // Render intersections
    const nodes = this.city.getAllNodes();
    for (const node of nodes) {
      this.renderIntersection(node.position.x, node.position.y, roadMat, sidewalkMat);
    }
  }

  /**
   * Render a single street path
   */
  private renderPath(
    path: Path,
    roadMat: THREE.Material,
    lineMat: THREE.Material,
    sidewalkMat: THREE.Material
  ): void {
    const positions = path.getPositions();
    const start = this.toWorldPosition(positions.beg.x, positions.beg.y);
    const end = this.toWorldPosition(positions.end.x, positions.end.y);

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    const centerX = (start.x + end.x) / 2;
    const centerY = (start.y + end.y) / 2;

    const { streetWidth } = this.config;

    // Road surface
    const roadGeo = new THREE.PlaneGeometry(length, streetWidth);
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.rotation.z = -angle;
    road.position.set(centerX, 0.01, centerY);
    road.receiveShadow = true;
    this.cityGroup.add(road);

    // Center line (dashed)
    const dashLength = 2;
    const gapLength = 1.5;
    const numDashes = Math.floor(length / (dashLength + gapLength));

    for (let i = 0; i < numDashes; i++) {
      const t = (i * (dashLength + gapLength) + dashLength / 2) / length;
      const dashX = start.x + dx * t;
      const dashY = start.y + dy * t;

      const dashGeo = new THREE.PlaneGeometry(dashLength, 0.15);
      const dash = new THREE.Mesh(dashGeo, lineMat);
      dash.rotation.x = -Math.PI / 2;
      dash.rotation.z = -angle;
      dash.position.set(dashX, 0.02, dashY);
      this.cityGroup.add(dash);
    }

    // Sidewalks on both sides
    const sidewalkWidth = 2;
    const perpX = -Math.sin(angle);
    const perpY = Math.cos(angle);
    const sidewalkOffset = streetWidth / 2 + sidewalkWidth / 2;

    for (const side of [-1, 1]) {
      const sidewalkGeo = new THREE.PlaneGeometry(length, sidewalkWidth);
      const sidewalk = new THREE.Mesh(sidewalkGeo, sidewalkMat);
      sidewalk.rotation.x = -Math.PI / 2;
      sidewalk.rotation.z = -angle;
      sidewalk.position.set(
        centerX + perpX * sidewalkOffset * side,
        0.03,
        centerY + perpY * sidewalkOffset * side
      );
      sidewalk.receiveShadow = true;
      this.cityGroup.add(sidewalk);
    }
  }

  /**
   * Render intersection
   */
  private renderIntersection(
    x: number,
    y: number,
    roadMat: THREE.Material,
    sidewalkMat: THREE.Material
  ): void {
    const pos = this.toWorldPosition(x, y);
    const { streetWidth } = this.config;

    // Intersection square
    const intersectionGeo = new THREE.PlaneGeometry(streetWidth + 4, streetWidth + 4);
    const intersection = new THREE.Mesh(intersectionGeo, roadMat);
    intersection.rotation.x = -Math.PI / 2;
    intersection.position.set(pos.x, 0.015, pos.y);
    intersection.receiveShadow = true;
    this.cityGroup.add(intersection);

    // Corner sidewalk pieces
    const cornerSize = 3;
    const cornerOffset = streetWidth / 2 + cornerSize / 2 + 1;

    const corners = [
      { x: cornerOffset, y: cornerOffset },
      { x: -cornerOffset, y: cornerOffset },
      { x: cornerOffset, y: -cornerOffset },
      { x: -cornerOffset, y: -cornerOffset },
    ];

    for (const corner of corners) {
      const cornerGeo = new THREE.PlaneGeometry(cornerSize, cornerSize);
      const cornerMesh = new THREE.Mesh(cornerGeo, sidewalkMat);
      cornerMesh.rotation.x = -Math.PI / 2;
      cornerMesh.position.set(pos.x + corner.x, 0.035, pos.y + corner.y);
      this.cityGroup.add(cornerMesh);
    }
  }

  /**
   * Render all buildings from gen-city
   */
  private async renderBuildings(
    onProgress?: (progress: number, status: string) => void
  ): Promise<void> {
    if (!this.city) return;

    const buildings = this.city.getAllBuildings();
    let processed = 0;
    const total = buildings.length;

    // Track center for spawn position
    let centerX = 0;
    let centerZ = 0;

    for (const building of buildings) {
      const mesh = this.createBuildingMesh(building);
      if (mesh) {
        this.cityGroup.add(mesh);
        centerX += mesh.position.x;
        centerZ += mesh.position.z;
      }

      processed++;
      if (processed % 30 === 0) {
        const progress = 55 + (processed / total) * 25;
        onProgress?.(Math.min(progress, 80), `Placing buildings... (${processed}/${total})`);
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    // Calculate spawn position near center
    if (buildings.length > 0) {
      centerX /= buildings.length;
      centerZ /= buildings.length;
      this.spawnPosition.set(centerX, 0, centerZ + 20);
    }
  }

  /**
   * Create a 3D mesh for a building
   */
  private createBuildingMesh(building: Building): THREE.Group | null {
    const vertices = building.vertices;
    if (vertices.length < 3) return null;

    const { minBuildingHeight, maxBuildingHeight } = this.config;

    // Calculate building center and size
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const v of vertices) {
      const worldPos = this.toWorldPosition(v.x, v.y);
      minX = Math.min(minX, worldPos.x);
      maxX = Math.max(maxX, worldPos.x);
      minY = Math.min(minY, worldPos.y);
      maxY = Math.max(maxY, worldPos.y);
    }

    const width = maxX - minX;
    const depth = maxY - minY;
    const centerX = (minX + maxX) / 2;
    const centerZ = (minY + maxY) / 2;

    // Skip very small buildings
    if (width < 5 || depth < 5) return null;

    // Random height based on building size
    const sizeBonus = Math.min(width, depth) / 10;
    const targetHeight = minBuildingHeight + Math.random() * (maxBuildingHeight - minBuildingHeight) * (0.5 + sizeBonus * 0.5);

    // Try to use CityPack 3D model if available
    if (this.useCityPackModels && this.buildingModelPool.length > 0) {
      return this.createBuildingFrom3DModel(centerX, centerZ, width, depth, targetHeight);
    }

    // Fallback to procedural box buildings
    return this.createProceduralBuilding(centerX, centerZ, width, depth, targetHeight);
  }

  /**
   * Create a building using a 3D model from CityPack
   */
  private createBuildingFrom3DModel(
    centerX: number,
    centerZ: number,
    targetWidth: number,
    targetDepth: number,
    targetHeight: number
  ): THREE.Group | null {
    // Pick a random model from the pool
    const modelIndex = Math.floor(Math.random() * this.buildingModelPool.length);
    const model = this.buildingModelPool[modelIndex];
    if (!model) return null;

    const group = new THREE.Group();

    // Clone the model mesh
    const buildingMesh = model.mesh.clone();

    // Model should already be centered at origin with bottom at y=0 from extraction
    // Just reset scale
    buildingMesh.scale.set(1, 1, 1);

    // CityPack models are quite large (20-50 units), scale down to fit gen-city footprints
    // Target footprint from gen-city is typically 5-20 units
    const modelMaxDim = Math.max(model.width, model.depth);
    const targetFootprint = Math.min(targetWidth, targetDepth);

    // Calculate scale to fit the target footprint
    const baseScale = targetFootprint / Math.max(modelMaxDim, 1);

    // Apply a reduction factor since CityPack models are designed for larger scenes
    // Clamp to reasonable range (0.1x to 0.6x) to keep buildings appropriately sized
    const clampedScale = Math.max(0.1, Math.min(baseScale * 0.5, 0.6));

    // Height scale - match proportionally but keep reasonable
    const heightScale = (targetHeight / Math.max(model.height, 1)) * 0.5;
    const clampedHeightScale = Math.max(0.15, Math.min(heightScale, 0.8));

    buildingMesh.scale.set(clampedScale, clampedHeightScale, clampedScale);

    console.log(`[GenCity] Building ${model.name}: model(${model.width.toFixed(1)}x${model.height.toFixed(1)}x${model.depth.toFixed(1)}) -> target(${targetWidth.toFixed(1)}x${targetHeight.toFixed(1)}x${targetDepth.toFixed(1)}) scale(${clampedScale.toFixed(2)}, ${clampedHeightScale.toFixed(2)})`);

    // Position at the target location
    buildingMesh.position.set(centerX, 0, centerZ);

    // Random rotation (0, 90, 180, or 270 degrees)
    buildingMesh.rotation.y = (Math.floor(Math.random() * 4) * Math.PI) / 2;

    // Mark as collidable
    buildingMesh.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        obj.userData.collidable = true;
        obj.userData.colliderType = 'box';
      }
    });

    group.add(buildingMesh);
    return group;
  }

  /**
   * Create a procedural box building (fallback)
   */
  private createProceduralBuilding(
    centerX: number,
    centerZ: number,
    width: number,
    depth: number,
    height: number
  ): THREE.Group {
    const group = new THREE.Group();

    // Pick random colors
    const mainColor = BUILDING_COLORS[Math.floor(Math.random() * BUILDING_COLORS.length)]!;
    const hasAccent = Math.random() > 0.7;
    const accentColor = ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)]!;

    // Main building body with window texture
    const buildingGeo = new THREE.BoxGeometry(width * 0.9, height, depth * 0.9);
    const texture = createBuildingTexture(mainColor, width, height);

    // Calculate texture repeat based on building size
    const repeatX = Math.max(1, Math.round(width / 8));
    const repeatY = Math.max(1, Math.round(height / 10));
    texture.repeat.set(repeatX, repeatY);

    const buildingMat = new THREE.MeshLambertMaterial({ map: texture });
    const buildingMesh = new THREE.Mesh(buildingGeo, buildingMat);
    buildingMesh.position.set(centerX, height / 2, centerZ);
    buildingMesh.castShadow = true;
    buildingMesh.receiveShadow = true;
    buildingMesh.userData.collidable = true;
    buildingMesh.userData.colliderType = 'box';
    group.add(buildingMesh);

    // Simple roof for tall buildings only (performance)
    if (height > 18 && Math.random() > 0.7) {
      const roofGeo = new THREE.BoxGeometry(width * 0.3, 2, depth * 0.3);
      const roofMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.set(centerX, height + 1, centerZ);
      group.add(roof);
    }

    // Ground floor accent for some buildings
    if (hasAccent) {
      const accentGeo = new THREE.BoxGeometry(width * 0.92, 2.5, depth * 0.92);
      const accentMat = new THREE.MeshLambertMaterial({ color: accentColor });
      const accent = new THREE.Mesh(accentGeo, accentMat);
      accent.position.set(centerX, 1.25, centerZ);
      group.add(accent);
    }

    return group;
  }


  /**
   * Add street furniture (lampposts) - minimal for performance
   */
  private addStreetFurniture(): void {
    if (!this.city) return;

    const nodes = this.city.getAllNodes();
    const lampMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xFFFFAA });

    // Only add lampposts at every 4th intersection
    let count = 0;
    for (const node of nodes) {
      count++;
      if (count % 4 !== 0) continue;

      const pos = this.toWorldPosition(node.position.x, node.position.y);
      const lamp = this.createLamppost(lampMat, lightMat);
      lamp.position.set(pos.x + 5, 0, pos.y + 5);
      this.cityGroup.add(lamp);
    }
  }

  /**
   * Create a simple lamppost (no point light for performance)
   */
  private createLamppost(poleMat: THREE.Material, lightMat: THREE.Material): THREE.Group {
    const group = new THREE.Group();

    // Pole - low poly
    const poleGeo = new THREE.CylinderGeometry(0.1, 0.15, 5, 6);
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 2.5;
    group.add(pole);

    // Light fixture - just visual, no actual light
    const fixtureGeo = new THREE.SphereGeometry(0.3, 6, 4);
    const fixture = new THREE.Mesh(fixtureGeo, lightMat);
    fixture.position.y = 5;
    group.add(fixture);

    return group;
  }

  /**
   * Create city boundary walls
   */
  private createBoundary(): void {
    const worldSize = this.getWorldSize();
    const boundaryOffset = worldSize / 2 + 20;
    const wallHeight = 10;
    const wallThickness = 2;

    const wallMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0,
    });

    const walls = [
      { x: 0, z: -boundaryOffset, w: worldSize + 50, h: wallThickness },
      { x: 0, z: boundaryOffset, w: worldSize + 50, h: wallThickness },
      { x: -boundaryOffset, z: 0, w: wallThickness, h: worldSize + 50 },
      { x: boundaryOffset, z: 0, w: wallThickness, h: worldSize + 50 },
    ];

    for (const wall of walls) {
      const geo = new THREE.BoxGeometry(wall.w, wallHeight, wall.h);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(wall.x, wallHeight / 2, wall.z);
      this.cityGroup.add(mesh);
      this.collider.registerBox(mesh);
    }
  }

  /**
   * Register all building collisions
   */
  private registerAllCollisions(): void {
    this.cityGroup.updateMatrixWorld(true);

    this.cityGroup.traverse((obj) => {
      if (obj.userData.collidable && obj.userData.colliderType === 'box') {
        const worldBox = new THREE.Box3().setFromObject(obj);
        this.collider.registerBox(obj, worldBox);
      }
    });

    console.log(`[GenCity] Registered ${this.collider.getColliders().length} colliders`);
  }

  /**
   * Get spawn position (calculated during generation)
   */
  public getSpawnPosition(): THREE.Vector3 {
    return this.spawnPosition.clone();
  }

  /**
   * Get the collision system
   */
  public getCollider(): CityCollider {
    return this.collider;
  }

  /**
   * Get city bounds
   */
  public getBounds(): THREE.Box3 {
    return this.collider.getBounds();
  }

  /**
   * Road segment data for traffic system
   */
  public getRoadNetwork(): RoadNetworkData {
    if (!this.city) {
      return { segments: [], intersections: [] };
    }

    const segments: RoadSegment[] = [];
    const intersections: RoadIntersection[] = [];

    // Convert all paths to road segments in world coordinates
    const paths = this.city.getAllPaths();
    for (const path of paths) {
      const positions = path.getPositions();
      const start = this.toWorldPosition(positions.beg.x, positions.beg.y);
      const end = this.toWorldPosition(positions.end.x, positions.end.y);

      segments.push({
        start: new THREE.Vector3(start.x, 0, start.y),
        end: new THREE.Vector3(end.x, 0, end.y),
        width: this.config.streetWidth,
      });
    }

    // Convert all nodes to intersections
    const nodes = this.city.getAllNodes();
    for (const node of nodes) {
      const pos = this.toWorldPosition(node.position.x, node.position.y);
      intersections.push({
        position: new THREE.Vector3(pos.x, 0, pos.y),
        connectionCount: node.getOutputPaths().length + node.getInputPaths().length,
      });
    }

    return { segments, intersections };
  }

  /**
   * Get the config for external use
   */
  public getConfig(): GenCityConfig {
    return { ...this.config };
  }
}

/**
 * Road segment for traffic system
 */
export interface RoadSegment {
  start: THREE.Vector3;
  end: THREE.Vector3;
  width: number;
}

/**
 * Intersection node for traffic system
 */
export interface RoadIntersection {
  position: THREE.Vector3;
  connectionCount: number;
}

/**
 * Complete road network data
 */
export interface RoadNetworkData {
  segments: RoadSegment[];
  intersections: RoadIntersection[];
}
