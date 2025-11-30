import * as THREE from 'three';
import { createBench, createRandomTree, createTrashBin } from '../components/Props';

/**
 * Mark an object for cylinder collision registration
 */
function markForCylinderCollision(obj: THREE.Object3D, radius: number): void {
  obj.userData.collidable = true;
  obj.userData.colliderType = 'cylinder';
  obj.userData.colliderRadius = radius;
}

/**
 * Create a swing set
 */
function createSwingSet(): THREE.Group {
  const group = new THREE.Group();
  const metalMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
  const frameGeo = new THREE.CylinderGeometry(0.08, 0.08, 3);

  // Left A-frame
  const leftPole1 = new THREE.Mesh(frameGeo, metalMat);
  leftPole1.position.set(-2, 1.5, 0.5);
  leftPole1.rotation.x = 0.15;
  group.add(leftPole1);

  const leftPole2 = new THREE.Mesh(frameGeo, metalMat);
  leftPole2.position.set(-2, 1.5, -0.5);
  leftPole2.rotation.x = -0.15;
  group.add(leftPole2);

  // Right A-frame
  const rightPole1 = new THREE.Mesh(frameGeo, metalMat);
  rightPole1.position.set(2, 1.5, 0.5);
  rightPole1.rotation.x = 0.15;
  group.add(rightPole1);

  const rightPole2 = new THREE.Mesh(frameGeo, metalMat);
  rightPole2.position.set(2, 1.5, -0.5);
  rightPole2.rotation.x = -0.15;
  group.add(rightPole2);

  // Top bar
  const topBar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 4.5),
    metalMat
  );
  topBar.position.set(0, 3, 0);
  topBar.rotation.z = Math.PI / 2;
  group.add(topBar);

  // Swings
  const chainMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
  const seatMat = new THREE.MeshLambertMaterial({ color: 0x222222 });

  for (let i = -1; i <= 1; i += 2) {
    const chainGeo = new THREE.CylinderGeometry(0.02, 0.02, 2);
    const chain1 = new THREE.Mesh(chainGeo, chainMat);
    chain1.position.set(i * 0.8 - 0.2, 2, 0);
    group.add(chain1);

    const chain2 = new THREE.Mesh(chainGeo, chainMat);
    chain2.position.set(i * 0.8 + 0.2, 2, 0);
    group.add(chain2);

    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.05, 0.3),
      seatMat
    );
    seat.position.set(i * 0.8, 1, 0);
    group.add(seat);
  }

  return group;
}

/**
 * Create a slide
 */
function createSlide(): THREE.Group {
  const group = new THREE.Group();
  const metalMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
  const ladderHeight = 2.5;

  // Ladder poles
  const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, ladderHeight);
  const pole1 = new THREE.Mesh(poleGeo, metalMat);
  pole1.position.set(-0.3, ladderHeight / 2, -1);
  group.add(pole1);

  const pole2 = new THREE.Mesh(poleGeo, metalMat);
  pole2.position.set(0.3, ladderHeight / 2, -1);
  group.add(pole2);

  // Rungs
  const rungGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.6);
  for (let i = 0; i < 5; i++) {
    const rung = new THREE.Mesh(rungGeo, metalMat);
    rung.position.set(0, 0.5 + i * 0.5, -1);
    rung.rotation.z = Math.PI / 2;
    group.add(rung);
  }

  // Platform
  const platformMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.1, 1),
    platformMat
  );
  platform.position.set(0, ladderHeight, -0.5);
  group.add(platform);

  // Slide surface
  const slideMat = new THREE.MeshLambertMaterial({ color: 0xffcc00 });
  const slideGeo = new THREE.BoxGeometry(0.8, 0.05, 3);
  const slide = new THREE.Mesh(slideGeo, slideMat);
  slide.position.set(0, ladderHeight / 2, 1);
  slide.rotation.x = Math.PI / 6;
  group.add(slide);

  // Slide rails
  const railGeo = new THREE.BoxGeometry(0.05, 0.2, 3.2);
  const leftRail = new THREE.Mesh(railGeo, metalMat);
  leftRail.position.set(-0.45, ladderHeight / 2 + 0.1, 1);
  leftRail.rotation.x = Math.PI / 6;
  group.add(leftRail);

  const rightRail = new THREE.Mesh(railGeo, metalMat);
  rightRail.position.set(0.45, ladderHeight / 2 + 0.1, 1);
  rightRail.rotation.x = Math.PI / 6;
  group.add(rightRail);

  return group;
}

/**
 * Create a playground block
 */
export function createPlaygroundBlock(blockSize: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'playground_block';

  const innerSize = blockSize - 6;

  // Grass base
  const grassGeo = new THREE.PlaneGeometry(innerSize, innerSize);
  const grassMat = new THREE.MeshLambertMaterial({ color: 0x4a8c4e });
  const grass = new THREE.Mesh(grassGeo, grassMat);
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = 0.01;
  group.add(grass);

  // Sand pit area
  const sandGeo = new THREE.CircleGeometry(12, 32);
  const sandMat = new THREE.MeshLambertMaterial({ color: 0xdec89a });
  const sand = new THREE.Mesh(sandGeo, sandMat);
  sand.rotation.x = -Math.PI / 2;
  sand.position.y = 0.02;
  group.add(sand);

  // Swing set
  const swings = createSwingSet();
  swings.position.set(-8, 0, -8);
  group.add(swings);

  // Slide
  const slide = createSlide();
  slide.position.set(8, 0, -5);
  slide.rotation.y = Math.PI / 4;
  group.add(slide);

  // Small fence around playground
  const fenceMat = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
  const fenceHeight = 0.8;
  const fenceThickness = 0.1;

  const fenceSegments = [
    { x: 0, z: -innerSize / 2 + 2, length: innerSize - 10, rot: 0 },
    { x: -innerSize / 2 + 2, z: 0, length: innerSize - 10, rot: Math.PI / 2 },
    { x: innerSize / 2 - 2, z: 0, length: innerSize - 10, rot: Math.PI / 2 },
    { x: -innerSize / 4, z: innerSize / 2 - 2, length: innerSize / 2 - 5, rot: 0 },
  ];

  fenceSegments.forEach(seg => {
    const fenceGeo = new THREE.BoxGeometry(seg.length, fenceHeight, fenceThickness);
    const fence = new THREE.Mesh(fenceGeo, fenceMat);
    fence.position.set(seg.x, fenceHeight / 2, seg.z);
    fence.rotation.y = seg.rot;
    group.add(fence);
  });

  // Benches for parents
  const benchPositions = [
    { x: innerSize / 2 - 5, z: -innerSize / 2 + 5, rot: -Math.PI / 4 },
    { x: innerSize / 2 - 5, z: innerSize / 2 - 5, rot: -Math.PI / 4 - Math.PI / 2 },
  ];

  benchPositions.forEach(pos => {
    const bench = createBench();
    bench.position.set(pos.x, 0, pos.z);
    bench.rotation.y = pos.rot;
    group.add(bench);
  });

  // Trees around edges
  const treePositions = [
    { x: -innerSize / 2 + 5, z: -innerSize / 2 + 5 },
    { x: -innerSize / 2 + 5, z: innerSize / 2 - 5 },
  ];

  treePositions.forEach(pos => {
    const tree = createRandomTree();
    tree.position.set(pos.x, 0, pos.z);
    group.add(tree);
    markForCylinderCollision(tree, 0.5);
  });

  // Trash bin
  const bin = createTrashBin();
  bin.position.set(innerSize / 2 - 3, 0, 0);
  group.add(bin);

  return group;
}
