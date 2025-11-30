import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Asset types available in the game
 * Note: 'tree' removed - was 20MB and never used
 * Note: 'character' removed - CharacterLoader handles characters separately
 */
export type AssetType = 'car' | 'building' | 'citypack';

/**
 * Loaded asset with metadata
 */
export interface LoadedAsset {
  type: AssetType;
  name: string;
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}

/**
 * Asset configuration
 */
interface AssetConfig {
  path: string;
  scale: number;
  yOffset: number;
}

/**
 * Extracted building model with size info
 */
export interface BuildingModel {
  mesh: THREE.Group;
  width: number;
  depth: number;
  height: number;
  name: string;
}

/**
 * Asset paths and configurations
 * Removed unused assets:
 * - tree (20MB, never used)
 * - character (CharacterLoader handles this)
 */
const ASSET_CONFIGS: Record<AssetType, AssetConfig> = {
  car: {
    path: '/assets/models/cars/cars.glb',
    scale: 0.8,
    yOffset: 0,
  },
  building: {
    path: '/assets/models/buildings/low-poly-city.glb',
    scale: 1,
    yOffset: 0,
  },
  citypack: {
    path: '/assets/models/buildings/city_pack.glb',
    scale: 1.0,
    yOffset: 0,
  },
};

/**
 * AssetLoader - Loads and manages 3D models from GLB files
 * Singleton pattern for global access
 */
export class AssetLoader {
  private static instance: AssetLoader | null = null;

  private readonly loader: GLTFLoader;
  private readonly loadedAssets: Map<AssetType, GLTF> = new Map();
  private readonly extractedMeshes: Map<string, THREE.Group> = new Map();
  private readonly buildingModels: BuildingModel[] = [];
  private readonly carModels: THREE.Group[] = [];
  private initialized = false;

  private constructor() {
    this.loader = new GLTFLoader();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): AssetLoader {
    if (!AssetLoader.instance) {
      AssetLoader.instance = new AssetLoader();
    }
    return AssetLoader.instance;
  }

  /**
   * Initialize and preload all assets
   */
  public async initialize(
    onProgress?: (progress: number, status: string) => void
  ): Promise<void> {
    if (this.initialized) return;

    console.log('[AssetLoader] Initializing...');

    const assetTypes = Object.keys(ASSET_CONFIGS) as AssetType[];
    const total = assetTypes.length;

    for (let i = 0; i < assetTypes.length; i++) {
      const type = assetTypes[i]!;
      const config = ASSET_CONFIGS[type];

      onProgress?.(
        (i / total) * 100,
        `Loading ${type}...`
      );

      try {
        const gltf = await this.loadGLTF(config.path);

        // Apply scale and offset
        gltf.scene.scale.setScalar(config.scale);
        gltf.scene.position.y = config.yOffset;

        // Enable shadows on all meshes
        gltf.scene.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        this.loadedAssets.set(type, gltf);

        // Extract individual meshes/objects from the scene
        this.extractMeshes(type, gltf.scene);

        // Special extraction for city_pack - extract buildings, trees, cars from organized structure
        if (type === 'citypack') {
          this.extractCityPackAssets(gltf.scene);
        }

        console.log(`[AssetLoader] Loaded ${type} with ${gltf.scene.children.length} objects`);
      } catch (error) {
        console.warn(`[AssetLoader] Failed to load ${type}:`, error);
      }
    }

    onProgress?.(100, 'Assets loaded');
    this.initialized = true;
    console.log('[AssetLoader] All assets loaded');
  }

  /**
   * Load a GLTF file with timeout
   */
  private loadGLTF(path: string, timeoutMs = 30000): Promise<GLTF> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout loading ${path} after ${timeoutMs}ms`));
      }, timeoutMs);

      this.loader.load(
        path,
        (gltf) => {
          clearTimeout(timeoutId);
          resolve(gltf);
        },
        undefined,
        (error) => {
          clearTimeout(timeoutId);
          reject(error);
        }
      );
    });
  }

  /**
   * Extract individual meshes from a loaded scene
   */
  private extractMeshes(type: AssetType, scene: THREE.Group): void {
    let index = 0;

    scene.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Group) {
        if (child.children.length > 0 || child instanceof THREE.Mesh) {
          const key = `${type}_${index}`;

          // Clone the object for storage
          const cloned = child.clone();

          // Wrap in a group if it's just a mesh
          if (cloned instanceof THREE.Mesh) {
            const group = new THREE.Group();
            group.add(cloned);
            this.extractedMeshes.set(key, group);
          } else {
            this.extractedMeshes.set(key, cloned as THREE.Group);
          }

          index++;
        }
      }
    });

    console.log(`[AssetLoader] Extracted ${index} meshes from ${type}`);
  }

  /**
   * Get a clone of a specific asset type's full scene
   */
  public getAsset(type: AssetType): THREE.Group | null {
    const gltf = this.loadedAssets.get(type);
    if (!gltf) return null;
    return gltf.scene.clone();
  }

  /**
   * Get a random mesh from an asset type
   */
  public getRandomMesh(type: AssetType): THREE.Group | null {
    const meshes: THREE.Group[] = [];

    this.extractedMeshes.forEach((mesh, key) => {
      if (key.startsWith(type)) {
        meshes.push(mesh);
      }
    });

    if (meshes.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * meshes.length);
    return meshes[randomIndex]!.clone();
  }

  /**
   * Get a specific mesh by key
   */
  public getMesh(key: string): THREE.Group | null {
    const mesh = this.extractedMeshes.get(key);
    return mesh ? mesh.clone() : null;
  }

  /**
   * Get all mesh keys for an asset type
   */
  public getMeshKeys(type: AssetType): string[] {
    const keys: string[] = [];
    this.extractedMeshes.forEach((_, key) => {
      if (key.startsWith(type)) {
        keys.push(key);
      }
    });
    return keys;
  }

  /**
   * Get animations for an asset type
   */
  public getAnimations(type: AssetType): THREE.AnimationClip[] {
    const gltf = this.loadedAssets.get(type);
    return gltf?.animations || [];
  }

  /**
   * Check if assets are loaded
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get loading status
   */
  public getLoadedTypes(): AssetType[] {
    return Array.from(this.loadedAssets.keys());
  }

  /**
   * Extract buildings, trees, and cars from city_pack.glb
   * The pack has organized structure: Buildings, Vehicles, Props/Other
   */
  private extractCityPackAssets(scene: THREE.Group): void {
    console.log('[AssetLoader] Extracting CityPack assets...');

    // Find the main container node (Low_Poly_Simple_Urban_City_3D_Asset_Pack)
    const findNode = (parent: THREE.Object3D, name: string): THREE.Object3D | null => {
      if (parent.name === name) return parent;
      for (const child of parent.children) {
        const found = findNode(child, name);
        if (found) return found;
      }
      return null;
    };

    // Try to find organized containers
    const rootNode = findNode(scene, 'Low_Poly_Simple_Urban_City_3D_Asset_Pack');
    const buildingsContainer = findNode(scene, 'Buildings');
    const vehiclesContainer = findNode(scene, 'Vehicles');
    const propsContainer = findNode(scene, 'Props');

    console.log('[AssetLoader] Found containers:', {
      root: !!rootNode,
      buildings: !!buildingsContainer,
      vehicles: !!vehiclesContainer,
      props: !!propsContainer
    });

    // Extract buildings from the Buildings container
    if (buildingsContainer) {
      for (const child of buildingsContainer.children) {
        if (child.name.startsWith('Building_')) {
          this.extractAndAddModel(child, 'building');
        }
      }
    }

    // Extract vehicles from the Vehicles container
    if (vehiclesContainer) {
      this.extractVehiclesFromContainer(vehiclesContainer);
    }

    // Extract trees and other props from Props container
    if (propsContainer) {
      this.extractPropsFromContainer(propsContainer);
    }

    console.log(`[AssetLoader] Extracted ${this.buildingModels.length} buildings, ${this.carModels.length} cars from CityPack`);
  }

  /**
   * Extract vehicles from the Vehicles container (has subcategories: Cars, Buses, Trucks, etc.)
   */
  private extractVehiclesFromContainer(container: THREE.Object3D): void {
    const vehicleCategories = ['Cars', 'Pickups', 'Trucks', 'Buses', 'Emergency_Vehicles', 'Trams'];

    // Debug: log what's in the Vehicles container
    const childNames = container.children.map(c => c.name);
    console.log(`[AssetLoader] Vehicles container children (${childNames.length}):`, childNames.slice(0, 10));

    for (const child of container.children) {
      // Check if this is a vehicle category container
      if (vehicleCategories.includes(child.name)) {
        console.log(`[AssetLoader] Found vehicle category: ${child.name} with ${child.children.length} children`);
        for (const vehicle of child.children) {
          this.extractAndAddModel(vehicle, 'car');
        }
      } else if (child.children.length > 0) {
        // Could be a nested category with different naming
        console.log(`[AssetLoader] Checking nested container: ${child.name} with ${child.children.length} children`);
        // Recursively extract from nested containers
        this.extractVehiclesFromContainer(child);
      } else {
        // Direct vehicle model
        console.log(`[AssetLoader] Direct vehicle: ${child.name}`);
        this.extractAndAddModel(child, 'car');
      }
    }
  }

  /**
   * Extract props from the Props container (trees removed - not used)
   */
  private extractPropsFromContainer(_container: THREE.Object3D): void {
    // Props extraction disabled - was loading 20MB of unused tree models
    // Could be re-enabled for other props like lights, hydrants, etc.
  }

  /**
   * Extract a single model and add to appropriate collection
   */
  private extractAndAddModel(object: THREE.Object3D, type: 'building' | 'car'): void {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());

    // Skip invalid objects
    if (size.x < 0.1 || size.y < 0.1 || size.z < 0.1) return;

    switch (type) {
      case 'building':
        this.addBuildingModel(object, box, size);
        break;
      case 'car':
        this.addCarModel(object, box, size);
        break;
    }
  }

  private addBuildingModel(child: THREE.Object3D, box: THREE.Box3, size: THREE.Vector3): void {
    const cloned = child.clone();

    // Reset position to origin, keeping the model's internal structure
    const center = box.getCenter(new THREE.Vector3());
    cloned.position.set(-center.x, -box.min.y, -center.z); // Bottom at y=0, centered on x/z

    const group = new THREE.Group();
    group.add(cloned);

    // Enable shadows
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });

    const buildingName = child.name || `building_${this.buildingModels.length}`;
    console.log(`[AssetLoader] Added building: ${buildingName} (W:${size.x.toFixed(1)} x D:${size.z.toFixed(1)} x H:${size.y.toFixed(1)})`);

    this.buildingModels.push({
      mesh: group,
      width: size.x,
      depth: size.z,
      height: size.y,
      name: buildingName,
    });
  }

  private addCarModel(child: THREE.Object3D, box: THREE.Box3, size: THREE.Vector3): void {
    const cloned = child.clone();
    const center = box.getCenter(new THREE.Vector3());
    cloned.position.set(-center.x, -box.min.y, -center.z);

    const group = new THREE.Group();
    group.add(cloned);

    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });

    this.carModels.push(group);
    console.log(`[AssetLoader] Added car: ${child.name} (${size.x.toFixed(1)}x${size.y.toFixed(1)}x${size.z.toFixed(1)})`);
  }

  /**
   * Get a random building model that fits the given dimensions
   */
  public getRandomBuildingModel(targetWidth: number, targetDepth: number, _targetHeight: number): BuildingModel | null {
    if (this.buildingModels.length === 0) return null;

    // Find buildings that roughly match the target size
    const candidates = this.buildingModels.filter(b => {
      // Allow some flexibility in matching
      const widthRatio = targetWidth / b.width;
      const depthRatio = targetDepth / b.depth;
      return widthRatio > 0.3 && widthRatio < 3 && depthRatio > 0.3 && depthRatio < 3;
    });

    // If no good matches, use any building
    const pool = candidates.length > 0 ? candidates : this.buildingModels;
    const randomIndex = Math.floor(Math.random() * pool.length);
    return pool[randomIndex] ?? null;
  }

  /**
   * Get all building models
   */
  public getAllBuildingModels(): BuildingModel[] {
    return this.buildingModels;
  }

  /**
   * Get a random car model
   */
  public getRandomCarModel(): THREE.Group | null {
    if (this.carModels.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * this.carModels.length);
    return this.carModels[randomIndex]?.clone() ?? null;
  }

  /**
   * Check if CityPack assets are available
   */
  public hasCityPackAssets(): boolean {
    return this.buildingModels.length > 0;
  }
}

/**
 * Get the global asset loader instance
 */
export function getAssetLoader(): AssetLoader {
  return AssetLoader.getInstance();
}
