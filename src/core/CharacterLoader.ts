import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  EMPLOYEE_ROLES,
  NPC_PACKS,
  type Gender,
  type RoleConfig,
} from '../config/characters';

/**
 * Loaded character model with metadata
 */
export interface LoadedCharacterModel {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
  roleId: string;
  gender: Gender;
}

/**
 * CharacterLoader - Loads and caches character models for employees
 * Singleton pattern for global access
 */
export class CharacterLoader {
  private static instance: CharacterLoader | null = null;

  private readonly loader: GLTFLoader;
  private readonly loadedModels: Map<string, GLTF> = new Map();
  private readonly npcModels: THREE.Group[] = [];
  private initialized = false;
  private loadingPromise: Promise<void> | null = null;

  private constructor() {
    this.loader = new GLTFLoader();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): CharacterLoader {
    if (!CharacterLoader.instance) {
      CharacterLoader.instance = new CharacterLoader();
    }
    return CharacterLoader.instance;
  }

  /**
   * Generate cache key for role+gender combination
   */
  private getCacheKey(roleId: string, gender: Gender): string {
    return `${roleId}_${gender}`;
  }

  /**
   * Initialize and preload all character models
   */
  public async initialize(
    onProgress?: (progress: number, status: string) => void
  ): Promise<void> {
    if (this.initialized) return;
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = this.doInitialize(onProgress);
    await this.loadingPromise;
  }

  private async doInitialize(
    onProgress?: (progress: number, status: string) => void
  ): Promise<void> {
    console.log('[CharacterLoader] Initializing...');

    // Count total models to load
    let totalModels = 0;
    for (const role of EMPLOYEE_ROLES) {
      totalModels += Object.keys(role.models).length;
    }
    totalModels += NPC_PACKS.length;

    let loadedCount = 0;

    // Load employee role models
    for (const role of EMPLOYEE_ROLES) {
      for (const gender of role.genders) {
        const model = role.models[gender];
        if (!model) continue;

        const cacheKey = this.getCacheKey(role.id, gender);
        onProgress?.(
          (loadedCount / totalModels) * 100,
          `Loading ${role.displayName} (${gender})...`
        );

        try {
          console.log(`[CharacterLoader] Loading ${cacheKey} from ${model.path}...`);
          const gltf = await this.loadGLTF(model.path);
          this.processModel(gltf);
          this.loadedModels.set(cacheKey, gltf);
          console.log(`[CharacterLoader] Loaded ${cacheKey} - animations: ${gltf.animations.length}, scene children: ${gltf.scene.children.length}`);
        } catch (error) {
          console.error(`[CharacterLoader] Failed to load ${cacheKey} from ${model.path}:`, error);
        }

        loadedCount++;
      }
    }

    // Load NPC packs
    for (const pack of NPC_PACKS) {
      onProgress?.(
        (loadedCount / totalModels) * 100,
        `Loading NPC pack: ${pack.name}...`
      );

      try {
        const gltf = await this.loadGLTF(pack.path);
        this.processModel(gltf);
        this.extractNPCsFromPack(gltf.scene);
        console.log(`[CharacterLoader] Loaded NPC pack: ${pack.name}`);
      } catch (error) {
        console.warn(`[CharacterLoader] Failed to load NPC pack ${pack.id}:`, error);
      }

      loadedCount++;
    }

    onProgress?.(100, 'Characters loaded');
    this.initialized = true;
    console.log(`[CharacterLoader] Loaded ${this.loadedModels.size} character models, ${this.npcModels.length} NPCs`);
  }

  /**
   * Load a GLTF file
   */
  private loadGLTF(path: string): Promise<GLTF> {
    // Ensure path starts with /
    const fullPath = path.startsWith('/') ? path : `/${path}`;

    return new Promise((resolve, reject) => {
      this.loader.load(
        fullPath,
        (gltf) => resolve(gltf),
        undefined,
        (error) => reject(error)
      );
    });
  }

  /**
   * Process a loaded model (enable shadows, fix materials)
   */
  private processModel(gltf: GLTF): void {
    gltf.scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        // Ensure material is properly set up
        if (child.material instanceof THREE.MeshStandardMaterial) {
          child.material.needsUpdate = true;
        }
      }
    });
  }

  /**
   * Extract individual NPCs from a pack scene
   */
  private extractNPCsFromPack(scene: THREE.Group): void {
    // Some packs have multiple characters as children
    // Try to extract them individually
    const extractedCount = 0;

    scene.traverse((child) => {
      // Look for mesh groups that could be individual characters
      if (child instanceof THREE.Group && child.children.length > 0) {
        const box = new THREE.Box3().setFromObject(child);
        const size = box.getSize(new THREE.Vector3());

        // Character-sized objects (roughly human scale)
        if (size.y > 0.5 && size.y < 5 && size.x < 3 && size.z < 3) {
          const cloned = child.clone();

          // Center and ground the model
          const center = box.getCenter(new THREE.Vector3());
          cloned.position.set(-center.x, -box.min.y, -center.z);

          const group = new THREE.Group();
          group.add(cloned);

          this.npcModels.push(group);
        }
      }
    });

    // If no individual characters found, use the whole scene
    if (extractedCount === 0) {
      const cloned = scene.clone();
      this.npcModels.push(cloned);
    }
  }

  /**
   * Get a character model for a specific role and gender
   * Uses SkeletonUtils.clone() for proper skeleton deep-cloning
   * so animations work correctly on each instance
   */
  public getCharacterModel(roleId: string, gender: Gender): THREE.Group | null {
    const cacheKey = this.getCacheKey(roleId, gender);
    const gltf = this.loadedModels.get(cacheKey);

    if (!gltf) {
      console.warn(`[CharacterLoader] Model not found: ${cacheKey}`);
      return null;
    }

    // Use SkeletonUtils.clone() for proper skeleton cloning
    // Regular clone() shares skeletons which breaks individual animations
    const cloned = SkeletonUtils.clone(gltf.scene) as THREE.Group;
    console.log(`[CharacterLoader] Cloned ${cacheKey} with SkeletonUtils`);
    return cloned;
  }

  /**
   * Get animations for a specific role and gender
   */
  public getCharacterAnimations(roleId: string, gender: Gender): THREE.AnimationClip[] {
    const cacheKey = this.getCacheKey(roleId, gender);
    const gltf = this.loadedModels.get(cacheKey);
    return gltf?.animations || [];
  }

  /**
   * Get a random NPC model
   */
  public getRandomNPCModel(): THREE.Group | null {
    if (this.npcModels.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * this.npcModels.length);
    return this.npcModels[randomIndex]?.clone() ?? null;
  }

  /**
   * Get role configuration by ID
   */
  public getRoleConfig(roleId: string): RoleConfig | undefined {
    return EMPLOYEE_ROLES.find((r) => r.id === roleId);
  }

  /**
   * Get all available roles
   */
  public getAllRoles(): RoleConfig[] {
    return EMPLOYEE_ROLES;
  }

  /**
   * Get a random gender for a role
   */
  public getRandomGenderForRole(roleId: string): Gender {
    const role = this.getRoleConfig(roleId);
    if (!role) return 'male';

    const genders = role.genders;
    const randomGender = genders[Math.floor(Math.random() * genders.length)];
    return randomGender ?? 'male';
  }

  /**
   * Check if loader is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get number of loaded models
   */
  public getLoadedCount(): number {
    return this.loadedModels.size;
  }
}

/**
 * Get the global character loader instance
 */
export function getCharacterLoader(): CharacterLoader {
  return CharacterLoader.getInstance();
}
