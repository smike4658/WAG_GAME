import * as THREE from 'three';
import { createBench, createTrashBin, createLamppost } from '../components/Props';

/**
 * Create a market stall
 */
function createMarketStall(color: number): THREE.Group {
  const group = new THREE.Group();

  // Counter/table
  const counterGeo = new THREE.BoxGeometry(4, 1, 2);
  const counterMat = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
  const counter = new THREE.Mesh(counterGeo, counterMat);
  counter.position.y = 0.5;
  group.add(counter);

  // Goods on counter
  const goodsColors: number[] = [0xff6b6b, 0xffd93d, 0x6bcb77, 0x4d96ff];
  for (let i = 0; i < 4; i++) {
    const goodGeo = new THREE.BoxGeometry(0.8, 0.4, 0.6);
    const colorIndex = i % goodsColors.length;
    const goodMat = new THREE.MeshLambertMaterial({
      color: goodsColors[colorIndex] as number
    });
    const good = new THREE.Mesh(goodGeo, goodMat);
    good.position.set(-1.2 + i * 0.9, 1.2, 0);
    group.add(good);
  }

  // Canopy poles
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
  const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.5);

  const poles = [
    { x: -1.8, z: -0.8 },
    { x: 1.8, z: -0.8 },
    { x: -1.8, z: 0.8 },
    { x: 1.8, z: 0.8 },
  ];

  poles.forEach(pos => {
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(pos.x, 1.25, pos.z);
    group.add(pole);
  });

  // Canopy
  const canopyGeo = new THREE.BoxGeometry(4.5, 0.1, 2.5);
  const canopyMat = new THREE.MeshLambertMaterial({ color });
  const canopy = new THREE.Mesh(canopyGeo, canopyMat);
  canopy.position.y = 2.5;
  group.add(canopy);

  return group;
}

/**
 * Create a market square block
 */
export function createMarketBlock(blockSize: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'market_block';

  const innerSize = blockSize - 6;

  // Cobblestone base
  const stoneGeo = new THREE.PlaneGeometry(innerSize, innerSize);
  const stoneMat = new THREE.MeshLambertMaterial({ color: 0x8b7355 });
  const stone = new THREE.Mesh(stoneGeo, stoneMat);
  stone.rotation.x = -Math.PI / 2;
  stone.position.y = 0.01;
  group.add(stone);

  // Market stalls in rows
  const stallColors: number[] = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6];
  const stallSpacing = 8;
  const numRows = 2;
  const stallsPerRow = 4;

  for (let row = 0; row < numRows; row++) {
    const rowZ = -innerSize / 4 + row * (innerSize / 2);

    for (let i = 0; i < stallsPerRow; i++) {
      const stallX = -innerSize / 2 + 10 + i * stallSpacing;
      const colorIndex = (row * stallsPerRow + i) % stallColors.length;

      const stall = createMarketStall(stallColors[colorIndex] as number);
      stall.position.set(stallX, 0, rowZ);
      stall.rotation.y = Math.random() > 0.5 ? 0 : Math.PI;
      group.add(stall);
    }
  }

  // Central walking area
  const pathGeo = new THREE.PlaneGeometry(innerSize - 10, 8);
  const pathMat = new THREE.MeshLambertMaterial({ color: 0x999999 });
  const path = new THREE.Mesh(pathGeo, pathMat);
  path.rotation.x = -Math.PI / 2;
  path.position.y = 0.02;
  group.add(path);

  // Benches
  const benchPositions = [
    { x: -innerSize / 3, z: 0, rot: Math.PI / 2 },
    { x: innerSize / 3, z: 0, rot: -Math.PI / 2 },
  ];

  benchPositions.forEach(pos => {
    const bench = createBench();
    bench.position.set(pos.x, 0, pos.z);
    bench.rotation.y = pos.rot;
    group.add(bench);
  });

  // Trash bins
  const binPositions = [
    { x: -innerSize / 2 + 5, z: -innerSize / 2 + 5 },
    { x: innerSize / 2 - 5, z: -innerSize / 2 + 5 },
    { x: -innerSize / 2 + 5, z: innerSize / 2 - 5 },
    { x: innerSize / 2 - 5, z: innerSize / 2 - 5 },
  ];

  binPositions.forEach(pos => {
    const bin = createTrashBin();
    bin.position.set(pos.x, 0, pos.z);
    group.add(bin);
  });

  // Lampposts
  const lampPositions = [
    { x: -innerSize / 2 + 3, z: 0 },
    { x: innerSize / 2 - 3, z: 0 },
  ];

  lampPositions.forEach(pos => {
    const lamp = createLamppost();
    lamp.position.set(pos.x, 0, pos.z);
    group.add(lamp);
  });

  return group;
}
