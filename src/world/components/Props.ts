import * as THREE from 'three';

/**
 * Prop color palettes
 */
const COLORS = {
  treeTrunks: [0x8B4513, 0x654321, 0x5D4E37, 0x3D2914],
  treeLeaves: [0x228B22, 0x2E8B57, 0x32CD32, 0x006400, 0x556B2F],
  autumnLeaves: [0xD2691E, 0xFF8C00, 0xDAA520, 0xB8860B],
  coniferGreen: [0x013220, 0x004225, 0x0B6623],
  metal: [0x4a4a4a, 0x5a5a5a, 0x696969],
  bench: [0x8B4513, 0xA0522D, 0x654321],
  concrete: [0xA9A9A9, 0xB8B8B8, 0xC0C0C0],
};

function randomFrom<T>(arr: T[]): T {
  const index = Math.floor(Math.random() * arr.length);
  return arr[index] as T;
}

/**
 * DECIDUOUS TREE - Round/oval canopy
 */
export function createDeciduousTree(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'tree_deciduous';

  const scale = 0.8 + Math.random() * 0.5;

  // Trunk
  const trunkHeight = 3 * scale;
  const trunkMaterial = new THREE.MeshStandardMaterial({
    color: randomFrom(COLORS.treeTrunks),
    roughness: 0.9,
  });
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2 * scale, 0.35 * scale, trunkHeight, 8),
    trunkMaterial
  );
  trunk.position.y = trunkHeight / 2;
  trunk.castShadow = true;
  group.add(trunk);

  // Canopy - use icosahedron for low-poly look
  const canopySize = 2.5 * scale;
  const isAutumn = Math.random() > 0.8;
  const canopyMaterial = new THREE.MeshStandardMaterial({
    color: isAutumn ? randomFrom(COLORS.autumnLeaves) : randomFrom(COLORS.treeLeaves),
    roughness: 0.8,
    flatShading: true,
  });

  // Main canopy
  const canopy = new THREE.Mesh(
    new THREE.IcosahedronGeometry(canopySize, 1),
    canopyMaterial
  );
  canopy.position.y = trunkHeight + canopySize * 0.6;
  canopy.scale.y = 0.8; // Slightly flattened
  canopy.castShadow = true;
  group.add(canopy);

  // Secondary smaller canopy for fullness
  const canopy2 = new THREE.Mesh(
    new THREE.IcosahedronGeometry(canopySize * 0.7, 1),
    canopyMaterial
  );
  canopy2.position.set(canopySize * 0.3, trunkHeight + canopySize * 0.3, canopySize * 0.2);
  canopy2.castShadow = true;
  group.add(canopy2);

  group.userData.collisionRadius = 0.4 * scale;
  group.userData.propType = 'tree_deciduous';

  return group;
}

/**
 * CONIFER TREE - Pine/spruce style
 */
export function createConiferTree(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'tree_conifer';

  const scale = 0.8 + Math.random() * 0.5;

  // Trunk
  const trunkHeight = 2 * scale;
  const trunkMaterial = new THREE.MeshStandardMaterial({
    color: randomFrom(COLORS.treeTrunks),
    roughness: 0.9,
  });
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15 * scale, 0.25 * scale, trunkHeight, 6),
    trunkMaterial
  );
  trunk.position.y = trunkHeight / 2;
  trunk.castShadow = true;
  group.add(trunk);

  // Multiple cone layers
  const canopyMaterial = new THREE.MeshStandardMaterial({
    color: randomFrom(COLORS.coniferGreen),
    roughness: 0.85,
    flatShading: true,
  });

  const layers = 3;
  for (let i = 0; i < layers; i++) {
    const layerHeight = (2.5 - i * 0.5) * scale;
    const layerRadius = (1.8 - i * 0.4) * scale;
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(layerRadius, layerHeight, 6),
      canopyMaterial
    );
    cone.position.y = trunkHeight + i * layerHeight * 0.5 + layerHeight * 0.5;
    cone.castShadow = true;
    group.add(cone);
  }

  group.userData.collisionRadius = 0.3 * scale;
  group.userData.propType = 'tree_conifer';

  return group;
}

/**
 * BUSH - Small decorative shrub
 */
export function createBush(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'bush';

  const scale = 0.6 + Math.random() * 0.4;

  const bushMaterial = new THREE.MeshStandardMaterial({
    color: randomFrom(COLORS.treeLeaves),
    roughness: 0.85,
    flatShading: true,
  });

  // Multiple small spheres clustered together
  const positions = [
    { x: 0, y: 0.5, z: 0, size: 0.8 },
    { x: 0.4, y: 0.4, z: 0.3, size: 0.6 },
    { x: -0.3, y: 0.4, z: 0.4, size: 0.5 },
    { x: 0.2, y: 0.35, z: -0.4, size: 0.55 },
    { x: -0.4, y: 0.45, z: -0.2, size: 0.5 },
  ];

  positions.forEach(pos => {
    const sphere = new THREE.Mesh(
      new THREE.IcosahedronGeometry(pos.size * scale, 1),
      bushMaterial
    );
    sphere.position.set(pos.x * scale, pos.y * scale, pos.z * scale);
    sphere.castShadow = true;
    group.add(sphere);
  });

  group.userData.collisionRadius = 0.5 * scale;
  group.userData.propType = 'bush';

  return group;
}

/**
 * BENCH - Park bench
 */
export function createBench(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'bench';

  const woodColor = randomFrom(COLORS.bench);
  const woodMaterial = new THREE.MeshStandardMaterial({
    color: woodColor,
    roughness: 0.8,
  });
  const metalMaterial = new THREE.MeshStandardMaterial({
    color: 0x2c2c2c,
    roughness: 0.6,
    metalness: 0.4,
  });

  // Seat planks
  for (let i = 0; i < 4; i++) {
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.08, 0.15),
      woodMaterial
    );
    plank.position.set(0, 0.5, -0.15 + i * 0.12);
    plank.castShadow = true;
    group.add(plank);
  }

  // Back planks
  for (let i = 0; i < 3; i++) {
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.08, 0.12),
      woodMaterial
    );
    plank.position.set(0, 0.7 + i * 0.15, -0.3);
    plank.rotation.x = 0.2;
    plank.castShadow = true;
    group.add(plank);
  }

  // Metal legs/frame
  const legPositions = [-0.7, 0.7];
  legPositions.forEach(x => {
    // Front leg
    const frontLeg = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.5, 0.08),
      metalMaterial
    );
    frontLeg.position.set(x, 0.25, 0.15);
    group.add(frontLeg);

    // Back leg
    const backLeg = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.9, 0.08),
      metalMaterial
    );
    backLeg.position.set(x, 0.45, -0.35);
    backLeg.rotation.x = 0.15;
    group.add(backLeg);

    // Armrest
    const armrest = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.08, 0.4),
      metalMaterial
    );
    armrest.position.set(x, 0.7, -0.1);
    group.add(armrest);
  });

  group.userData.collisionBox = new THREE.Box3().setFromObject(group);
  group.userData.propType = 'bench';

  return group;
}

/**
 * LAMPPOST - Street light
 */
export function createLamppost(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'lamppost';

  const metalMaterial = new THREE.MeshStandardMaterial({
    color: 0x2c2c2c,
    roughness: 0.5,
    metalness: 0.6,
  });

  // Main pole
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.12, 5, 8),
    metalMaterial
  );
  pole.position.y = 2.5;
  pole.castShadow = true;
  group.add(pole);

  // Base
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.3, 0.3, 8),
    metalMaterial
  );
  base.position.y = 0.15;
  group.add(base);

  // Arm
  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.08, 0.08),
    metalMaterial
  );
  arm.position.set(0.5, 4.9, 0);
  group.add(arm);

  // Light fixture
  const fixtureMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a4a4a,
    roughness: 0.4,
    metalness: 0.5,
  });
  const fixture = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.15, 0.4, 8),
    fixtureMaterial
  );
  fixture.position.set(1, 4.7, 0);
  group.add(fixture);

  // Light bulb (emissive)
  const lightMaterial = new THREE.MeshStandardMaterial({
    color: 0xFFFF99,
    emissive: 0xFFFF66,
    emissiveIntensity: 0.5,
    roughness: 0.3,
  });
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 8),
    lightMaterial
  );
  bulb.position.set(1, 4.5, 0);
  group.add(bulb);

  group.userData.collisionRadius = 0.15;
  group.userData.propType = 'lamppost';

  return group;
}

/**
 * TRAFFIC LIGHT
 */
export function createTrafficLight(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'traffic_light';

  const metalMaterial = new THREE.MeshStandardMaterial({
    color: 0x2c2c2c,
    roughness: 0.5,
    metalness: 0.5,
  });

  // Pole
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, 4, 8),
    metalMaterial
  );
  pole.position.y = 2;
  pole.castShadow = true;
  group.add(pole);

  // Light box
  const boxMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.7,
  });
  const lightBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 1.2, 0.3),
    boxMaterial
  );
  lightBox.position.y = 4.2;
  lightBox.castShadow = true;
  group.add(lightBox);

  // Lights (red, yellow, green)
  const lightColors = [
    { color: 0xFF0000, y: 4.5, on: Math.random() > 0.6 },
    { color: 0xFFAA00, y: 4.2, on: Math.random() > 0.8 },
    { color: 0x00FF00, y: 3.9, on: Math.random() > 0.6 },
  ];

  lightColors.forEach(light => {
    const lightMaterial = new THREE.MeshStandardMaterial({
      color: light.color,
      emissive: light.color,
      emissiveIntensity: light.on ? 0.8 : 0.1,
      roughness: 0.3,
    });
    const lightMesh = new THREE.Mesh(
      new THREE.CircleGeometry(0.1, 12),
      lightMaterial
    );
    lightMesh.position.set(0, light.y, 0.16);
    group.add(lightMesh);
  });

  // Hood over lights
  const hoodMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });
  const hood = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.1, 0.25),
    hoodMaterial
  );
  hood.position.set(0, 4.85, 0.1);
  group.add(hood);

  group.userData.collisionRadius = 0.12;
  group.userData.propType = 'traffic_light';

  return group;
}

/**
 * STOP SIGN
 */
export function createStopSign(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'stop_sign';

  const metalMaterial = new THREE.MeshStandardMaterial({
    color: 0x6B6B6B,
    roughness: 0.6,
    metalness: 0.4,
  });

  // Pole
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.05, 2.5, 6),
    metalMaterial
  );
  pole.position.y = 1.25;
  pole.castShadow = true;
  group.add(pole);

  // Octagonal sign
  const signShape = new THREE.Shape();
  const size = 0.4;
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4 - Math.PI / 8;
    const x = Math.cos(angle) * size;
    const y = Math.sin(angle) * size;
    if (i === 0) signShape.moveTo(x, y);
    else signShape.lineTo(x, y);
  }
  signShape.closePath();

  const signGeometry = new THREE.ExtrudeGeometry(signShape, { depth: 0.03, bevelEnabled: false });
  const signMaterial = new THREE.MeshStandardMaterial({
    color: 0xCC0000,
    roughness: 0.5,
  });
  const sign = new THREE.Mesh(signGeometry, signMaterial);
  sign.rotation.y = Math.PI / 2;
  sign.position.set(0.015, 2.7, 0);
  sign.castShadow = true;
  group.add(sign);

  // White border
  const borderMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.5 });
  const border = new THREE.Mesh(
    new THREE.RingGeometry(size * 0.85, size, 8),
    borderMaterial
  );
  border.rotation.y = Math.PI / 2;
  border.rotation.z = Math.PI / 8;
  border.position.set(0.05, 2.7, 0);
  group.add(border);

  group.userData.collisionRadius = 0.08;
  group.userData.propType = 'stop_sign';

  return group;
}

/**
 * BUS STOP
 */
export function createBusStop(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'bus_stop';

  const metalMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a4a4a,
    roughness: 0.5,
    metalness: 0.5,
  });

  // Main poles
  const pole1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 8), metalMaterial);
  pole1.position.set(-1.2, 1.5, 0);
  pole1.castShadow = true;
  group.add(pole1);

  const pole2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 8), metalMaterial);
  pole2.position.set(1.2, 1.5, 0);
  pole2.castShadow = true;
  group.add(pole2);

  // Roof
  const roofMaterial = new THREE.MeshStandardMaterial({
    color: 0x3498DB,
    roughness: 0.4,
    metalness: 0.3,
  });
  const roof = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 1.5), roofMaterial);
  roof.position.set(0, 3, 0);
  roof.castShadow = true;
  group.add(roof);

  // Back panel
  const panelMaterial = new THREE.MeshStandardMaterial({
    color: 0xE8E8E8,
    roughness: 0.6,
    transparent: true,
    opacity: 0.7,
  });
  const backPanel = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2, 0.05), panelMaterial);
  backPanel.position.set(0, 1.5, -0.7);
  group.add(backPanel);

  // Side panels
  const sidePanel1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2, 1.4), panelMaterial);
  sidePanel1.position.set(-1.4, 1.5, 0);
  group.add(sidePanel1);

  const sidePanel2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2, 1.4), panelMaterial);
  sidePanel2.position.set(1.4, 1.5, 0);
  group.add(sidePanel2);

  // Bench inside
  const bench = createBench();
  bench.position.set(0, 0, -0.3);
  bench.scale.setScalar(0.8);
  group.add(bench);

  // Sign
  const signMaterial = new THREE.MeshStandardMaterial({ color: 0x3498DB, roughness: 0.5 });
  const signPole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 6), metalMaterial);
  signPole.position.set(1.5, 3.4, 0);
  group.add(signPole);

  const signBoard = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.05), signMaterial);
  signBoard.position.set(1.5, 3.9, 0);
  group.add(signBoard);

  group.userData.collisionBox = new THREE.Box3().setFromObject(group);
  group.userData.propType = 'bus_stop';

  return group;
}

/**
 * TRASH BIN
 */
export function createTrashBin(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'trash_bin';

  const binMaterial = new THREE.MeshStandardMaterial({
    color: 0x2E7D32,
    roughness: 0.7,
  });

  // Main bin body
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.25, 0.9, 8),
    binMaterial
  );
  body.position.y = 0.45;
  body.castShadow = true;
  group.add(body);

  // Lid
  const lidMaterial = new THREE.MeshStandardMaterial({
    color: 0x1B5E20,
    roughness: 0.6,
  });
  const lid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.32, 0.08, 8),
    lidMaterial
  );
  lid.position.y = 0.94;
  lid.castShadow = true;
  group.add(lid);

  // Opening
  const openingMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
  const opening = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.08, 0.1),
    openingMaterial
  );
  opening.position.set(0, 0.75, 0.28);
  group.add(opening);

  group.userData.collisionRadius = 0.35;
  group.userData.propType = 'trash_bin';

  return group;
}

/**
 * FOUNTAIN - Central square fountain
 */
export function createFountain(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'fountain';

  const stoneMaterial = new THREE.MeshStandardMaterial({
    color: 0xB8B8B8,
    roughness: 0.8,
  });

  // Base pool
  const poolOuter = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 4.5, 0.8, 16),
    stoneMaterial
  );
  poolOuter.position.y = 0.4;
  poolOuter.castShadow = true;
  poolOuter.receiveShadow = true;
  group.add(poolOuter);

  // Water
  const waterMaterial = new THREE.MeshStandardMaterial({
    color: 0x4FC3F7,
    roughness: 0.1,
    metalness: 0.3,
    transparent: true,
    opacity: 0.7,
  });
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(3.8, 3.8, 0.5, 16),
    waterMaterial
  );
  water.position.y = 0.55;
  group.add(water);

  // Inner pedestal
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8, 1, 2, 8),
    stoneMaterial
  );
  pedestal.position.y = 1.5;
  pedestal.castShadow = true;
  group.add(pedestal);

  // Upper basin
  const upperBasin = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 1.2, 0.5, 12),
    stoneMaterial
  );
  upperBasin.position.y = 2.75;
  upperBasin.castShadow = true;
  group.add(upperBasin);

  // Water in upper basin
  const upperWater = new THREE.Mesh(
    new THREE.CylinderGeometry(1.3, 1.3, 0.3, 12),
    waterMaterial
  );
  upperWater.position.y = 2.85;
  group.add(upperWater);

  // Central spout
  const spout = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.3, 1, 8),
    stoneMaterial
  );
  spout.position.y = 3.5;
  spout.castShadow = true;
  group.add(spout);

  // Water spray (simplified as a cone)
  const sprayMaterial = new THREE.MeshStandardMaterial({
    color: 0xB3E5FC,
    transparent: true,
    opacity: 0.5,
  });
  const spray = new THREE.Mesh(
    new THREE.ConeGeometry(0.3, 1.5, 8),
    sprayMaterial
  );
  spray.position.y = 4.75;
  group.add(spray);

  group.userData.collisionRadius = 4.5;
  group.userData.propType = 'fountain';

  return group;
}

/**
 * STATUE - Decorative statue for squares
 */
export function createStatue(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'statue';

  const stoneMaterial = new THREE.MeshStandardMaterial({
    color: 0x8B8B83,
    roughness: 0.7,
    metalness: 0.2,
  });

  // Pedestal base
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 0.5, 2.5),
    stoneMaterial
  );
  base.position.y = 0.25;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // Pedestal middle
  const middle = new THREE.Mesh(
    new THREE.BoxGeometry(2, 1.5, 2),
    stoneMaterial
  );
  middle.position.y = 1.25;
  middle.castShadow = true;
  group.add(middle);

  // Pedestal top
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.3, 2.2),
    stoneMaterial
  );
  top.position.y = 2.15;
  top.castShadow = true;
  group.add(top);

  // Simple figure (abstract human shape)
  const figureMaterial = new THREE.MeshStandardMaterial({
    color: 0x6B6B5F,
    roughness: 0.6,
    metalness: 0.3,
  });

  // Body
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.5, 2, 8),
    figureMaterial
  );
  body.position.y = 3.3;
  body.castShadow = true;
  group.add(body);

  // Head
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 8, 8),
    figureMaterial
  );
  head.position.y = 4.6;
  head.castShadow = true;
  group.add(head);

  // Arms extended
  const armL = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, 1, 6),
    figureMaterial
  );
  armL.position.set(-0.6, 3.8, 0);
  armL.rotation.z = Math.PI / 3;
  group.add(armL);

  const armR = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, 1, 6),
    figureMaterial
  );
  armR.position.set(0.6, 3.8, 0);
  armR.rotation.z = -Math.PI / 3;
  group.add(armR);

  group.userData.collisionRadius = 1.5;
  group.userData.propType = 'statue';

  return group;
}

/**
 * Factory function to create prop by type
 */
export type PropType =
  | 'tree_deciduous'
  | 'tree_conifer'
  | 'bush'
  | 'bench'
  | 'lamppost'
  | 'traffic_light'
  | 'stop_sign'
  | 'bus_stop'
  | 'trash_bin'
  | 'fountain'
  | 'statue';

export function createProp(type: PropType): THREE.Group {
  switch (type) {
    case 'tree_deciduous': return createDeciduousTree();
    case 'tree_conifer': return createConiferTree();
    case 'bush': return createBush();
    case 'bench': return createBench();
    case 'lamppost': return createLamppost();
    case 'traffic_light': return createTrafficLight();
    case 'stop_sign': return createStopSign();
    case 'bus_stop': return createBusStop();
    case 'trash_bin': return createTrashBin();
    case 'fountain': return createFountain();
    case 'statue': return createStatue();
    default: return createDeciduousTree();
  }
}

/**
 * Create a random tree (deciduous or conifer)
 */
export function createRandomTree(): THREE.Group {
  return Math.random() > 0.3 ? createDeciduousTree() : createConiferTree();
}
