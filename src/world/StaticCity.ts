import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { CityCollider, getCityCollider, resetCityCollider } from './collision/CityCollider';
import { TrafficSystem } from './TrafficSystem';
import { RoadNetwork, AdvancedTrafficSystem, RoadExtractor } from './traffic';
import { TrafficLightSystem } from './traffic/TrafficLightSystem';
import { getAssetLoader } from '../core/AssetLoader';

/**
 * Configuration for static city
 */
interface StaticCityConfig {
  modelPath: string;
  mtlPath?: string;
  scale: number;
  groundSize: number;
  gridSize: number;  // How many copies in each direction (2 = 2x2 = 4 copies)
  /** Use advanced traffic with IDM/ACC car-following models */
  useAdvancedTraffic: boolean;
  /** Show debug visualization for road network */
  debugRoads: boolean;
  /** Rotation correction in radians [x, y, z] - for Blender Z-up exports use [-Math.PI/2, 0, 0] */
  rotationCorrection?: [number, number, number];
  /** Position correction [x, y, z] */
  positionCorrection?: [number, number, number];
  /** Offset for generated waypoints */
  roadWaypointOffset?: number;
  /** Spawn position offset [x, y, z] from city center - use to avoid props in center */
  spawnOffset?: [number, number, number];
}

const DEFAULT_CONFIG: Omit<StaticCityConfig, 'mtlPath'> = {
  // Cartoon City FREE - full city with roads, cars, buildings
  modelPath: '/models/cartoon-city/uploads_files_6376639_Cartoon_City_Free (1).glb',
  scale: 1.0,
  groundSize: 1500,
  gridSize: 1, // Single city (use 2 for 2x2 grid)
  useAdvancedTraffic: true, // Use road-based traffic with IDM/ACC
  debugRoads: false, // Show waypoints as green spheres
};

/**
 * StaticCity - Loads and displays a pre-made city model
 * Supports GLTF/GLB, FBX, and OBJ formats
 */
export class StaticCity {
  private readonly config: StaticCityConfig;
  private readonly cityGroup: THREE.Group;
  private readonly collider: CityCollider;
  private readonly gltfLoader: GLTFLoader;
  private readonly fbxLoader: FBXLoader;
  private readonly objLoader: OBJLoader;
  private readonly mtlLoader: MTLLoader;
  private cityModel: THREE.Group | null = null;
  private spawnPosition: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

  // Traffic systems - simple or advanced
  private readonly simpleTrafficSystem: TrafficSystem;
  private advancedTrafficSystem: AdvancedTrafficSystem | null = null;
  private roadNetwork: RoadNetwork | null = null;
  private trafficLightSystem: TrafficLightSystem | null = null;

  constructor(config: Partial<StaticCityConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cityGroup = new THREE.Group();
    this.cityGroup.name = 'static_city';
    this.gltfLoader = new GLTFLoader();
    this.fbxLoader = new FBXLoader();
    this.objLoader = new OBJLoader();
    this.mtlLoader = new MTLLoader();

    resetCityCollider();
    this.collider = getCityCollider();
    this.simpleTrafficSystem = new TrafficSystem();
  }

  /**
   * Load and setup the city
   */
  public async load(
    onProgress?: (progress: number, status: string) => void
  ): Promise<THREE.Group> {
    console.log('[StaticCity] Loading city model...');

    onProgress?.(10, 'Creating ground...');
    this.createGround();

    onProgress?.(20, 'Loading city model...');

    try {
      const path = this.config.modelPath.toLowerCase();
      const isFBX = path.endsWith('.fbx');
      const isOBJ = path.endsWith('.obj');

      if (isFBX) {
        this.cityModel = await this.loadFBX(this.config.modelPath);
      } else if (isOBJ) {
        this.cityModel = await this.loadOBJ(this.config.modelPath, this.config.mtlPath);
      } else {
        const gltf = await this.loadGLTF(this.config.modelPath);
        this.cityModel = gltf.scene;
      }

      // Debug: Log original bounds BEFORE any transformation
      const originalBox = new THREE.Box3().setFromObject(this.cityModel);
      const originalSize = originalBox.getSize(new THREE.Vector3());
      console.log(`[StaticCity] ORIGINAL bounds: min=(${originalBox.min.x.toFixed(1)}, ${originalBox.min.y.toFixed(1)}, ${originalBox.min.z.toFixed(1)}), max=(${originalBox.max.x.toFixed(1)}, ${originalBox.max.y.toFixed(1)}, ${originalBox.max.z.toFixed(1)})`);
      console.log(`[StaticCity] ORIGINAL size: X=${originalSize.x.toFixed(1)}, Y=${originalSize.y.toFixed(1)}, Z=${originalSize.z.toFixed(1)}`);

      // STEP 1: Apply rotation directly to geometry (bake it in)
      // This is more reliable than object rotation for positioning
      if (this.config.rotationCorrection) {
        const [rx, ry, rz] = this.config.rotationCorrection;
        const rotationMatrix = new THREE.Matrix4();
        rotationMatrix.makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'XYZ'));

        this.cityModel.traverse((child) => {
          if (child instanceof THREE.Mesh && child.geometry) {
            child.geometry.applyMatrix4(rotationMatrix);
            // Recompute bounds after transformation
            child.geometry.computeBoundingBox();
            child.geometry.computeBoundingSphere();
          }
        });

        console.log(`[StaticCity] Baked rotation into geometry: [${(rx * 180 / Math.PI).toFixed(1)}°, ${(ry * 180 / Math.PI).toFixed(1)}°, ${(rz * 180 / Math.PI).toFixed(1)}°]`);
      }

      // STEP 2: Apply scale
      this.cityModel.scale.setScalar(this.config.scale);
      this.cityModel.updateMatrixWorld(true);

      // STEP 3: Calculate bounds after rotation
      const box = new THREE.Box3().setFromObject(this.cityModel);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      console.log(`[StaticCity] AFTER ROTATION bounds: min=(${box.min.x.toFixed(1)}, ${box.min.y.toFixed(1)}, ${box.min.z.toFixed(1)}), max=(${box.max.x.toFixed(1)}, ${box.max.y.toFixed(1)}, ${box.max.z.toFixed(1)})`);
      console.log(`[StaticCity] AFTER ROTATION size: X=${size.x.toFixed(1)}, Y=${size.y.toFixed(1)}, Z=${size.z.toFixed(1)}`);
      console.log(`[StaticCity] Center: (${center.x.toFixed(1)}, ${center.y.toFixed(1)}, ${center.z.toFixed(1)})`);

      // STEP 4: Center horizontally, place bottom at Y=0
      this.cityModel.position.set(
        -center.x,
        -box.min.y,
        -center.z
      );

      // Apply manual position correction
      if (this.config.positionCorrection) {
        const [px, py, pz] = this.config.positionCorrection;
        this.cityModel.position.x += px;
        this.cityModel.position.y += py;
        this.cityModel.position.z += pz;
      }

      console.log(`[StaticCity] Position offset: (${this.cityModel.position.x.toFixed(1)}, ${this.cityModel.position.y.toFixed(1)}, ${this.cityModel.position.z.toFixed(1)})`);

      // Verify final position
      this.cityModel.updateMatrixWorld(true);
      const finalBox = new THREE.Box3().setFromObject(this.cityModel);
      console.log(`[StaticCity] FINAL bounds: min=(${finalBox.min.x.toFixed(1)}, ${finalBox.min.y.toFixed(1)}, ${finalBox.min.z.toFixed(1)}), max=(${finalBox.max.x.toFixed(1)}, ${finalBox.max.y.toFixed(1)}, ${finalBox.max.z.toFixed(1)})`);

      // Enable shadows on all meshes
      this.cityModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          child.userData.collidable = true;
        }
      });

      // Calculate city dimensions for grid placement
      const cityBox = new THREE.Box3().setFromObject(this.cityModel);
      const citySize = cityBox.getSize(new THREE.Vector3());
      console.log(`[StaticCity] Single city size: ${citySize.x.toFixed(1)} x ${citySize.z.toFixed(1)}`);

      // Create grid of cities
      const { gridSize } = this.config;
      const totalCopies = gridSize * gridSize;

      // Offset to center the grid around origin
      const gridOffsetX = (gridSize - 1) * citySize.x / 2;
      const gridOffsetZ = (gridSize - 1) * citySize.z / 2;

      for (let gx = 0; gx < gridSize; gx++) {
        for (let gz = 0; gz < gridSize; gz++) {
          const isOriginal = (gx === 0 && gz === 0);
          const cityInstance = isOriginal ? this.cityModel : this.cloneCity(this.cityModel);

          // Position in grid
          const offsetX = gx * citySize.x - gridOffsetX;
          const offsetZ = gz * citySize.z - gridOffsetZ;

          cityInstance.position.x += offsetX;
          cityInstance.position.z += offsetZ;

          if (!isOriginal) {
            this.cityGroup.add(cityInstance);
          }

          console.log(`[StaticCity] City grid [${gx},${gz}] at offset (${offsetX.toFixed(1)}, ${offsetZ.toFixed(1)})`);
        }
      }

      // Add original city model to group
      this.cityGroup.add(this.cityModel);

      // Calculate spawn position (center of the full grid)
      // Use city model bounds, not full group (which includes ground at Y=-20)
      const cityModelBox = new THREE.Box3().setFromObject(this.cityModel);
      const cityModelCenter = cityModelBox.getCenter(new THREE.Vector3());
      // Spawn at street level (bottom of city model, not ground plane)
      // Apply spawn offset if configured (to avoid props in center)
      const spawnOffset = this.config.spawnOffset ?? [0, 0, 0];
      console.log(`[StaticCity] Config spawnOffset:`, this.config.spawnOffset);
      console.log(`[StaticCity] Using spawnOffset: [${spawnOffset.join(', ')}]`);
      console.log(`[StaticCity] City center: (${cityModelCenter.x.toFixed(2)}, ${cityModelCenter.z.toFixed(2)})`);
      this.spawnPosition.set(
        cityModelCenter.x + spawnOffset[0],
        cityModelBox.min.y + spawnOffset[1],
        cityModelCenter.z + spawnOffset[2]
      );
      console.log(`[StaticCity] Final spawn position: (${this.spawnPosition.x.toFixed(2)}, ${this.spawnPosition.y.toFixed(2)}, ${this.spawnPosition.z.toFixed(2)})`);
      console.log(`[StaticCity] Spawn Y: ${cityModelBox.min.y.toFixed(2)} (city model min/max Y: ${cityModelBox.min.y.toFixed(2)}/${cityModelBox.max.y.toFixed(2)})`);

      onProgress?.(80, 'Setting up collisions...');
      this.registerCollisions();

      onProgress?.(85, 'Creating boundary...');
      this.createBoundary();

      onProgress?.(90, 'Initializing traffic...');
      this.initializeTraffic();

      onProgress?.(100, 'City loaded!');

      console.log(`[StaticCity] City loaded successfully (${totalCopies} copies in ${gridSize}x${gridSize} grid)`);
      console.log(`[StaticCity] City model bounds:`, cityModelBox);
      console.log(`[StaticCity] Spawn position:`, this.spawnPosition);

    } catch (error) {
      console.error('[StaticCity] Failed to load city model:', error);
      // Create fallback ground-only scene
      onProgress?.(100, 'Using fallback scene');
    }

    return this.cityGroup;
  }

  /**
   * Load GLTF/GLB file
   */
  private loadGLTF(path: string): Promise<GLTF> {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        path,
        (gltf) => resolve(gltf),
        (progress) => {
          if (progress.total > 0) {
            const percent = (progress.loaded / progress.total) * 100;
            console.log(`[StaticCity] Loading GLTF: ${percent.toFixed(1)}%`);
          }
        },
        (error) => reject(error)
      );
    });
  }

  /**
   * Load FBX file
   */
  private loadFBX(path: string): Promise<THREE.Group> {
    return new Promise((resolve, reject) => {
      this.fbxLoader.load(
        path,
        (fbx) => {
          console.log(`[StaticCity] FBX loaded with ${fbx.children.length} children`);
          resolve(fbx);
        },
        (progress) => {
          if (progress.total > 0) {
            const percent = (progress.loaded / progress.total) * 100;
            console.log(`[StaticCity] Loading FBX: ${percent.toFixed(1)}%`);
          }
        },
        (error) => reject(error)
      );
    });
  }

  /**
   * Load OBJ file with optional MTL materials
   */
  private async loadOBJ(objPath: string, mtlPath?: string): Promise<THREE.Group> {
    // Set the path for texture loading (same directory as MTL)
    if (mtlPath) {
      const mtlDir = mtlPath.substring(0, mtlPath.lastIndexOf('/') + 1);
      this.mtlLoader.setPath(mtlDir);
    }

    return new Promise((resolve, reject) => {
      const loadObjWithMaterials = (materials?: MTLLoader.MaterialCreator) => {
        if (materials) {
          materials.preload();
          this.objLoader.setMaterials(materials);
        }

        this.objLoader.load(
          objPath,
          (obj) => {
            console.log(`[StaticCity] OBJ loaded with ${obj.children.length} children`);
            resolve(obj);
          },
          (progress) => {
            if (progress.total > 0) {
              const percent = (progress.loaded / progress.total) * 100;
              console.log(`[StaticCity] Loading OBJ: ${percent.toFixed(1)}%`);
            }
          },
          (error) => reject(error)
        );
      };

      if (mtlPath) {
        const mtlFileName = mtlPath.substring(mtlPath.lastIndexOf('/') + 1);
        this.mtlLoader.load(
          mtlFileName,
          (materials) => {
            console.log('[StaticCity] MTL materials loaded');
            loadObjWithMaterials(materials);
          },
          undefined,
          (error) => {
            console.warn('[StaticCity] Failed to load MTL, loading OBJ without materials:', error);
            loadObjWithMaterials();
          }
        );
      } else {
        loadObjWithMaterials();
      }
    });
  }

  /**
   * Deep clone a city model with all meshes and materials
   */
  private cloneCity(original: THREE.Group): THREE.Group {
    const clone = original.clone(true);

    // Ensure cloned meshes have proper userData for collision detection
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.userData.collidable = true;
        // Clone materials to allow independent modifications if needed
        if (Array.isArray(child.material)) {
          child.material = child.material.map(m => m.clone());
        } else if (child.material) {
          child.material = child.material.clone();
        }
      }
    });

    return clone;
  }

  /**
   * Create ground plane
   */
  private createGround(): void {
    const { groundSize, gridSize } = this.config;

    // Ground plane - scale with grid size
    const scaledGroundSize = groundSize * gridSize;
    const groundGeo = new THREE.PlaneGeometry(scaledGroundSize, scaledGroundSize);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x3a5a3a, // Dark green grass
      roughness: 0.9,
      metalness: 0.1,
    });

    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5; // Just below the city model (which is at ~0)
    ground.receiveShadow = true;
    ground.userData.collidable = false; // Don't need collision for ground

    this.cityGroup.add(ground);
  }

  /**
   * Register collisions for buildings
   */
  private registerCollisions(): void {
    if (!this.cityModel) return;

    let buildingCount = 0;
    const ignoredNames = [
      'ground', 'floor', 'road', 'street', 'terrain', 'water', 'grass', 'pavement',
      '_gltfNode_14', '_gltfNode_2084', '_gltfNode_5068' // Specific blocking objects (bridge, etc.)
    ];

    this.cityModel.traverse((child) => {
      if (child instanceof THREE.Mesh && child.userData.collidable) {
        // Check name for ignored keywords
        const name = child.name.toLowerCase();
        if (ignoredNames.some(ignored => name.includes(ignored.toLowerCase()))) {
          // console.log(`[StaticCity] Ignoring collision for ${child.name} (keyword match)`);
          return;
        }

        // Get world bounding box
        const box = new THREE.Box3().setFromObject(child);
        const size = box.getSize(new THREE.Vector3());

        // Heuristic: Ignore very flat objects (likely ground/floor)
        // If width/length is much larger than height
        if (size.y < 0.5) {
          // Very thin, likely ground decal or pavement
          return;
        }

        // Ignore large flat objects (likely ground plane segments)
        if (size.y < 2.0 && (size.x > 20 || size.z > 20)) {
          return;
        }

        if (size.y < 3.0 && (size.x > 10 || size.z > 10)) {
          // Flat and large-ish, likely ground/floor
          // console.log(`[StaticCity] Ignoring collision for ${child.name} (flat object: ${size.x.toFixed(1)}x${size.y.toFixed(1)}x${size.z.toFixed(1)})`);
          return;
        }

        // Heuristic: Ignore very large objects (likely city base/ground)
        // Increased limit significantly to allow large building blocks
        if (size.x > 300 || size.z > 300) {
          return;
        }

        // Only register larger objects as colliders (skip small props)
        if (size.x > 1 && size.y > 1 && size.z > 1) {
          this.collider.registerBox(child, box);
          buildingCount++;
          // console.log(`[StaticCity] Registered collider: ${child.name} (${size.x.toFixed(1)}x${size.y.toFixed(1)}x${size.z.toFixed(1)})`);
        }
      }
    });

    console.log(`[StaticCity] Registered ${buildingCount} collision boxes`);
  }

  /**
   * Create city boundary walls with visual hedge
   * Prevents NPCs and player from leaving the map
   */
  private createBoundary(): void {
    if (!this.cityModel) return;

    // Get actual city bounds (not ground plane)
    const cityBox = new THREE.Box3().setFromObject(this.cityModel);
    const citySize = cityBox.getSize(new THREE.Vector3());

    // Add margin around the city
    const margin = 5;
    const boundaryOffset = {
      minX: cityBox.min.x - margin,
      maxX: cityBox.max.x + margin,
      minZ: cityBox.min.z - margin,
      maxZ: cityBox.max.z + margin,
    };

    const wallHeight = 8;
    const wallThickness = 2;
    const hedgeHeight = 2.5;
    const hedgeDepth = 1.5;

    // Update collider bounds to match actual city size
    this.collider.updateBounds(new THREE.Box3(
      new THREE.Vector3(boundaryOffset.minX, 0, boundaryOffset.minZ),
      new THREE.Vector3(boundaryOffset.maxX, 200, boundaryOffset.maxZ)
    ));

    // Invisible collision walls (behind the hedge)
    const invisibleWallMat = new THREE.MeshBasicMaterial({
      visible: false,
    });

    const walls = [
      // North wall (positive Z)
      {
        x: (boundaryOffset.minX + boundaryOffset.maxX) / 2,
        z: boundaryOffset.maxZ + wallThickness / 2,
        w: citySize.x + margin * 2 + wallThickness * 2,
        d: wallThickness
      },
      // South wall (negative Z)
      {
        x: (boundaryOffset.minX + boundaryOffset.maxX) / 2,
        z: boundaryOffset.minZ - wallThickness / 2,
        w: citySize.x + margin * 2 + wallThickness * 2,
        d: wallThickness
      },
      // East wall (positive X)
      {
        x: boundaryOffset.maxX + wallThickness / 2,
        z: (boundaryOffset.minZ + boundaryOffset.maxZ) / 2,
        w: wallThickness,
        d: citySize.z + margin * 2 + wallThickness * 2
      },
      // West wall (negative X)
      {
        x: boundaryOffset.minX - wallThickness / 2,
        z: (boundaryOffset.minZ + boundaryOffset.maxZ) / 2,
        w: wallThickness,
        d: citySize.z + margin * 2 + wallThickness * 2
      },
    ];

    // Create invisible collision walls
    for (const wall of walls) {
      const geo = new THREE.BoxGeometry(wall.w, wallHeight, wall.d);
      const mesh = new THREE.Mesh(geo, invisibleWallMat);
      mesh.position.set(wall.x, wallHeight / 2, wall.z);
      mesh.userData.collidable = true;
      mesh.userData.isBoundary = true;
      this.cityGroup.add(mesh);
      this.collider.registerBox(mesh);
    }

    // Create visual hedge (green bushes along the boundary)
    this.createHedge(boundaryOffset, hedgeHeight, hedgeDepth, citySize);

    console.log(`[StaticCity] Created boundary walls and hedge (city size: ${citySize.x.toFixed(0)}x${citySize.z.toFixed(0)})`);
  }

  /**
   * Create visual hedge around the city perimeter
   */
  private createHedge(
    bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
    height: number,
    _depth: number,
    citySize: THREE.Vector3
  ): void {
    const hedgeGroup = new THREE.Group();
    hedgeGroup.name = 'boundary_hedge';

    // Hedge material - cartoon green with slight variation
    const hedgeColors: number[] = [0x2d5a27, 0x3d6b37, 0x4a7a44, 0x357a2e];
    const defaultColor = 0x2d5a27;

    // Bush segment size
    const bushWidth = 3;
    const bushVariation = 0.4; // Random size variation

    // Horizontal sides (along X axis)
    interface HorizontalSide {
      type: 'horizontal';
      startX: number;
      z: number;
      length: number;
    }

    // Vertical sides (along Z axis)
    interface VerticalSide {
      type: 'vertical';
      startZ: number;
      x: number;
      length: number;
    }

    type Side = HorizontalSide | VerticalSide;

    const sides: Side[] = [
      // North (positive Z)
      { type: 'horizontal', startX: bounds.minX, z: bounds.maxZ, length: citySize.x },
      // South (negative Z)
      { type: 'horizontal', startX: bounds.minX, z: bounds.minZ, length: citySize.x },
      // East (positive X)
      { type: 'vertical', startZ: bounds.minZ, x: bounds.maxX, length: citySize.z },
      // West (negative X)
      { type: 'vertical', startZ: bounds.minZ, x: bounds.minX, length: citySize.z },
    ];

    for (const side of sides) {
      const length = side.length + 10; // Add margin
      const bushCount = Math.ceil(length / bushWidth);

      for (let i = 0; i < bushCount; i++) {
        // Random variation for natural look
        const sizeVariation = 1 + (Math.random() - 0.5) * bushVariation;
        const heightVariation = 1 + (Math.random() - 0.5) * bushVariation * 0.5;
        const offsetVariation = (Math.random() - 0.5) * 0.3;

        const bushGeo = new THREE.SphereGeometry(
          bushWidth * 0.5 * sizeVariation,
          8,
          6
        );
        // Squash sphere into bush shape
        bushGeo.scale(1, heightVariation * 0.7, 1);

        const colorIndex = Math.floor(Math.random() * hedgeColors.length);
        const bushColor = hedgeColors[colorIndex] ?? defaultColor;
        const bushMat = new THREE.MeshStandardMaterial({
          color: bushColor,
          roughness: 0.9,
          metalness: 0.0,
        });

        const bush = new THREE.Mesh(bushGeo, bushMat);
        bush.castShadow = true;
        bush.receiveShadow = true;

        if (side.type === 'horizontal') {
          const x = side.startX + i * bushWidth + bushWidth / 2;
          bush.position.set(
            x + offsetVariation,
            height * heightVariation * 0.5,
            side.z + offsetVariation
          );
        } else {
          const z = side.startZ + i * bushWidth + bushWidth / 2;
          bush.position.set(
            side.x + offsetVariation,
            height * heightVariation * 0.5,
            z + offsetVariation
          );
        }

        hedgeGroup.add(bush);
      }
    }

    // Add corner bushes (larger)
    const corners = [
      { x: bounds.minX, z: bounds.minZ },
      { x: bounds.minX, z: bounds.maxZ },
      { x: bounds.maxX, z: bounds.minZ },
      { x: bounds.maxX, z: bounds.maxZ },
    ];

    for (const corner of corners) {
      const cornerGeo = new THREE.SphereGeometry(bushWidth * 0.8, 8, 6);
      cornerGeo.scale(1.2, 0.8, 1.2);

      const cornerMat = new THREE.MeshStandardMaterial({
        color: defaultColor,
        roughness: 0.9,
      });

      const cornerBush = new THREE.Mesh(cornerGeo, cornerMat);
      cornerBush.position.set(corner.x, height * 0.5, corner.z);
      cornerBush.castShadow = true;
      hedgeGroup.add(cornerBush);
    }

    this.cityGroup.add(hedgeGroup);
  }

  /**
   * Get spawn position for player
   */
  public getSpawnPosition(): THREE.Vector3 {
    return this.spawnPosition.clone();
  }

  /**
   * Get the city group
   */
  public getGroup(): THREE.Group {
    return this.cityGroup;
  }

  /**
   * Get city bounds
   */
  public getBounds(): THREE.Box3 {
    return new THREE.Box3().setFromObject(this.cityGroup);
  }

  /**
   * Get random position within the city for placing NPCs
   */
  public getRandomPosition(margin: number = 10): THREE.Vector3 {
    const bounds = this.getBounds();
    const x = bounds.min.x + margin + Math.random() * (bounds.max.x - bounds.min.x - margin * 2);
    const z = bounds.min.z + margin + Math.random() * (bounds.max.z - bounds.min.z - margin * 2);
    return new THREE.Vector3(x, 0, z);
  }

  /**
   * Initialize traffic system (simple or advanced based on config)
   */
  private initializeTraffic(): void {
    if (this.config.useAdvancedTraffic) {
      console.log('[StaticCity] Using advanced traffic with IDM/ACC models');

      // Create road network
      this.roadNetwork = new RoadNetwork({ defaultSpeedLimit: 8 });

      // Extract roads from model or create default grid
      const roadExtractor = new RoadExtractor({
        yOffset: this.config.roadWaypointOffset ?? 0.02
      });
      roadExtractor.extractFromModel(this.cityGroup, this.roadNetwork);

      // If no road SEGMENTS found (even if waypoints exist), create default grid
      const extractedStats = this.roadNetwork.getStats();
      console.log(`[StaticCity] Road extraction result: ${extractedStats.waypoints} waypoints, ${extractedStats.segments} segments, ${extractedStats.intersections} intersections`);
      if (extractedStats.segments < 4) {
        console.log(`[StaticCity] Insufficient road segments (${extractedStats.segments}), creating default grid...`);

        // Clear any orphaned waypoints and create fresh network
        this.roadNetwork = new RoadNetwork({ defaultSpeedLimit: 8 });

        const bounds = this.getBounds();
        const center = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3());

        // Create grid that covers the city with ~40 unit spacing
        // Use Y = 0 (ground level) instead of center.y (which includes tall buildings)
        const cellSize = 40;
        const gridWidth = Math.max(3, Math.floor(size.x / cellSize));
        const gridHeight = Math.max(3, Math.floor(size.z / cellSize));

        const gridCenter = new THREE.Vector3(center.x, 0, center.z);
        this.roadNetwork.createGrid(gridCenter, gridWidth, gridHeight, cellSize, { speedLimit: 8 });
      }

      // Create traffic light system
      this.trafficLightSystem = new TrafficLightSystem();
      this.trafficLightSystem.initializeFromModel(this.cityGroup);

      // Create advanced traffic system
      this.advancedTrafficSystem = new AdvancedTrafficSystem(this.roadNetwork, {
        maxVehicles: 50,
      });
      this.advancedTrafficSystem.initializeFromModel(this.cityGroup, this.config.scale);
      this.advancedTrafficSystem.setScene(this.cityGroup); // Set scene for raycasting

      // Connect traffic collisions to CityCollider
      this.collider.registerDynamicCollider((center, radius) => {
        if (!this.advancedTrafficSystem) return null;
        const vehicle = this.advancedTrafficSystem.checkCollisionAtPosition(center, radius);
        if (vehicle) {
          return {
            type: 'box',
            box: vehicle.collisionBox,
            object: vehicle.mesh
          };
        }
        return null;
      });

      // If no vehicles found in model, try to use assets from AssetLoader
      if (this.advancedTrafficSystem.getVehicleCount() === 0) {
        const assetLoader = getAssetLoader();
        if (assetLoader.isInitialized()) {
          // Get all car models from AssetLoader
          // AssetLoader stores them in carModels array, but we need to access them
          // The public API is getRandomCarModel, but we want all variants if possible
          // For now, let's just get a few random ones to populate the pool
          const carPrefabs: THREE.Object3D[] = [];

          // Try to get different car models if available
          // Since we don't have a direct "getAllCarModels" API exposed clearly (it returns BuildingModel[] for buildings but carModels is private/internal array access via getRandom)
          // We can just grab a random one multiple times, hoping to get variety if they exist
          // Or we can add a method to AssetLoader to get all car prefabs.
          // For now, let's assume there is at least one.
          const car = assetLoader.getRandomCarModel();
          if (car) {
            carPrefabs.push(car);
            // Add a few more copies/variants if we can
            for (let i = 0; i < 5; i++) {
              const c = assetLoader.getRandomCarModel();
              if (c) carPrefabs.push(c);
            }

            this.advancedTrafficSystem.setVehiclePrefabs(carPrefabs);
          }
        }
      }

      // Connect traffic lights to traffic system
      this.advancedTrafficSystem.setTrafficLightSystem(this.trafficLightSystem);

      // Add debug visualization if enabled
      if (this.config.debugRoads) {
        const debugViz = this.roadNetwork.createDebugVisualization();
        this.cityGroup.add(debugViz);
        console.log('[StaticCity] Road network debug visualization added');
      }

      const stats = this.roadNetwork.getStats();
      console.log(`[StaticCity] Road network: ${stats.waypoints} waypoints, ${stats.segments} segments`);
    } else {
      console.log('[StaticCity] Using simple traffic system');

      // Use simple back-and-forth traffic
      this.simpleTrafficSystem.initializeFromModel(this.cityGroup, this.config.scale);
      this.cityGroup.add(this.simpleTrafficSystem.getVehicleGroup());
    }
  }

  /**
   * Update city systems (traffic, etc.)
   * @param deltaTime - Time since last frame
   */
  public update(deltaTime: number): void {
    if (this.config.useAdvancedTraffic && this.advancedTrafficSystem) {
      // Update traffic lights first (they control vehicles)
      if (this.trafficLightSystem) {
        this.trafficLightSystem.update(deltaTime);
      }
      this.advancedTrafficSystem.update(deltaTime);
    } else {
      this.simpleTrafficSystem.update(deltaTime);
    }
  }

  /**
   * Get traffic system (simple)
   */
  public getTrafficSystem(): TrafficSystem {
    return this.simpleTrafficSystem;
  }

  /**
   * Get advanced traffic system
   */
  public getAdvancedTrafficSystem(): AdvancedTrafficSystem | null {
    return this.advancedTrafficSystem;
  }

  /**
   * Get road network (for advanced traffic)
   */
  public getRoadNetwork(): RoadNetwork | null {
    return this.roadNetwork;
  }
}
