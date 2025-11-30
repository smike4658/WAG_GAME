import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Role-based colors for visual distinction of employees
 */
export const ROLE_COLORS: Record<string, number> = {
  'frontend-developer': 0x61DAFB,  // React blue
  'backend-developer': 0x68A063,   // Node green
  'ui-ux-designer': 0xE91E63,      // Pink
  'qa-tester': 0xFF9800,           // Orange
  'business-analyst': 0x2196F3,    // Blue
  'product-owner': 0x4CAF50,       // Green
  'devops': 0x9C27B0,              // Purple
  'scrum-master': 0xFFFFFF,        // White
  'default': 0x607D8B,             // Gray
};

/**
 * Individual NPC model extracted from the pack
 */
export interface NPCModel {
  id: string;
  mesh: THREE.Group;
  originalName: string;
}

/**
 * LowpolyNPCLoader - Loads and manages the 8 lowpoly people models
 * Extracts individual characters from the pack and applies role-based coloring
 */
export class LowpolyNPCLoader {
  private static instance: LowpolyNPCLoader | null = null;

  private readonly loader: GLTFLoader;
  private readonly npcModels: NPCModel[] = [];
  private initialized = false;
  private loadingPromise: Promise<void> | null = null;

  private static readonly NPC_PACK_PATH = '/models/characters/npc/lowpoly-people-pack_extracted/scene.gltf';
  private static readonly NPC_NAMES = [
    'SM_People_Lowpoly_01',
    'SM_People_Lowpoly_02',
    'SM_People_Lowpoly_03',
    'SM_People_Lowpoly_04',
    'SM_People_Lowpoly_05',
    'SM_People_Lowpoly_06',
    'SM_People_Lowpoly_07',
    'SM_People_Lowpoly_08',
  ];

  private constructor() {
    this.loader = new GLTFLoader();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): LowpolyNPCLoader {
    if (!LowpolyNPCLoader.instance) {
      LowpolyNPCLoader.instance = new LowpolyNPCLoader();
    }
    return LowpolyNPCLoader.instance;
  }

  /**
   * Initialize and load the NPC pack
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
    console.log('[LowpolyNPCLoader] Loading NPC pack...');
    onProgress?.(0, 'Loading lowpoly people pack...');

    try {
      const gltf = await this.loadGLTF(LowpolyNPCLoader.NPC_PACK_PATH);
      onProgress?.(50, 'Extracting individual characters...');

      this.extractIndividualNPCs(gltf.scene);

      onProgress?.(100, `Loaded ${this.npcModels.length} NPC models`);
      this.initialized = true;

      console.log(`[LowpolyNPCLoader] Extracted ${this.npcModels.length} individual NPCs`);
    } catch (error) {
      console.error('[LowpolyNPCLoader] Failed to load NPC pack:', error);
      throw error;
    }
  }

  /**
   * Load GLTF file
   */
  private loadGLTF(path: string): Promise<GLTF> {
    return new Promise((resolve, reject) => {
      this.loader.load(
        path,
        (gltf) => resolve(gltf),
        undefined,
        (error) => reject(error)
      );
    });
  }

  /**
   * Extract individual NPC characters from the loaded scene
   */
  private extractIndividualNPCs(scene: THREE.Group): void {
    // Find each named NPC group
    for (const npcName of LowpolyNPCLoader.NPC_NAMES) {
      let foundNode: THREE.Object3D | null = null;

      scene.traverse((child) => {
        if (child.name === npcName) {
          foundNode = child;
        }
      });

      if (foundNode) {
        // Clone the node and its children
        const clonedGroup = new THREE.Group();
        clonedGroup.name = npcName;

        // Clone all mesh children
        (foundNode as THREE.Object3D).traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const clonedMesh = child.clone();
            // Clone material to allow individual coloring
            if (Array.isArray(child.material)) {
              clonedMesh.material = child.material.map(m => m.clone());
            } else {
              clonedMesh.material = child.material.clone();
            }
            clonedMesh.castShadow = true;
            clonedMesh.receiveShadow = true;
            clonedGroup.add(clonedMesh);
          }
        });

        // Calculate bounds and normalize
        const box = new THREE.Box3().setFromObject(clonedGroup);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        // Target height ~1.7m (human scale)
        const targetHeight = 1.7;
        const scale = targetHeight / size.y;

        // Create wrapper group for proper positioning
        const wrapper = new THREE.Group();
        wrapper.name = `${npcName}_wrapper`;

        // Scale and position the character
        clonedGroup.scale.set(scale, scale, scale);
        clonedGroup.position.set(
          -center.x * scale,
          -box.min.y * scale,
          -center.z * scale
        );

        wrapper.add(clonedGroup);

        this.npcModels.push({
          id: npcName,
          mesh: wrapper,
          originalName: npcName,
        });

        console.log(`[LowpolyNPCLoader] Extracted ${npcName} (height: ${size.y.toFixed(2)} -> ${targetHeight}m)`);
      } else {
        console.warn(`[LowpolyNPCLoader] NPC ${npcName} not found in scene`);
      }
    }
  }

  /**
   * Get a clone of an NPC model by index (0-7)
   */
  public getNPCModelByIndex(index: number): THREE.Group | null {
    const npc = this.npcModels[index % this.npcModels.length];
    if (!npc) return null;

    return this.cloneNPCModel(npc.mesh);
  }

  /**
   * Get a random NPC model clone
   */
  public getRandomNPCModel(): THREE.Group | null {
    if (this.npcModels.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * this.npcModels.length);
    return this.getNPCModelByIndex(randomIndex);
  }

  /**
   * Get an NPC model clone with role-based coloring
   */
  public getNPCModelForRole(roleId: string, index?: number): THREE.Group | null {
    const modelIndex = index ?? Math.floor(Math.random() * this.npcModels.length);
    const model = this.getNPCModelByIndex(modelIndex);

    if (!model) return null;

    // Apply role-based color
    const color = ROLE_COLORS[roleId] ?? ROLE_COLORS['default'] ?? 0x607D8B;
    this.applyColorToModel(model, color);

    return model;
  }

  /**
   * Clone an NPC model (deep clone with materials)
   */
  private cloneNPCModel(original: THREE.Group): THREE.Group {
    const cloned = original.clone();

    // Deep clone materials
    cloned.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (Array.isArray(child.material)) {
          child.material = child.material.map(m => m.clone());
        } else {
          child.material = child.material.clone();
        }
      }
    });

    return cloned;
  }

  /**
   * Apply a color tint to an NPC model
   */
  public applyColorToModel(model: THREE.Group, color: number): void {
    const colorObj = new THREE.Color(color);

    model.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];

        for (const mat of materials) {
          if (mat instanceof THREE.MeshStandardMaterial) {
            // Apply color as base color tint
            mat.color.copy(colorObj);
            // Add subtle emissive glow for visibility
            mat.emissive.copy(colorObj);
            mat.emissiveIntensity = 0.15;
          } else if (mat instanceof THREE.MeshBasicMaterial) {
            mat.color.copy(colorObj);
          }
        }
      }
    });
  }

  /**
   * Get number of available NPC models
   */
  public getModelCount(): number {
    return this.npcModels.length;
  }

  /**
   * Check if loader is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get all available NPC IDs
   */
  public getAllNPCIds(): string[] {
    return this.npcModels.map(npc => npc.id);
  }
}

/**
 * Get the global LowpolyNPCLoader instance
 */
export function getLowpolyNPCLoader(): LowpolyNPCLoader {
  return LowpolyNPCLoader.getInstance();
}
