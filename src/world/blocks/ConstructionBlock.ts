import * as THREE from 'three';

/**
 * Mark an object for cylinder collision registration
 */
function markForCylinderCollision(obj: THREE.Object3D, radius: number): void {
  obj.userData.collidable = true;
  obj.userData.colliderType = 'cylinder';
  obj.userData.colliderRadius = radius;
}

/**
 * Mark an object for box collision registration
 */
function markForBoxCollision(obj: THREE.Object3D): void {
  obj.userData.collidable = true;
  obj.userData.colliderType = 'box';
}

/**
 * Create a construction crane
 */
function createCrane(): THREE.Group {
  const group = new THREE.Group();
  const metalMat = new THREE.MeshLambertMaterial({ color: 0xffcc00 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x333333 });

  // Base
  const baseGeo = new THREE.BoxGeometry(4, 1, 4);
  const base = new THREE.Mesh(baseGeo, darkMat);
  base.position.y = 0.5;
  group.add(base);

  // Main tower
  const towerHeight = 30;
  const towerGeo = new THREE.BoxGeometry(2, towerHeight, 2);
  const tower = new THREE.Mesh(towerGeo, metalMat);
  tower.position.y = towerHeight / 2 + 1;
  group.add(tower);

  // Cabin
  const cabinGeo = new THREE.BoxGeometry(2.5, 2, 2.5);
  const cabinMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
  const cabin = new THREE.Mesh(cabinGeo, cabinMat);
  cabin.position.y = towerHeight + 2;
  group.add(cabin);

  // Horizontal jib
  const jibLength = 25;
  const jibGeo = new THREE.BoxGeometry(jibLength, 1, 1);
  const jib = new THREE.Mesh(jibGeo, metalMat);
  jib.position.set(jibLength / 2 - 5, towerHeight + 3, 0);
  group.add(jib);

  // Counter-jib
  const counterJibGeo = new THREE.BoxGeometry(8, 1, 1);
  const counterJib = new THREE.Mesh(counterJibGeo, metalMat);
  counterJib.position.set(-6, towerHeight + 3, 0);
  group.add(counterJib);

  // Counterweight
  const weightGeo = new THREE.BoxGeometry(3, 2, 2);
  const weight = new THREE.Mesh(weightGeo, darkMat);
  weight.position.set(-9, towerHeight + 2, 0);
  group.add(weight);

  // Hook cable
  const cableGeo = new THREE.CylinderGeometry(0.05, 0.05, 15);
  const cableMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const cable = new THREE.Mesh(cableGeo, cableMat);
  cable.position.set(12, towerHeight - 5, 0);
  group.add(cable);

  // Hook
  const hookGeo = new THREE.TorusGeometry(0.5, 0.15, 8, 16, Math.PI);
  const hook = new THREE.Mesh(hookGeo, darkMat);
  hook.position.set(12, towerHeight - 12.5, 0);
  hook.rotation.z = Math.PI;
  group.add(hook);

  return group;
}

/**
 * Create a construction site block
 */
export function createConstructionBlock(blockSize: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'construction_block';

  const innerSize = blockSize - 6;

  // Dirt/gravel ground
  const groundGeo = new THREE.PlaneGeometry(innerSize, innerSize);
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x8b7355 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.01;
  group.add(ground);

  // Orange safety fence
  const fenceMat = new THREE.MeshLambertMaterial({ color: 0xff6600 });
  const fenceHeight = 2;
  const fenceThickness = 0.1;

  const fenceSegments = [
    { x: 0, z: -innerSize / 2, length: innerSize, rot: 0 },
    { x: 0, z: innerSize / 2, length: innerSize, rot: 0 },
    { x: -innerSize / 2, z: 0, length: innerSize, rot: Math.PI / 2 },
    { x: innerSize / 2, z: 0, length: innerSize, rot: Math.PI / 2 },
  ];

  fenceSegments.forEach(seg => {
    const fenceGeo = new THREE.BoxGeometry(seg.length, fenceHeight, fenceThickness);
    const fence = new THREE.Mesh(fenceGeo, fenceMat);
    fence.position.set(seg.x, fenceHeight / 2, seg.z);
    fence.rotation.y = seg.rot;
    group.add(fence);
  });

  // Crane
  const crane = createCrane();
  crane.position.set(-innerSize / 4, 0, -innerSize / 4);
  group.add(crane);
  markForCylinderCollision(crane, 2);

  // Partially built structure
  const concreteMat = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });
  const structureSize = 15;
  const floors = 3;
  const floorHeight = 3;

  for (let floor = 0; floor < floors; floor++) {
    const slabGeo = new THREE.BoxGeometry(structureSize, 0.3, structureSize);
    const slab = new THREE.Mesh(slabGeo, concreteMat);
    slab.position.set(innerSize / 4, floor * floorHeight + 0.15, 0);
    group.add(slab);

    const columnGeo = new THREE.BoxGeometry(0.5, floorHeight, 0.5);
    const columnPositions = [
      { x: -structureSize / 2 + 0.5, z: -structureSize / 2 + 0.5 },
      { x: structureSize / 2 - 0.5, z: -structureSize / 2 + 0.5 },
      { x: -structureSize / 2 + 0.5, z: structureSize / 2 - 0.5 },
      { x: structureSize / 2 - 0.5, z: structureSize / 2 - 0.5 },
      { x: 0, z: -structureSize / 2 + 0.5 },
      { x: 0, z: structureSize / 2 - 0.5 },
    ];

    columnPositions.forEach(pos => {
      const column = new THREE.Mesh(columnGeo, concreteMat);
      column.position.set(
        innerSize / 4 + pos.x,
        floor * floorHeight + floorHeight / 2,
        pos.z
      );
      group.add(column);
    });
  }

  // Sand pile
  const sandPileGeo = new THREE.ConeGeometry(3, 2, 8);
  const sandPile = new THREE.Mesh(sandPileGeo, new THREE.MeshLambertMaterial({ color: 0xdec89a }));
  sandPile.position.set(-innerSize / 3, 1, innerSize / 3);
  group.add(sandPile);

  // Gravel pile
  const gravelPile = new THREE.Mesh(sandPileGeo, new THREE.MeshLambertMaterial({ color: 0x666666 }));
  gravelPile.position.set(-innerSize / 3 + 8, 1, innerSize / 3);
  group.add(gravelPile);

  // Lumber stack
  const pileMat = new THREE.MeshLambertMaterial({ color: 0x996633 });
  const lumberGeo = new THREE.BoxGeometry(4, 1, 2);
  const lumber = new THREE.Mesh(lumberGeo, pileMat);
  lumber.position.set(0, 0.5, innerSize / 3);
  group.add(lumber);

  // Porta-potty
  const pottyGeo = new THREE.BoxGeometry(1.5, 2.5, 1.5);
  const pottyMat = new THREE.MeshLambertMaterial({ color: 0x0066cc });
  const potty = new THREE.Mesh(pottyGeo, pottyMat);
  potty.position.set(-innerSize / 2 + 5, 1.25, innerSize / 2 - 5);
  group.add(potty);

  // Site office (container)
  const containerGeo = new THREE.BoxGeometry(8, 3, 3);
  const containerMat = new THREE.MeshLambertMaterial({ color: 0x336699 });
  const container = new THREE.Mesh(containerGeo, containerMat);
  container.position.set(-innerSize / 4, 1.5, innerSize / 3);
  group.add(container);
  markForBoxCollision(container);

  // Container windows
  const windowMat = new THREE.MeshLambertMaterial({ color: 0x88ccff });
  for (let i = 0; i < 3; i++) {
    const windowGeo = new THREE.PlaneGeometry(1, 0.8);
    const win = new THREE.Mesh(windowGeo, windowMat);
    win.position.set(-innerSize / 4 - 2 + i * 2, 2, innerSize / 3 + 1.51);
    group.add(win);
  }

  return group;
}
