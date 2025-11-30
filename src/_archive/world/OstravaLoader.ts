import * as THREE from 'three';
import { OverpassFetcher } from './OverpassFetcher';
import { BuildingExtruder } from './BuildingExtruder';
import { RoadGenerator } from './RoadGenerator';
import { StreetFurniture } from './StreetFurniture';
import { CoordinateConverter } from './CoordinateConverter';
import type { OSMElement, LocalCoordinate, TreeData, POIData } from './types';

/**
 * Main loader for the Ostrava game world
 * Orchestrates fetching OSM data and converting it to 3D geometry
 */
export class OstravaLoader {
  private readonly fetcher: OverpassFetcher;
  private readonly buildingExtruder: BuildingExtruder;
  private readonly roadGenerator: RoadGenerator;
  private readonly streetFurniture: StreetFurniture;
  private readonly converter: CoordinateConverter;

  private readonly worldGroup: THREE.Group;
  private trees: TreeData[] = [];
  private pois: POIData[] = [];

  constructor() {
    this.fetcher = new OverpassFetcher();
    this.buildingExtruder = new BuildingExtruder();
    this.roadGenerator = new RoadGenerator();
    this.streetFurniture = new StreetFurniture();
    this.converter = new CoordinateConverter();

    this.worldGroup = new THREE.Group();
    this.worldGroup.name = 'ostrava-world';
  }

  /**
   * Load the complete Ostrava world from OSM data
   */
  public async load(): Promise<THREE.Group> {
    console.log('[OstravaLoader] Starting world load...');

    // Create ground first
    this.createGround();

    try {
      // Fetch OSM data
      const osmData = await this.fetcher.fetchAll();

      // Process buildings
      console.log('[OstravaLoader] Processing buildings...');
      const buildingsGroup = this.buildingExtruder.processElements(osmData.elements);
      this.worldGroup.add(buildingsGroup);

      // Process roads
      console.log('[OstravaLoader] Processing roads...');
      const roadsGroup = this.roadGenerator.processElements(osmData.elements);
      this.worldGroup.add(roadsGroup);

      // Process trees
      console.log('[OstravaLoader] Processing trees...');
      this.processTrees(osmData.elements);

      // Process POIs
      console.log('[OstravaLoader] Processing points of interest...');
      this.processPOIs(osmData.elements);

      // Process street furniture (lamps, benches, tram stops)
      console.log('[OstravaLoader] Processing street furniture...');
      const furnitureGroup = this.streetFurniture.processElements(osmData.elements);
      this.worldGroup.add(furnitureGroup);

      // Add player spawn marker
      this.addSpawnMarker();

      console.log('[OstravaLoader] World load complete!');
    } catch (error) {
      console.error('[OstravaLoader] Failed to load OSM data:', error);
      console.log('[OstravaLoader] Falling back to placeholder world');
      this.createPlaceholderWorld();
    }

    return this.worldGroup;
  }

  /**
   * Create the ground plane
   */
  private createGround(): void {
    const bounds = this.converter.getLocalBounds();
    const width = bounds.maxX - bounds.minX + 100; // Add margin
    const height = bounds.maxZ - bounds.minZ + 100;

    const groundGeometry = new THREE.PlaneGeometry(width, height);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x5d8a66, // Grass green
      roughness: 0.9,
      metalness: 0.0,
    });

    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(
      (bounds.minX + bounds.maxX) / 2,
      -0.02, // Slightly below y=0 so roads are clearly above
      (bounds.minZ + bounds.maxZ) / 2
    );
    ground.receiveShadow = true;
    ground.name = 'ground';

    this.worldGroup.add(ground);
  }

  /**
   * Process tree nodes and create tree markers
   */
  private processTrees(elements: OSMElement[]): void {
    const treeNodes = elements.filter(
      (el) => el.type === 'node' && el.tags?.['natural'] === 'tree'
    );

    console.log(`[OstravaLoader] Found ${treeNodes.length} trees`);

    const treesGroup = new THREE.Group();
    treesGroup.name = 'trees';

    for (const tree of treeNodes) {
      if (tree.lat === undefined || tree.lon === undefined) continue;

      const local = this.converter.toLocal(tree.lat, tree.lon);
      this.trees.push({ position: local });

      // Create simple tree placeholder (cone + cylinder)
      const treeMesh = this.createSimpleTree();
      treeMesh.position.set(local.x, 0, local.z);
      treesGroup.add(treeMesh);
    }

    this.worldGroup.add(treesGroup);
  }

  /**
   * Create a simple low-poly tree
   */
  private createSimpleTree(): THREE.Group {
    const tree = new THREE.Group();

    // Trunk
    const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, 2, 6);
    const trunkMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b4513,
      roughness: 0.9,
      flatShading: true,
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
      flatShading: true,
    });
    const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
    foliage.position.y = 4;
    foliage.castShadow = true;
    tree.add(foliage);

    return tree;
  }

  /**
   * Process points of interest (historic monuments, amenities)
   */
  private processPOIs(elements: OSMElement[]): void {
    // Find historic monuments (like Masaryk statue)
    const historic = elements.filter(
      (el) => el.type === 'node' && el.tags?.['historic']
    );

    for (const poi of historic) {
      if (poi.lat === undefined || poi.lon === undefined) continue;

      const local = this.converter.toLocal(poi.lat, poi.lon);
      const name = poi.tags?.['name'] ?? poi.tags?.['historic'] ?? 'Unknown';

      this.pois.push({
        name,
        position: local,
        type: 'landmark',
      });

      // Check if this might be the Masaryk statue (spawn point)
      const poiName = name.toLowerCase();
      if (poiName.includes('masaryk') || poiName.includes('pomník')) {
        this.pois.push({
          name: 'Player Spawn',
          position: local,
          type: 'spawn',
        });
      }
    }

    console.log(`[OstravaLoader] Found ${this.pois.length} POIs`);
  }

  /**
   * Add a visual marker at the player spawn point
   */
  private addSpawnMarker(): void {
    // Default spawn at center (0, 0) which is Masaryk statue location
    const spawnPosition = { x: 0, z: 0 };

    // Check if we found a spawn POI
    const spawnPOI = this.pois.find((p) => p.type === 'spawn');
    if (spawnPOI) {
      spawnPosition.x = spawnPOI.position.x;
      spawnPosition.z = spawnPOI.position.z;
    }

    // Create spawn marker (simple pedestal)
    const pedestalGeometry = new THREE.CylinderGeometry(1, 1.2, 0.5, 8);
    const pedestalMaterial = new THREE.MeshStandardMaterial({
      color: 0x808080,
      roughness: 0.7,
      metalness: 0.2,
    });
    const pedestal = new THREE.Mesh(pedestalGeometry, pedestalMaterial);
    pedestal.position.set(spawnPosition.x, 0.25, spawnPosition.z);
    pedestal.castShadow = true;
    pedestal.receiveShadow = true;
    pedestal.name = 'spawn-marker';

    this.worldGroup.add(pedestal);
  }

  /**
   * Create placeholder world if OSM fetch fails
   */
  private createPlaceholderWorld(): void {
    console.log('[OstravaLoader] Creating placeholder buildings...');

    const buildingsGroup = new THREE.Group();
    buildingsGroup.name = 'placeholder-buildings';

    const colors = [0xe8d4b8, 0xd4a574, 0xf5b7b1, 0x7fb3d5, 0xfad7a0];

    for (let i = 0; i < 30; i++) {
      const width = 15 + Math.random() * 20;
      const depth = 15 + Math.random() * 20;
      const height = 10 + Math.random() * 25;

      const geometry = new THREE.BoxGeometry(width, height, depth);
      const colorIndex = Math.floor(Math.random() * colors.length);
      const color = colors[colorIndex] ?? 0xe5e7e9;
      const material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.8,
        metalness: 0.1,
        flatShading: true,
      });

      const building = new THREE.Mesh(geometry, material);
      building.position.set(
        (Math.random() - 0.5) * 300,
        height / 2,
        (Math.random() - 0.5) * 300
      );
      building.castShadow = true;
      building.receiveShadow = true;

      buildingsGroup.add(building);
    }

    this.worldGroup.add(buildingsGroup);
  }

  /**
   * Get the world group for adding to scene
   */
  public getGroup(): THREE.Group {
    return this.worldGroup;
  }

  /**
   * Get player spawn position
   */
  public getSpawnPosition(): LocalCoordinate {
    const spawnPOI = this.pois.find((p) => p.type === 'spawn');
    return spawnPOI?.position ?? { x: 0, z: 0 };
  }

  /**
   * Get all POIs for minimap
   */
  public getPOIs(): POIData[] {
    return this.pois;
  }

  /**
   * Get tree positions for placing 3D tree models
   */
  public getTrees(): TreeData[] {
    return this.trees;
  }

  /**
   * Get map bounds in local coordinates
   */
  public getBounds(): { minX: number; maxX: number; minZ: number; maxZ: number } {
    return this.converter.getLocalBounds();
  }
}
