import * as THREE from 'three';
import { createTownHall, createChurch } from '../components/Buildings';
import {
  createFountain,
  createStatue,
  createBench,
  createLamppost,
  createRandomTree,
  createTrashBin,
} from '../components/Props';

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
 * Create the central plaza block (takes 2x2 blocks)
 */
export function createPlazaBlock(blockSize: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'plaza_block';

  const plazaSize = blockSize * 2 - 12;

  // Cobblestone plaza surface
  const stoneGeo = new THREE.PlaneGeometry(plazaSize, plazaSize);
  const stoneMat = new THREE.MeshLambertMaterial({ color: 0x8b7766 });
  const stone = new THREE.Mesh(stoneGeo, stoneMat);
  stone.rotation.x = -Math.PI / 2;
  stone.position.y = 0.01;
  group.add(stone);

  // Decorative inner circle
  const innerCircleGeo = new THREE.CircleGeometry(25, 64);
  const innerCircleMat = new THREE.MeshLambertMaterial({ color: 0x9a8877 });
  const innerCircle = new THREE.Mesh(innerCircleGeo, innerCircleMat);
  innerCircle.rotation.x = -Math.PI / 2;
  innerCircle.position.y = 0.02;
  group.add(innerCircle);

  // Central fountain
  const fountain = createFountain();
  fountain.position.set(0, 0, 0);
  group.add(fountain);

  // Statue near fountain
  const statue = createStatue();
  statue.position.set(-15, 0, 10);
  group.add(statue);

  // Town Hall on north side (inside the plaza, not on street)
  const townHall = createTownHall();
  townHall.position.set(0, 0, -plazaSize / 2 + 20);
  group.add(townHall);
  markForBoxCollision(townHall);

  // Church on east side (inside the plaza, not on street)
  const church = createChurch();
  church.position.set(plazaSize / 2 - 25, 0, 0);
  church.rotation.y = -Math.PI / 2;
  group.add(church);
  markForBoxCollision(church);

  // Benches around the plaza
  const benchRadius = 20;
  const numBenches = 8;
  for (let i = 0; i < numBenches; i++) {
    const angle = (i / numBenches) * Math.PI * 2;
    const bench = createBench();
    bench.position.set(
      Math.cos(angle) * benchRadius,
      0,
      Math.sin(angle) * benchRadius
    );
    bench.rotation.y = angle + Math.PI / 2;
    group.add(bench);
  }

  // Lampposts around edges (not overlapping buildings)
  const lampPositions = [
    { x: -plazaSize / 3, z: -plazaSize / 3 + 10 },
    { x: plazaSize / 3, z: -plazaSize / 3 + 10 },
    { x: -plazaSize / 3, z: plazaSize / 3 },
    { x: plazaSize / 3 - 15, z: plazaSize / 3 },
    { x: -plazaSize / 2 + 5, z: 0 },
    { x: 0, z: plazaSize / 2 - 5 },
  ];

  lampPositions.forEach(pos => {
    const lamp = createLamppost();
    lamp.position.set(pos.x, 0, pos.z);
    group.add(lamp);
  });

  // Trees around edges (avoiding buildings)
  const treePositions = [
    { x: -plazaSize / 2 + 8, z: -plazaSize / 3 + 10 },
    { x: -plazaSize / 2 + 8, z: plazaSize / 3 },
    { x: -plazaSize / 3, z: plazaSize / 2 - 8 },
    { x: plazaSize / 3 - 15, z: plazaSize / 2 - 8 },
  ];

  treePositions.forEach(pos => {
    const tree = createRandomTree();
    tree.position.set(pos.x, 0, pos.z);
    group.add(tree);
    markForCylinderCollision(tree, 0.5);
  });

  // Trash bins
  const binPositions = [
    { x: -plazaSize / 4, z: plazaSize / 4 },
    { x: plazaSize / 4 - 10, z: -plazaSize / 4 + 10 },
  ];

  binPositions.forEach(pos => {
    const bin = createTrashBin();
    bin.position.set(pos.x, 0, pos.z);
    group.add(bin);
  });

  // Paved walkways
  const pathMat = new THREE.MeshLambertMaterial({ color: 0x999999 });
  const pathWidth = 4;

  // North-South path
  const nsPath = new THREE.Mesh(
    new THREE.PlaneGeometry(pathWidth, plazaSize),
    pathMat
  );
  nsPath.rotation.x = -Math.PI / 2;
  nsPath.position.y = 0.015;
  group.add(nsPath);

  // East-West path
  const ewPath = new THREE.Mesh(
    new THREE.PlaneGeometry(plazaSize, pathWidth),
    pathMat
  );
  ewPath.rotation.x = -Math.PI / 2;
  ewPath.position.y = 0.015;
  group.add(ewPath);

  return group;
}
