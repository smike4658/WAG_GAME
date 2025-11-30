import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Loads the Low Poly City model from Sketchfab
 * Model: "Low Poly City" by diamanti.alessandro
 */
export class CityLoader {
  private readonly gltfLoader: GLTFLoader;
  private readonly cityGroup: THREE.Group;
  private cityBounds: THREE.Box3 | null = null;

  constructor() {
    this.gltfLoader = new GLTFLoader();
    this.cityGroup = new THREE.Group();
    this.cityGroup.name = 'city';
  }

  /**
   * Load the city model
   */
  public async load(
    onProgress?: (progress: number, status: string) => void
  ): Promise<THREE.Group> {
    onProgress?.(10, 'Loading city model...');

    try {
      // Load the Low Poly City model
      const city = await this.loadGLB('/assets/models/low-poly-city.glb');

      onProgress?.(50, 'Processing city...');

      // Get original bounds
      const box = new THREE.Box3().setFromObject(city);
      const size = box.getSize(new THREE.Vector3());

      console.log(`[CityLoader] Original city size: ${size.x.toFixed(1)} x ${size.y.toFixed(1)} x ${size.z.toFixed(1)}`);

      // Scale city to ~300m for good gameplay area
      const targetSize = 300;
      const maxDimension = Math.max(size.x, size.z);
      const scale = targetSize / maxDimension;
      city.scale.setScalar(scale);

      console.log(`[CityLoader] Scaled city by ${scale.toFixed(2)}x`);

      // The model has streets at top and buildings hanging DOWN
      // Flip 180° around X so buildings point UP
      city.rotation.x = Math.PI;

      // Recalculate bounds after scaling and rotation
      box.setFromObject(city);
      const newCenter = box.getCenter(new THREE.Vector3());

      console.log(`[CityLoader] After flip - min.y=${box.min.y.toFixed(1)}, max.y=${box.max.y.toFixed(1)}`);

      // Center horizontally at origin
      city.position.x = -newCenter.x;
      city.position.z = -newCenter.z;

      // After flipping, streets are now at BOTTOM (min.y)
      // Position so streets are at y=0
      box.setFromObject(city);
      city.position.y = -box.min.y;

      // Final bounds check
      box.setFromObject(city);
      console.log(`[CityLoader] Final bounds - min.y=${box.min.y.toFixed(1)}, max.y=${box.max.y.toFixed(1)}`);

      // Enable shadows on all meshes
      city.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;

          // Ensure materials are visible
          if (child.material instanceof THREE.MeshStandardMaterial) {
            child.material.needsUpdate = true;
          }
        }
      });

      this.cityGroup.add(city);

      // Update bounds
      this.cityBounds = new THREE.Box3().setFromObject(city);

      const finalSize = this.cityBounds.getSize(new THREE.Vector3());
      console.log(`[CityLoader] Final city size: ${finalSize.x.toFixed(1)} x ${finalSize.y.toFixed(1)} x ${finalSize.z.toFixed(1)}`);

      onProgress?.(80, 'Adding ground...');

      // Add ground plane extending beyond city
      this.addGroundPlane();

      onProgress?.(100, 'City loaded!');

      console.log('[CityLoader] City loaded successfully!');
      return this.cityGroup;

    } catch (error) {
      console.error('[CityLoader] Failed to load city:', error);
      onProgress?.(50, 'Using fallback city...');
      return this.createFallbackCity();
    }
  }

  /**
   * Load a GLB file
   */
  private loadGLB(path: string): Promise<THREE.Group> {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        path,
        (gltf) => {
          console.log(`[CityLoader] Loaded ${path}`);
          resolve(gltf.scene);
        },
        (progress) => {
          if (progress.total > 0) {
            const percent = (progress.loaded / progress.total) * 100;
            console.log(`[CityLoader] Loading ${path}: ${percent.toFixed(0)}%`);
          }
        },
        (error) => {
          console.error(`[CityLoader] Error loading ${path}:`, error);
          reject(error);
        }
      );
    });
  }

  /**
   * Add ground plane beneath and around city
   */
  private addGroundPlane(): void {
    const size = 800;
    const geometry = new THREE.PlaneGeometry(size, size);
    const material = new THREE.MeshStandardMaterial({
      color: 0x4a7c4e, // Grass green
      roughness: 0.9,
      metalness: 0.0,
    });

    const ground = new THREE.Mesh(geometry, material);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05; // Slightly below city
    ground.receiveShadow = true;
    ground.name = 'ground';

    this.cityGroup.add(ground);
  }

  /**
   * Create fallback city if GLB fails to load
   */
  private createFallbackCity(): THREE.Group {
    console.log('[CityLoader] Creating fallback procedural city...');

    // Create a simple grid of buildings
    const buildingColors = [
      0xe8d4b8, 0xd4a574, 0xf5b7b1, 0x7fb3d5, 0xfad7a0,
      0xc9b896, 0xaed6f1, 0xf9e79f, 0xd7bde2
    ];

    // Buildings grid
    for (let x = -120; x <= 120; x += 30) {
      for (let z = -120; z <= 120; z += 30) {
        // Skip center for plaza
        if (Math.abs(x) < 40 && Math.abs(z) < 40) continue;

        const width = 12 + Math.random() * 12;
        const depth = 12 + Math.random() * 12;
        const height = 8 + Math.random() * 25;

        const geometry = new THREE.BoxGeometry(width, height, depth);
        const colorIndex = Math.floor(Math.random() * buildingColors.length);
        const color = buildingColors[colorIndex] ?? 0xe5e7e9;
        const material = new THREE.MeshStandardMaterial({
          color,
          roughness: 0.8,
          metalness: 0.1,
        });

        const building = new THREE.Mesh(geometry, material);
        building.position.set(x + (Math.random() - 0.5) * 5, height / 2, z + (Math.random() - 0.5) * 5);
        building.castShadow = true;
        building.receiveShadow = true;

        this.cityGroup.add(building);
      }
    }

    // Central plaza
    const plazaGeometry = new THREE.PlaneGeometry(70, 70);
    const plazaMaterial = new THREE.MeshStandardMaterial({
      color: 0xb8a888, // Cobblestone
      roughness: 0.85,
    });
    const plaza = new THREE.Mesh(plazaGeometry, plazaMaterial);
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = 0.02;
    plaza.receiveShadow = true;
    this.cityGroup.add(plaza);

    // Roads
    this.addProceduralRoads();

    // Trees
    this.addProceduralTrees();

    // Ground
    this.addGroundPlane();

    this.cityBounds = new THREE.Box3().setFromObject(this.cityGroup);

    return this.cityGroup;
  }

  /**
   * Add procedural roads to fallback city
   */
  private addProceduralRoads(): void {
    const roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.9,
    });

    // Main roads from center
    const roadWidth = 8;
    const roadLength = 250;

    // North-South road
    const nsRoad = new THREE.Mesh(
      new THREE.PlaneGeometry(roadWidth, roadLength),
      roadMaterial
    );
    nsRoad.rotation.x = -Math.PI / 2;
    nsRoad.position.y = 0.01;
    nsRoad.receiveShadow = true;
    this.cityGroup.add(nsRoad);

    // East-West road
    const ewRoad = new THREE.Mesh(
      new THREE.PlaneGeometry(roadLength, roadWidth),
      roadMaterial
    );
    ewRoad.rotation.x = -Math.PI / 2;
    ewRoad.position.y = 0.01;
    ewRoad.receiveShadow = true;
    this.cityGroup.add(ewRoad);

    // Cross streets
    const crossPositions = [-60, 60];
    for (const pos of crossPositions) {
      const crossRoad1 = new THREE.Mesh(
        new THREE.PlaneGeometry(roadLength, roadWidth * 0.7),
        roadMaterial
      );
      crossRoad1.rotation.x = -Math.PI / 2;
      crossRoad1.position.set(0, 0.01, pos);
      crossRoad1.receiveShadow = true;
      this.cityGroup.add(crossRoad1);

      const crossRoad2 = new THREE.Mesh(
        new THREE.PlaneGeometry(roadWidth * 0.7, roadLength),
        roadMaterial
      );
      crossRoad2.rotation.x = -Math.PI / 2;
      crossRoad2.position.set(pos, 0.01, 0);
      crossRoad2.receiveShadow = true;
      this.cityGroup.add(crossRoad2);
    }
  }

  /**
   * Add procedural trees to fallback city
   */
  private addProceduralTrees(): void {
    const treePositions = [
      // Around plaza
      { x: -30, z: -30 }, { x: 30, z: -30 }, { x: -30, z: 30 }, { x: 30, z: 30 },
      // Along roads
      { x: -15, z: 50 }, { x: 15, z: 50 }, { x: -15, z: -50 }, { x: 15, z: -50 },
      { x: 50, z: -15 }, { x: 50, z: 15 }, { x: -50, z: -15 }, { x: -50, z: 15 },
      // Random in city
      { x: -80, z: -80 }, { x: 80, z: -80 }, { x: -80, z: 80 }, { x: 80, z: 80 },
    ];

    for (const pos of treePositions) {
      const tree = this.createTree();
      tree.position.set(pos.x, 0, pos.z);
      this.cityGroup.add(tree);
    }
  }

  /**
   * Create a simple low-poly tree
   */
  private createTree(): THREE.Group {
    const tree = new THREE.Group();

    // Trunk
    const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, 2, 6);
    const trunkMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b4513,
      roughness: 0.9,
    });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = 1;
    trunk.castShadow = true;
    tree.add(trunk);

    // Foliage (cone)
    const foliageGeometry = new THREE.ConeGeometry(1.5, 4, 6);
    const foliageMaterial = new THREE.MeshStandardMaterial({
      color: 0x228b22,
      roughness: 0.8,
    });
    const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
    foliage.position.y = 4;
    foliage.castShadow = true;
    tree.add(foliage);

    return tree;
  }

  /**
   * Get spawn position (center of city)
   */
  public getSpawnPosition(): THREE.Vector3 {
    return new THREE.Vector3(0, 0, 0);
  }

  /**
   * Get city bounds for spawning entities
   */
  public getBounds(): THREE.Box3 {
    return this.cityBounds ?? new THREE.Box3(
      new THREE.Vector3(-150, 0, -150),
      new THREE.Vector3(150, 50, 150)
    );
  }
}
