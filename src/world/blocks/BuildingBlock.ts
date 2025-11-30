import * as THREE from 'three';
import {
  createHouse,
  createApartmentBlock,
  createSkyscraper,
  createShop,
  createOffice,
  createWarehouse,
} from '../components/Buildings';
import { createRandomTree, createBench, createTrashBin } from '../components/Props';

/**
 * Building block configuration
 */
interface BuildingBlockConfig {
  blockSize: number;
  sidewalkWidth: number;
  district: 'commercial' | 'residential' | 'mixed';
}

/**
 * Building definition for placement
 */
interface BuildingDef {
  width: number;
  depth: number;
  create: () => THREE.Group;
}

/**
 * Mark an object for box collision registration
 */
function markForBoxCollision(obj: THREE.Object3D): void {
  obj.userData.collidable = true;
  obj.userData.colliderType = 'box';
}

/**
 * Mark an object for cylinder collision registration
 */
function markForCylinderCollision(obj: THREE.Object3D, radius: number): void {
  obj.userData.collidable = true;
  obj.userData.colliderType = 'cylinder';
  obj.userData.colliderRadius = radius;
}

/**
 * Get building definitions for a district
 */
function getBuildingsForDistrict(district: 'commercial' | 'residential' | 'mixed'): BuildingDef[] {
  switch (district) {
    case 'commercial':
      return [
        { width: 12, depth: 10, create: createShop },
        { width: 15, depth: 12, create: createOffice },
        { width: 18, depth: 15, create: createSkyscraper },
        { width: 14, depth: 12, create: createShop },
        { width: 20, depth: 15, create: createWarehouse },
      ];
    case 'residential':
      return [
        { width: 10, depth: 8, create: createHouse },
        { width: 12, depth: 10, create: createHouse },
        { width: 15, depth: 12, create: createApartmentBlock },
        { width: 14, depth: 10, create: createApartmentBlock },
        { width: 10, depth: 8, create: createShop },
      ];
    case 'mixed':
    default:
      return [
        { width: 12, depth: 10, create: createShop },
        { width: 14, depth: 12, create: createApartmentBlock },
        { width: 15, depth: 12, create: createOffice },
        { width: 10, depth: 8, create: createHouse },
        { width: 16, depth: 14, create: createApartmentBlock },
      ];
  }
}

/**
 * Pick a random building from the list
 */
function pickRandomBuilding(buildings: BuildingDef[]): BuildingDef {
  const index = Math.floor(Math.random() * buildings.length);
  return buildings[index] as BuildingDef;
}

/**
 * Create a building block - buildings line all 4 edges facing the streets
 * Objects are marked for collision, registration happens later
 */
export function createBuildingBlock(
  config: BuildingBlockConfig
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'building_block';

  const { blockSize, sidewalkWidth, district } = config;
  const buildingDefs = getBuildingsForDistrict(district);

  // Inner area where buildings go (inside sidewalks)
  const innerSize = blockSize - sidewalkWidth * 2;
  const buildingSetback = 1; // Small gap from sidewalk edge

  // Place buildings along each edge
  placeEdgeBuildings(group, buildingDefs, innerSize, 'north', blockSize, sidewalkWidth, buildingSetback);
  placeEdgeBuildings(group, buildingDefs, innerSize, 'south', blockSize, sidewalkWidth, buildingSetback);
  placeEdgeBuildings(group, buildingDefs, innerSize, 'east', blockSize, sidewalkWidth, buildingSetback);
  placeEdgeBuildings(group, buildingDefs, innerSize, 'west', blockSize, sidewalkWidth, buildingSetback);

  // Add courtyard in center (grass with occasional tree/bench)
  const courtyardSize = innerSize - 20;
  if (courtyardSize > 10) {
    createCourtyard(group, courtyardSize);
  }

  return group;
}

/**
 * Place buildings along one edge of the block
 */
function placeEdgeBuildings(
  group: THREE.Group,
  buildingDefs: BuildingDef[],
  innerSize: number,
  edge: 'north' | 'south' | 'east' | 'west',
  blockSize: number,
  sidewalkWidth: number,
  setback: number
): void {
  const edgeLength = innerSize;
  const gap = 2;
  let cursor = -edgeLength / 2 + 5;

  while (cursor < edgeLength / 2 - 5) {
    const building = pickRandomBuilding(buildingDefs);
    const buildingWidth = building.width + (Math.random() - 0.5) * 4;

    if (cursor + buildingWidth > edgeLength / 2 - 5) break;

    const mesh = building.create();
    const halfBlock = blockSize / 2;
    const buildingPos = cursor + buildingWidth / 2;

    switch (edge) {
      case 'north':
        mesh.position.set(buildingPos, 0, -halfBlock + sidewalkWidth + setback + building.depth / 2);
        mesh.rotation.y = Math.PI;
        break;
      case 'south':
        mesh.position.set(buildingPos, 0, halfBlock - sidewalkWidth - setback - building.depth / 2);
        mesh.rotation.y = 0;
        break;
      case 'east':
        mesh.position.set(halfBlock - sidewalkWidth - setback - building.depth / 2, 0, buildingPos);
        mesh.rotation.y = -Math.PI / 2;
        break;
      case 'west':
        mesh.position.set(-halfBlock + sidewalkWidth + setback + building.depth / 2, 0, buildingPos);
        mesh.rotation.y = Math.PI / 2;
        break;
    }

    group.add(mesh);
    markForBoxCollision(mesh);

    cursor += buildingWidth + gap;
  }
}

/**
 * Create a small courtyard in the center of the block
 */
function createCourtyard(group: THREE.Group, size: number): void {
  // Grass ground
  const grassGeo = new THREE.PlaneGeometry(size, size);
  const grassMat = new THREE.MeshLambertMaterial({ color: 0x4a7c4e });
  const grass = new THREE.Mesh(grassGeo, grassMat);
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = 0.02;
  group.add(grass);

  // Occasional tree in center
  if (Math.random() > 0.5) {
    const tree = createRandomTree();
    tree.position.set(0, 0, 0);
    group.add(tree);
    markForCylinderCollision(tree, 0.5);
  }

  // Maybe a bench
  if (Math.random() > 0.6) {
    const bench = createBench();
    bench.position.set(size / 4, 0, 0);
    bench.rotation.y = Math.PI / 2;
    group.add(bench);
  }

  // Maybe a trash bin
  if (Math.random() > 0.7) {
    const bin = createTrashBin();
    bin.position.set(-size / 4, 0, size / 4);
    group.add(bin);
  }
}
