import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CityCollider, getCityCollider, resetCityCollider } from './collision/CityCollider';

/**
 * Tile types for the city grid
 */
enum TileType {
  EMPTY = 0,
  ROAD_STRAIGHT = 1,
  ROAD_TURN = 2,
  ROAD_INTERSECTION = 3,
  BUILDING = 4,
}

/**
 * Configuration for tile-based city
 */
interface TileBasedCityConfig {
  gridSize: number;        // Number of tiles in each direction
  tileSize: number;        // Size of each tile in world units
  roadDensity: number;     // 0-1, how many roads
  buildingDensity: number; // 0-1, how full to pack buildings
  carCount: number;        // Number of cars to spawn
}

const DEFAULT_CONFIG: TileBasedCityConfig = {
  gridSize: 12,           // 12x12 grid
  tileSize: 20,           // Each tile is 20 units
  roadDensity: 0.4,       // 40% roads
  buildingDensity: 0.7,   // 70% of empty tiles get buildings
  carCount: 15,           // 15 cars
};

/**
 * Extracted asset from GLB
 */
interface ExtractedAsset {
  name: string;
  mesh: THREE.Object3D;
  boundingBox: THREE.Box3;
  size: THREE.Vector3;
}

/**
 * Road segment for traffic
 */
interface RoadSegment {
  start: THREE.Vector3;
  end: THREE.Vector3;
  direction: THREE.Vector3;
}

/**
 * TileBasedCity - Creates a city using extracted Cartoon City assets
 * arranged in a simple grid pattern
 */
export class TileBasedCity {
  private readonly config: TileBasedCityConfig;
  private readonly cityGroup: THREE.Group;
  private readonly collider: CityCollider;
  private readonly loader: GLTFLoader;

  // Extracted assets
  private buildings: ExtractedAsset[] = [];
  private cars: ExtractedAsset[] = [];
  private roads: ExtractedAsset[] = [];
  private props: ExtractedAsset[] = [];

  // City data
  private grid: TileType[][] = [];
  private roadSegments: RoadSegment[] = [];
  private spawnPosition: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

  // Spawned vehicles for animation
  private spawnedCars: THREE.Object3D[] = [];

  constructor(config: Partial<TileBasedCityConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cityGroup = new THREE.Group();
    this.cityGroup.name = 'tile_based_city';
    this.loader = new GLTFLoader();

    resetCityCollider();
    this.collider = getCityCollider();
  }

  /**
   * Generate the city
   */
  public async generate(
    onProgress?: (progress: number, status: string) => void
  ): Promise<THREE.Group> {
    console.log('[TileCity] Starting tile-based city generation...');

    onProgress?.(5, 'Loading Cartoon City assets...');
    await this.loadCartoonCityAssets();

    onProgress?.(20, 'Creating ground...');
    this.createGround();

    onProgress?.(25, 'Generating road grid...');
    this.generateGrid();

    onProgress?.(40, 'Placing roads...');
    await this.placeRoads(onProgress);

    onProgress?.(60, 'Placing buildings...');
    await this.placeBuildings(onProgress);

    onProgress?.(80, 'Adding vehicles...');
    this.placeVehicles();

    onProgress?.(90, 'Adding props...');
    this.placeProps();

    onProgress?.(95, 'Registering collisions...');
    this.registerCollisions();

    onProgress?.(100, 'City complete!');

    console.log(`[TileCity] Generated city with ${this.buildings.length} building types, ${this.cars.length} car types`);

    return this.cityGroup;
  }

  /**
   * Load and extract assets from Cartoon City GLB
   */
  private async loadCartoonCityAssets(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.loader.load(
        '/cartoon-city/city.glb',
        (gltf: GLTF) => {
          console.log('[TileCity] Cartoon City GLB loaded');
          this.extractAssets(gltf.scene);
          resolve();
        },
        (progress) => {
          if (progress.total > 0) {
            const percent = (progress.loaded / progress.total) * 100;
            console.log(`[TileCity] Loading GLB: ${percent.toFixed(1)}%`);
          }
        },
        (error) => reject(error)
      );
    });
  }

  /**
   * Extract individual assets from the loaded GLB
   */
  private extractAssets(scene: THREE.Group): void {
    const processed = new Set<string>();

    scene.traverse((child) => {
      const name = child.name;
      if (!name || processed.has(name)) return;

      // Skip wheel and detail children
      if (/_Wheel_|_Spoiler|_NightLight/i.test(name)) return;

      // Categorize by name pattern
      if (/^(Regular_Building|Eco_Building|Modular_Building)/i.test(name)) {
        this.extractAsset(child, this.buildings, name);
        processed.add(name);
      } else if (/^(Car_\d+|Van|Futuristic_Car)/i.test(name)) {
        this.extractAsset(child, this.cars, name);
        processed.add(name);
      } else if (/^road_/i.test(name)) {
        this.extractAsset(child, this.roads, name);
        processed.add(name);
      } else if (/^(Bush_|Palm_|Fountain_|Billboard_|Signboard_|traffic_light)/i.test(name)) {
        this.extractAsset(child, this.props, name);
        processed.add(name);
      }
    });

    console.log(`[TileCity] Extracted: ${this.buildings.length} buildings, ${this.cars.length} cars, ${this.roads.length} roads, ${this.props.length} props`);
  }

  /**
   * Extract a single asset
   */
  private extractAsset(obj: THREE.Object3D, targetArray: ExtractedAsset[], name: string): void {
    // Clone the object
    const cloned = obj.clone();

    // Calculate bounding box
    const box = new THREE.Box3().setFromObject(cloned);
    const size = box.getSize(new THREE.Vector3());

    // Center the object at origin
    const center = box.getCenter(new THREE.Vector3());
    cloned.position.sub(center);
    cloned.position.y += size.y / 2; // Place bottom at y=0

    targetArray.push({
      name,
      mesh: cloned,
      boundingBox: box,
      size,
    });

    console.log(`[TileCity] Extracted: ${name} (${size.x.toFixed(1)} x ${size.y.toFixed(1)} x ${size.z.toFixed(1)})`);
  }

  /**
   * Create ground plane
   */
  private createGround(): void {
    const { gridSize, tileSize } = this.config;
    const worldSize = gridSize * tileSize + 100;

    // Grass base
    const grassGeo = new THREE.PlaneGeometry(worldSize, worldSize);
    const grassMat = new THREE.MeshLambertMaterial({ color: 0x4a7c3f });
    const grass = new THREE.Mesh(grassGeo, grassMat);
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = -0.05;
    grass.receiveShadow = true;
    this.cityGroup.add(grass);
  }

  /**
   * Generate the tile grid with roads
   */
  private generateGrid(): void {
    const { gridSize, roadDensity } = this.config;

    // Initialize empty grid
    this.grid = Array(gridSize).fill(null).map(() =>
      Array(gridSize).fill(TileType.EMPTY)
    );

    // Create main roads (horizontal and vertical through center)
    const centerX = Math.floor(gridSize / 2);
    const centerY = Math.floor(gridSize / 2);

    // Main horizontal road
    for (let x = 0; x < gridSize; x++) {
      const row = this.grid[centerY];
      if (row) row[x] = TileType.ROAD_STRAIGHT;
    }

    // Main vertical road
    for (let y = 0; y < gridSize; y++) {
      const row = this.grid[y];
      if (row) row[centerX] = TileType.ROAD_STRAIGHT;
    }

    // Center intersection
    const centerRow = this.grid[centerY];
    if (centerRow) centerRow[centerX] = TileType.ROAD_INTERSECTION;

    // Add secondary roads based on density
    const numSecondaryRoads = Math.floor(gridSize * roadDensity);

    for (let i = 0; i < numSecondaryRoads; i++) {
      const isHorizontal = Math.random() > 0.5;
      const pos = Math.floor(Math.random() * gridSize);

      if (pos === centerX || pos === centerY) continue; // Skip main roads

      if (isHorizontal) {
        // Horizontal road
        const row = this.grid[pos];
        if (!row) continue;
        for (let x = 0; x < gridSize; x++) {
          if (row[x] === TileType.ROAD_STRAIGHT) {
            row[x] = TileType.ROAD_INTERSECTION;
          } else if (row[x] === TileType.EMPTY) {
            row[x] = TileType.ROAD_STRAIGHT;
          }
        }
      } else {
        // Vertical road
        for (let y = 0; y < gridSize; y++) {
          const row = this.grid[y];
          if (!row) continue;
          if (row[pos] === TileType.ROAD_STRAIGHT) {
            row[pos] = TileType.ROAD_INTERSECTION;
          } else if (row[pos] === TileType.EMPTY) {
            row[pos] = TileType.ROAD_STRAIGHT;
          }
        }
      }
    }

    // Mark remaining empty tiles that should have buildings
    for (let y = 0; y < gridSize; y++) {
      const row = this.grid[y];
      if (!row) continue;
      for (let x = 0; x < gridSize; x++) {
        if (row[x] === TileType.EMPTY && Math.random() < this.config.buildingDensity) {
          row[x] = TileType.BUILDING;
        }
      }
    }

    // Set spawn position at center
    this.spawnPosition.set(0, 0, 0);
  }

  /**
   * Convert grid coordinates to world position
   */
  private gridToWorld(gridX: number, gridY: number): THREE.Vector3 {
    const { gridSize, tileSize } = this.config;
    const halfSize = (gridSize * tileSize) / 2;
    return new THREE.Vector3(
      gridX * tileSize - halfSize + tileSize / 2,
      0,
      gridY * tileSize - halfSize + tileSize / 2
    );
  }

  /**
   * Place roads on the grid
   */
  private async placeRoads(onProgress?: (progress: number, status: string) => void): Promise<void> {
    const { gridSize, tileSize } = this.config;

    // Create road material (dark asphalt)
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });

    let roadsPlaced = 0;
    const totalRoads = this.grid.flat().filter(t => t === TileType.ROAD_STRAIGHT || t === TileType.ROAD_INTERSECTION).length;

    for (let y = 0; y < gridSize; y++) {
      const row = this.grid[y];
      if (!row) continue;
      for (let x = 0; x < gridSize; x++) {
        const tile = row[x];
        if (tile !== TileType.ROAD_STRAIGHT && tile !== TileType.ROAD_INTERSECTION) continue;

        const worldPos = this.gridToWorld(x, y);

        // Determine road direction
        const northRow = this.grid[y-1];
        const southRow = this.grid[y+1];
        const hasNorth = y > 0 && northRow && (northRow[x] === TileType.ROAD_STRAIGHT || northRow[x] === TileType.ROAD_INTERSECTION);
        const hasSouth = y < gridSize-1 && southRow && (southRow[x] === TileType.ROAD_STRAIGHT || southRow[x] === TileType.ROAD_INTERSECTION);

        // Create road surface
        const roadGeo = new THREE.PlaneGeometry(tileSize, tileSize);
        const road = new THREE.Mesh(roadGeo, roadMat);
        road.rotation.x = -Math.PI / 2;
        road.position.copy(worldPos);
        road.position.y = 0.01;
        road.receiveShadow = true;
        this.cityGroup.add(road);

        // Add center line
        if (tile === TileType.ROAD_STRAIGHT) {
          const isVertical = hasNorth || hasSouth;
          const lineGeo = new THREE.PlaneGeometry(isVertical ? 0.3 : tileSize * 0.8, isVertical ? tileSize * 0.8 : 0.3);
          const line = new THREE.Mesh(lineGeo, lineMat);
          line.rotation.x = -Math.PI / 2;
          line.position.copy(worldPos);
          line.position.y = 0.02;
          this.cityGroup.add(line);

          // Track road segment for traffic
          if (isVertical) {
            this.roadSegments.push({
              start: new THREE.Vector3(worldPos.x, 0, worldPos.z - tileSize/2),
              end: new THREE.Vector3(worldPos.x, 0, worldPos.z + tileSize/2),
              direction: new THREE.Vector3(0, 0, 1),
            });
          } else {
            this.roadSegments.push({
              start: new THREE.Vector3(worldPos.x - tileSize/2, 0, worldPos.z),
              end: new THREE.Vector3(worldPos.x + tileSize/2, 0, worldPos.z),
              direction: new THREE.Vector3(1, 0, 0),
            });
          }
        }

        roadsPlaced++;
        if (roadsPlaced % 10 === 0) {
          onProgress?.(40 + (roadsPlaced / totalRoads) * 20, `Placing roads... (${roadsPlaced}/${totalRoads})`);
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
    }

    console.log(`[TileCity] Placed ${roadsPlaced} road tiles, ${this.roadSegments.length} segments for traffic`);
  }

  /**
   * Place buildings on the grid
   */
  private async placeBuildings(onProgress?: (progress: number, status: string) => void): Promise<void> {
    if (this.buildings.length === 0) {
      console.warn('[TileCity] No buildings extracted, using fallback boxes');
      await this.placeFallbackBuildings(onProgress);
      return;
    }

    const { gridSize, tileSize } = this.config;
    let buildingsPlaced = 0;
    const totalBuildings = this.grid.flat().filter(t => t === TileType.BUILDING).length;

    for (let y = 0; y < gridSize; y++) {
      const row = this.grid[y];
      if (!row) continue;
      for (let x = 0; x < gridSize; x++) {
        if (row[x] !== TileType.BUILDING) continue;

        const worldPos = this.gridToWorld(x, y);

        // Pick random building
        const buildingAsset = this.buildings[Math.floor(Math.random() * this.buildings.length)];
        if (!buildingAsset) continue;
        const building = buildingAsset.mesh.clone();

        // Scale to fit tile (with some margin)
        const maxDim = Math.max(buildingAsset.size.x, buildingAsset.size.z);
        const targetSize = tileSize * 0.8; // 80% of tile
        const scale = Math.min(targetSize / maxDim, 1.5); // Cap scale
        building.scale.setScalar(scale);

        // Position
        building.position.copy(worldPos);
        building.position.y = 0;

        // Random rotation (0, 90, 180, 270)
        building.rotation.y = (Math.floor(Math.random() * 4) * Math.PI) / 2;

        // Enable shadows
        building.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
            obj.userData.collidable = true;
          }
        });

        this.cityGroup.add(building);
        buildingsPlaced++;

        if (buildingsPlaced % 5 === 0) {
          onProgress?.(60 + (buildingsPlaced / totalBuildings) * 20, `Placing buildings... (${buildingsPlaced}/${totalBuildings})`);
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
    }

    console.log(`[TileCity] Placed ${buildingsPlaced} buildings`);
  }

  /**
   * Fallback: create simple box buildings
   */
  private async placeFallbackBuildings(onProgress?: (progress: number, status: string) => void): Promise<void> {
    const { gridSize, tileSize } = this.config;
    const colors = [0xE8E4E1, 0xD4C4B5, 0xB8C4CE, 0xCCD5DB, 0xC9B99A];

    let buildingsPlaced = 0;
    const totalBuildings = this.grid.flat().filter(t => t === TileType.BUILDING).length;

    for (let y = 0; y < gridSize; y++) {
      const row = this.grid[y];
      if (!row) continue;
      for (let x = 0; x < gridSize; x++) {
        if (row[x] !== TileType.BUILDING) continue;

        const worldPos = this.gridToWorld(x, y);
        const width = tileSize * (0.6 + Math.random() * 0.3);
        const depth = tileSize * (0.6 + Math.random() * 0.3);
        const height = 10 + Math.random() * 30;

        const color = colors[Math.floor(Math.random() * colors.length)] ?? 0xE8E4E1;
        const geo = new THREE.BoxGeometry(width, height, depth);
        const mat = new THREE.MeshLambertMaterial({ color });
        const building = new THREE.Mesh(geo, mat);

        building.position.copy(worldPos);
        building.position.y = height / 2;
        building.castShadow = true;
        building.receiveShadow = true;
        building.userData.collidable = true;

        this.cityGroup.add(building);
        buildingsPlaced++;

        if (buildingsPlaced % 10 === 0) {
          onProgress?.(60 + (buildingsPlaced / totalBuildings) * 20, `Placing buildings... (${buildingsPlaced}/${totalBuildings})`);
        }
      }
    }

    console.log(`[TileCity] Placed ${buildingsPlaced} fallback buildings`);
  }

  /**
   * Place vehicles on roads
   */
  private placeVehicles(): void {
    if (this.cars.length === 0 || this.roadSegments.length === 0) {
      console.warn('[TileCity] No cars or road segments available');
      return;
    }

    const { carCount } = this.config;

    for (let i = 0; i < carCount; i++) {
      // Pick random road segment
      const segment = this.roadSegments[Math.floor(Math.random() * this.roadSegments.length)];
      if (!segment) continue;

      // Pick random car
      const carAsset = this.cars[Math.floor(Math.random() * this.cars.length)];
      if (!carAsset) continue;
      const car = carAsset.mesh.clone();

      // Scale car (Cartoon City cars are quite large)
      const carScale = 0.4 + Math.random() * 0.2; // 0.4-0.6 scale
      car.scale.setScalar(carScale);

      // Position along the road segment
      const t = 0.2 + Math.random() * 0.6; // Avoid edges
      const pos = segment.start.clone().lerp(segment.end, t);

      // Offset from center line (right side of road)
      const perpendicular = new THREE.Vector3(-segment.direction.z, 0, segment.direction.x);
      pos.add(perpendicular.multiplyScalar(2 + Math.random() * 2));

      car.position.copy(pos);
      car.position.y = 0;

      // Face direction of road
      const angle = Math.atan2(segment.direction.x, segment.direction.z);
      car.rotation.y = angle + (Math.random() > 0.5 ? 0 : Math.PI); // Random direction

      // Enable shadows
      car.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      });

      this.cityGroup.add(car);
      this.spawnedCars.push(car);
    }

    console.log(`[TileCity] Placed ${this.spawnedCars.length} vehicles`);
  }

  /**
   * Place props (trees, bushes, etc.)
   */
  private placeProps(): void {
    if (this.props.length === 0) return;

    const { gridSize, tileSize } = this.config;
    let propsPlaced = 0;

    // Add props at intersections and along roads
    for (let y = 0; y < gridSize; y++) {
      const row = this.grid[y];
      if (!row) continue;
      for (let x = 0; x < gridSize; x++) {
        const tile = row[x];
        if (tile !== TileType.ROAD_INTERSECTION) continue;

        // Place props at intersection corners
        const worldPos = this.gridToWorld(x, y);
        const corners = [
          { x: tileSize/2 + 2, z: tileSize/2 + 2 },
          { x: -tileSize/2 - 2, z: tileSize/2 + 2 },
          { x: tileSize/2 + 2, z: -tileSize/2 - 2 },
          { x: -tileSize/2 - 2, z: -tileSize/2 - 2 },
        ];

        for (const corner of corners) {
          if (Math.random() > 0.5) continue; // 50% chance

          // Pick random prop (prefer traffic lights at intersections)
          const trafficLights = this.props.filter(p => /traffic_light/i.test(p.name));
          const propAsset = trafficLights.length > 0 && Math.random() > 0.5
            ? trafficLights[Math.floor(Math.random() * trafficLights.length)]
            : this.props[Math.floor(Math.random() * this.props.length)];
          if (!propAsset) continue;

          const prop = propAsset.mesh.clone();
          prop.scale.setScalar(0.5 + Math.random() * 0.3);
          prop.position.set(worldPos.x + corner.x, 0, worldPos.z + corner.z);
          prop.rotation.y = Math.random() * Math.PI * 2;

          this.cityGroup.add(prop);
          propsPlaced++;
        }
      }
    }

    console.log(`[TileCity] Placed ${propsPlaced} props`);
  }

  /**
   * Register collisions for buildings
   */
  private registerCollisions(): void {
    this.cityGroup.updateMatrixWorld(true);

    this.cityGroup.traverse((obj) => {
      if (obj.userData.collidable) {
        const worldBox = new THREE.Box3().setFromObject(obj);
        this.collider.registerBox(obj, worldBox);
      }
    });

    console.log(`[TileCity] Registered ${this.collider.getColliders().length} colliders`);
  }

  /**
   * Get spawn position
   */
  public getSpawnPosition(): THREE.Vector3 {
    return this.spawnPosition.clone();
  }

  /**
   * Get bounds
   */
  public getBounds(): THREE.Box3 {
    return new THREE.Box3().setFromObject(this.cityGroup);
  }

  /**
   * Get road segments for traffic system
   */
  public getRoadSegments(): RoadSegment[] {
    return this.roadSegments;
  }

  /**
   * Get spawned cars for animation
   */
  public getSpawnedCars(): THREE.Object3D[] {
    return this.spawnedCars;
  }

  /**
   * Update - animate cars
   */
  public update(deltaTime: number): void {
    // Simple car animation - move along their facing direction
    for (const car of this.spawnedCars) {
      const speed = 5 + Math.random() * 0.1; // Slight variation
      const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(car.quaternion);
      car.position.add(forward.multiplyScalar(speed * deltaTime));

      // Wrap around city bounds
      const { gridSize, tileSize } = this.config;
      const halfSize = (gridSize * tileSize) / 2;

      if (car.position.x > halfSize) car.position.x = -halfSize;
      if (car.position.x < -halfSize) car.position.x = halfSize;
      if (car.position.z > halfSize) car.position.z = -halfSize;
      if (car.position.z < -halfSize) car.position.z = halfSize;
    }
  }
}
