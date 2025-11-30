import * as THREE from 'three';
import { createCar, createVan, createTruck } from '../components/Vehicles';
import { createLamppost } from '../components/Props';

/**
 * Mark an object for box collision registration
 */
function markForBoxCollision(obj: THREE.Object3D): void {
  obj.userData.collidable = true;
  obj.userData.colliderType = 'box';
}

/**
 * Create a parking lot block
 */
export function createParkingBlock(blockSize: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'parking_block';

  const innerSize = blockSize - 6;

  // Asphalt base
  const asphaltGeo = new THREE.PlaneGeometry(innerSize, innerSize);
  const asphaltMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const asphalt = new THREE.Mesh(asphaltGeo, asphaltMat);
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.y = 0.01;
  group.add(asphalt);

  // Parking lines
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const lineWidth = 0.15;
  const spotWidth = 5;
  const spotDepth = 8;
  const rowSpacing = 12;

  const numRows = 3;
  const spotsPerRow = Math.floor((innerSize - 10) / spotWidth);

  for (let row = 0; row < numRows; row++) {
    const rowZ = -innerSize / 2 + 10 + row * (spotDepth + rowSpacing);

    for (let spot = 0; spot <= spotsPerRow; spot++) {
      const spotX = -innerSize / 2 + 5 + spot * spotWidth;
      const lineGeo = new THREE.PlaneGeometry(lineWidth, spotDepth);
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(spotX, 0.02, rowZ);
      group.add(line);
    }

    const backLineGeo = new THREE.PlaneGeometry(innerSize - 10, lineWidth);
    const backLine = new THREE.Mesh(backLineGeo, lineMat);
    backLine.rotation.x = -Math.PI / 2;
    backLine.position.set(0, 0.02, rowZ - spotDepth / 2);
    group.add(backLine);
  }

  // Place parked vehicles
  const vehicles = [createCar, createCar, createCar, createVan, createTruck];

  for (let row = 0; row < numRows; row++) {
    const rowZ = -innerSize / 2 + 10 + row * (spotDepth + rowSpacing);

    for (let spot = 0; spot < spotsPerRow; spot++) {
      if (Math.random() > 0.7) continue;

      const spotX = -innerSize / 2 + 5 + spot * spotWidth + spotWidth / 2;
      const vehicleCreate = vehicles[Math.floor(Math.random() * vehicles.length)];

      if (vehicleCreate) {
        const vehicle = vehicleCreate();
        vehicle.position.set(spotX, 0, rowZ);
        vehicle.rotation.y = Math.PI / 2 + (Math.random() - 0.5) * 0.1;
        group.add(vehicle);
        markForBoxCollision(vehicle);
      }
    }
  }

  // Entrance booth
  const boothGeo = new THREE.BoxGeometry(3, 2.5, 2);
  const boothMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
  const booth = new THREE.Mesh(boothGeo, boothMat);
  booth.position.set(-innerSize / 2 + 5, 1.25, innerSize / 2 - 5);
  group.add(booth);

  const windowGeo = new THREE.PlaneGeometry(1.5, 1);
  const windowMat = new THREE.MeshLambertMaterial({ color: 0x88ccff });
  const boothWindow = new THREE.Mesh(windowGeo, windowMat);
  boothWindow.position.set(-innerSize / 2 + 5, 1.5, innerSize / 2 - 4);
  group.add(boothWindow);

  // Lampposts
  const lampPositions = [
    { x: -innerSize / 3, z: 0 },
    { x: innerSize / 3, z: 0 },
    { x: 0, z: -innerSize / 3 },
    { x: 0, z: innerSize / 3 },
  ];

  lampPositions.forEach(pos => {
    const lamp = createLamppost();
    lamp.position.set(pos.x, 0, pos.z);
    group.add(lamp);
  });

  return group;
}
