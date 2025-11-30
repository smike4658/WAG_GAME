import * as THREE from 'three';
import {
  createRandomTree,
  createBench,
  createLamppost,
  createTrashBin,
  createFountain,
} from '../components/Props';

/**
 * Mark an object for cylinder collision registration
 */
function markForCylinderCollision(obj: THREE.Object3D, radius: number): void {
  obj.userData.collidable = true;
  obj.userData.colliderType = 'cylinder';
  obj.userData.colliderRadius = radius;
}

/**
 * Create a park block - green space with paths, trees, benches
 */
export function createParkBlock(blockSize: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'park_block';

  const innerSize = blockSize - 6;

  // Grass base
  const grassGeo = new THREE.PlaneGeometry(innerSize, innerSize);
  const grassMat = new THREE.MeshLambertMaterial({ color: 0x4a8c4e });
  const grass = new THREE.Mesh(grassGeo, grassMat);
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = 0.01;
  group.add(grass);

  // Paved paths (X pattern through the park)
  const pathWidth = 3;
  const pathMat = new THREE.MeshLambertMaterial({ color: 0x999999 });

  // Diagonal path 1 (NW to SE)
  const pathLength = innerSize * 1.4;
  const path1Geo = new THREE.PlaneGeometry(pathWidth, pathLength);
  const path1 = new THREE.Mesh(path1Geo, pathMat);
  path1.rotation.x = -Math.PI / 2;
  path1.rotation.z = Math.PI / 4;
  path1.position.y = 0.02;
  group.add(path1);

  // Diagonal path 2 (NE to SW)
  const path2 = new THREE.Mesh(path1Geo, pathMat);
  path2.rotation.x = -Math.PI / 2;
  path2.rotation.z = -Math.PI / 4;
  path2.position.y = 0.02;
  group.add(path2);

  // Central circle (fountain area)
  const circleGeo = new THREE.CircleGeometry(6, 32);
  const circle = new THREE.Mesh(circleGeo, pathMat);
  circle.rotation.x = -Math.PI / 2;
  circle.position.y = 0.025;
  group.add(circle);

  // Fountain in center
  const fountain = createFountain();
  fountain.position.set(0, 0, 0);
  group.add(fountain);

  // Trees around edges
  const treePositions = [
    { x: -innerSize / 3, z: -innerSize / 3 },
    { x: innerSize / 3, z: -innerSize / 3 },
    { x: -innerSize / 3, z: innerSize / 3 },
    { x: innerSize / 3, z: innerSize / 3 },
    { x: -innerSize / 2.5, z: 0 },
    { x: innerSize / 2.5, z: 0 },
    { x: 0, z: -innerSize / 2.5 },
    { x: 0, z: innerSize / 2.5 },
  ];

  treePositions.forEach(pos => {
    const tree = createRandomTree();
    tree.position.set(pos.x, 0, pos.z);
    group.add(tree);
    markForCylinderCollision(tree, 0.5);
  });

  // Benches along paths
  const benchPositions = [
    { x: -8, z: -8, rot: Math.PI / 4 },
    { x: 8, z: -8, rot: -Math.PI / 4 },
    { x: -8, z: 8, rot: -Math.PI / 4 + Math.PI },
    { x: 8, z: 8, rot: Math.PI / 4 + Math.PI },
  ];

  benchPositions.forEach(pos => {
    const bench = createBench();
    bench.position.set(pos.x, 0, pos.z);
    bench.rotation.y = pos.rot;
    group.add(bench);
  });

  // Lampposts at corners
  const lampPositions = [
    { x: -innerSize / 2 + 3, z: -innerSize / 2 + 3 },
    { x: innerSize / 2 - 3, z: -innerSize / 2 + 3 },
    { x: -innerSize / 2 + 3, z: innerSize / 2 - 3 },
    { x: innerSize / 2 - 3, z: innerSize / 2 - 3 },
  ];

  lampPositions.forEach(pos => {
    const lamp = createLamppost();
    lamp.position.set(pos.x, 0, pos.z);
    group.add(lamp);
  });

  // Trash bins
  const binPositions = [
    { x: -5, z: 10 },
    { x: 10, z: -5 },
  ];

  binPositions.forEach(pos => {
    const bin = createTrashBin();
    bin.position.set(pos.x, 0, pos.z);
    group.add(bin);
  });

  return group;
}
