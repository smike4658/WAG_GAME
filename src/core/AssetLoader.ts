import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Asset types available in the game
 * Removed unused assets:
 * - tree (20MB, never used)
 * - character (CharacterLoader handles this)
 * - building (23MB, StaticCity loads its own model)
 * - citypack (2.5MB, not used by StaticCity)
 */
export type AssetType = 'car';

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
 * Only loading car models (0.8MB) - used as fallback for traffic
 * StaticCity loads its own city model directly
 */
const ASSET_CONFIGS: Record<AssetType, AssetConfig> = {
  car: {
    path: '/assets/models/cars/cars.glb',
    scale: 0.8,
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
  // Kept for ProceduralCity API compatibility (always empty now)
  private readonly buildingModels: BuildingModel[] = [];
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
   * Get a random car model (delegates to getRandomMesh for 'car' type)
   */
  public getRandomCarModel(): THREE.Group | null {
    return this.getRandomMesh('car');
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
