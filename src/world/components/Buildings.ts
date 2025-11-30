import * as THREE from 'three';

/**
 * Color palettes for different building types
 */
const COLORS = {
  // Residential warm tones
  residential: [0xE8D4B8, 0xD4A574, 0xF5DEB3, 0xDEB887, 0xD2B48C, 0xC9B896],
  // Commercial cool/modern tones
  commercial: [0xB0C4DE, 0x87CEEB, 0xADD8E6, 0xE0E0E0, 0xD3D3D3, 0xC0C0C0],
  // Mixed urban colorful
  mixed: [0xF5B7B1, 0xAED6F1, 0xFAD7A0, 0xD7BDE2, 0xA9DFBF, 0xF9E79F],
  // Roof colors
  roofs: [0x8B4513, 0xA0522D, 0x6B4423, 0x8B0000, 0x4A4A4A, 0x696969],
  // Window colors
  windows: [0x87CEEB, 0xADD8E6, 0xE0FFFF, 0xB0E0E6],
};

/**
 * Helper to pick random item from array
 */
function randomFrom<T>(arr: T[]): T {
  const index = Math.floor(Math.random() * arr.length);
  return arr[index] as T;
}

/**
 * Helper to create beveled box geometry for stylized look
 */
function createBeveledBox(width: number, height: number, depth: number): THREE.BufferGeometry {
  // Use regular box with slight scale variation for low-poly feel
  const geometry = new THREE.BoxGeometry(width, height, depth);
  return geometry;
}

/**
 * Add windows to a building mesh
 */
function addWindows(
  parent: THREE.Group,
  buildingWidth: number,
  buildingHeight: number,
  buildingDepth: number,
  floors: number,
  windowsPerFloor: number
): void {
  const windowMaterial = new THREE.MeshStandardMaterial({
    color: randomFrom(COLORS.windows),
    emissive: 0x1a1a2e,
    emissiveIntensity: 0.1,
    roughness: 0.1,
    metalness: 0.3,
  });

  const windowWidth = 1.2;
  const windowHeight = 1.5;
  const windowDepth = 0.1;
  const floorHeight = buildingHeight / floors;

  // Add windows on front and back
  for (let floor = 0; floor < floors; floor++) {
    const y = (floor + 0.5) * floorHeight - buildingHeight / 2 + 0.5;

    for (let w = 0; w < windowsPerFloor; w++) {
      const xOffset = (w - (windowsPerFloor - 1) / 2) * (buildingWidth / (windowsPerFloor + 1));

      // Front windows
      const frontWindow = new THREE.Mesh(
        new THREE.BoxGeometry(windowWidth, windowHeight, windowDepth),
        windowMaterial
      );
      frontWindow.position.set(xOffset, y, buildingDepth / 2 + 0.05);
      parent.add(frontWindow);

      // Back windows
      const backWindow = new THREE.Mesh(
        new THREE.BoxGeometry(windowWidth, windowHeight, windowDepth),
        windowMaterial
      );
      backWindow.position.set(xOffset, y, -buildingDepth / 2 - 0.05);
      parent.add(backWindow);
    }
  }
}

/**
 * HOUSE - Small residential building (1-2 floors)
 */
export function createHouse(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'house';

  const width = 8 + Math.random() * 4;
  const depth = 10 + Math.random() * 4;
  const height = 5 + Math.random() * 3;
  const floors = Math.random() > 0.5 ? 2 : 1;

  // Main body
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: randomFrom(COLORS.residential),
    roughness: 0.8,
    metalness: 0.1,
  });
  const body = new THREE.Mesh(createBeveledBox(width, height, depth), bodyMaterial);
  body.position.y = height / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Pitched roof
  const roofMaterial = new THREE.MeshStandardMaterial({
    color: randomFrom(COLORS.roofs),
    roughness: 0.9,
    metalness: 0.0,
  });
  const roofHeight = 3 + Math.random() * 2;
  const roofGeometry = new THREE.ConeGeometry(Math.max(width, depth) * 0.75, roofHeight, 4);
  roofGeometry.rotateY(Math.PI / 4);
  const roof = new THREE.Mesh(roofGeometry, roofMaterial);
  roof.position.y = height + roofHeight / 2;
  roof.castShadow = true;
  group.add(roof);

  // Chimney
  const chimneyMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9 });
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(1, 2.5, 1), chimneyMaterial);
  chimney.position.set(width * 0.3, height + roofHeight * 0.6, 0);
  chimney.castShadow = true;
  group.add(chimney);

  // Windows
  addWindows(group, width, height, depth, floors, 2);

  // Door
  const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x654321, roughness: 0.7 });
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.2, 0.2), doorMaterial);
  door.position.set(0, 1.1, depth / 2 + 0.1);
  group.add(door);

  // Store collision data
  group.userData.collisionBox = new THREE.Box3().setFromObject(group);
  group.userData.buildingType = 'house';

  return group;
}

/**
 * APARTMENT BLOCK - Medium residential (3-6 floors)
 */
export function createApartmentBlock(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'apartment';

  const width = 15 + Math.random() * 10;
  const depth = 12 + Math.random() * 6;
  const floors = 3 + Math.floor(Math.random() * 4);
  const height = floors * 3.5;

  // Main body
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: randomFrom(COLORS.mixed),
    roughness: 0.7,
    metalness: 0.1,
  });
  const body = new THREE.Mesh(createBeveledBox(width, height, depth), bodyMaterial);
  body.position.y = height / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Flat or slight pitched roof
  if (Math.random() > 0.5) {
    // Flat roof with edge
    const roofEdge = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.5, 0.5, depth + 0.5),
      new THREE.MeshStandardMaterial({ color: 0x696969, roughness: 0.9 })
    );
    roofEdge.position.y = height + 0.25;
    roofEdge.castShadow = true;
    group.add(roofEdge);
  } else {
    // Slight pitched roof
    const roofMaterial = new THREE.MeshStandardMaterial({ color: randomFrom(COLORS.roofs), roughness: 0.9 });
    const roofGeometry = new THREE.BoxGeometry(width + 1, 1.5, depth + 1);
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = height + 0.75;
    roof.castShadow = true;
    group.add(roof);
  }

  // Windows
  addWindows(group, width, height, depth, floors, Math.floor(width / 4));

  // Balconies (random)
  if (Math.random() > 0.4) {
    const balconyMaterial = new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 0.8 });
    for (let f = 1; f < floors; f++) {
      if (Math.random() > 0.5) {
        const balcony = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 1.5), balconyMaterial);
        balcony.position.set(0, f * 3.5, depth / 2 + 0.75);
        balcony.castShadow = true;
        group.add(balcony);

        // Railing
        const railing = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 0.1), balconyMaterial);
        railing.position.set(0, f * 3.5 + 0.5, depth / 2 + 1.4);
        group.add(railing);
      }
    }
  }

  // Entrance
  const entranceMaterial = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.6 });
  const entrance = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 0.3), entranceMaterial);
  entrance.position.set(0, 1.5, depth / 2 + 0.15);
  group.add(entrance);

  group.userData.collisionBox = new THREE.Box3().setFromObject(group);
  group.userData.buildingType = 'apartment';

  return group;
}

/**
 * SKYSCRAPER - Tall commercial building (8-15 floors)
 */
export function createSkyscraper(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'skyscraper';

  const width = 20 + Math.random() * 15;
  const depth = 20 + Math.random() * 15;
  const floors = 8 + Math.floor(Math.random() * 8);
  const height = floors * 4;

  // Main body - glass/steel look
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: randomFrom(COLORS.commercial),
    roughness: 0.2,
    metalness: 0.6,
  });
  const body = new THREE.Mesh(createBeveledBox(width, height, depth), bodyMaterial);
  body.position.y = height / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Glass stripe pattern
  const stripeMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a1a2e,
    roughness: 0.1,
    metalness: 0.8,
  });
  for (let i = 1; i < floors; i++) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.1, 0.3, depth + 0.1),
      stripeMaterial
    );
    stripe.position.y = i * 4;
    group.add(stripe);
  }

  // Flat roof with helipad or antenna
  const roofTop = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.3, 3, depth * 0.3),
    new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.7 })
  );
  roofTop.position.y = height + 1.5;
  roofTop.castShadow = true;
  group.add(roofTop);

  // Antenna
  const antenna = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.5 })
  );
  antenna.position.y = height + 7;
  group.add(antenna);

  // Ground floor entrance
  const entranceMaterial = new THREE.MeshStandardMaterial({ color: 0x2c2c2c, roughness: 0.3, metalness: 0.5 });
  const entrance = new THREE.Mesh(new THREE.BoxGeometry(width * 0.4, 5, 0.5), entranceMaterial);
  entrance.position.set(0, 2.5, depth / 2 + 0.25);
  group.add(entrance);

  group.userData.collisionBox = new THREE.Box3().setFromObject(group);
  group.userData.buildingType = 'skyscraper';

  return group;
}

/**
 * SHOP - Small commercial with awning (1-2 floors)
 */
export function createShop(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'shop';

  const width = 8 + Math.random() * 6;
  const depth = 10 + Math.random() * 4;
  const floors = Math.random() > 0.6 ? 2 : 1;
  const height = floors * 4;

  // Main body
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: randomFrom(COLORS.mixed),
    roughness: 0.7,
    metalness: 0.1,
  });
  const body = new THREE.Mesh(createBeveledBox(width, height, depth), bodyMaterial);
  body.position.y = height / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Flat roof
  const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x696969, roughness: 0.9 });
  const roof = new THREE.Mesh(new THREE.BoxGeometry(width + 0.3, 0.3, depth + 0.3), roofMaterial);
  roof.position.y = height + 0.15;
  roof.castShadow = true;
  group.add(roof);

  // Large shop window
  const windowMaterial = new THREE.MeshStandardMaterial({
    color: 0xADD8E6,
    roughness: 0.1,
    metalness: 0.3,
    transparent: true,
    opacity: 0.8,
  });
  const shopWindow = new THREE.Mesh(new THREE.BoxGeometry(width * 0.7, 2.5, 0.1), windowMaterial);
  shopWindow.position.set(0, 1.5, depth / 2 + 0.05);
  group.add(shopWindow);

  // Awning
  const awningColors = [0xFF6B6B, 0x4ECDC4, 0xFFE66D, 0x95E1D3, 0xF38181];
  const awningMaterial = new THREE.MeshStandardMaterial({
    color: randomFrom(awningColors),
    roughness: 0.8,
    side: THREE.DoubleSide,
  });
  const awningGeometry = new THREE.BoxGeometry(width * 0.8, 0.1, 2);
  const awning = new THREE.Mesh(awningGeometry, awningMaterial);
  awning.position.set(0, 3.2, depth / 2 + 1);
  awning.rotation.x = -0.2;
  awning.castShadow = true;
  group.add(awning);

  // Sign area
  const signMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(width * 0.6, 1, 0.2), signMaterial);
  sign.position.set(0, 3.8, depth / 2 + 0.1);
  group.add(sign);

  // Door
  const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x2c2c2c, roughness: 0.6 });
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.5, 0.2), doorMaterial);
  door.position.set(width * 0.35, 1.25, depth / 2 + 0.1);
  group.add(door);

  group.userData.collisionBox = new THREE.Box3().setFromObject(group);
  group.userData.buildingType = 'shop';

  return group;
}

/**
 * OFFICE - Medium commercial (4-8 floors)
 */
export function createOffice(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'office';

  const width = 18 + Math.random() * 12;
  const depth = 15 + Math.random() * 8;
  const floors = 4 + Math.floor(Math.random() * 5);
  const height = floors * 3.8;

  // Main body
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: randomFrom(COLORS.commercial),
    roughness: 0.4,
    metalness: 0.3,
  });
  const body = new THREE.Mesh(createBeveledBox(width, height, depth), bodyMaterial);
  body.position.y = height / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Grid windows
  addWindows(group, width, height, depth, floors, Math.floor(width / 3));

  // Flat roof with AC units
  const roofBase = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.5, depth),
    new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 0.9 })
  );
  roofBase.position.y = height + 0.25;
  group.add(roofBase);

  // AC units on roof
  const acMaterial = new THREE.MeshStandardMaterial({ color: 0xd3d3d3, roughness: 0.7 });
  for (let i = 0; i < 3; i++) {
    const ac = new THREE.Mesh(new THREE.BoxGeometry(2, 1.5, 2), acMaterial);
    ac.position.set((i - 1) * 4, height + 1.25, 0);
    ac.castShadow = true;
    group.add(ac);
  }

  // Entrance canopy
  const canopyMaterial = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.5 });
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(6, 0.3, 3), canopyMaterial);
  canopy.position.set(0, 4, depth / 2 + 1.5);
  canopy.castShadow = true;
  group.add(canopy);

  // Glass entrance doors
  const doorMaterial = new THREE.MeshStandardMaterial({
    color: 0x87CEEB,
    roughness: 0.1,
    metalness: 0.5,
    transparent: true,
    opacity: 0.7,
  });
  const doors = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 0.2), doorMaterial);
  doors.position.set(0, 1.5, depth / 2 + 0.1);
  group.add(doors);

  group.userData.collisionBox = new THREE.Box3().setFromObject(group);
  group.userData.buildingType = 'office';

  return group;
}

/**
 * CHURCH - Landmark building with spire
 */
export function createChurch(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'church';

  const width = 20;
  const depth = 35;
  const height = 15;

  // Main nave
  const naveMaterial = new THREE.MeshStandardMaterial({
    color: 0xD4C4A8,
    roughness: 0.8,
    metalness: 0.1,
  });
  const nave = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), naveMaterial);
  nave.position.y = height / 2;
  nave.castShadow = true;
  nave.receiveShadow = true;
  group.add(nave);

  // Pitched roof
  const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.9 });
  const roofGeometry = new THREE.ConeGeometry(width * 0.8, 8, 4);
  roofGeometry.rotateY(Math.PI / 4);
  roofGeometry.scale(1, 1, depth / width);
  const roof = new THREE.Mesh(roofGeometry, roofMaterial);
  roof.position.y = height + 4;
  roof.castShadow = true;
  group.add(roof);

  // Bell tower
  const towerWidth = 6;
  const towerHeight = 25;
  const tower = new THREE.Mesh(
    new THREE.BoxGeometry(towerWidth, towerHeight, towerWidth),
    naveMaterial
  );
  tower.position.set(0, towerHeight / 2, -depth / 2 + towerWidth / 2);
  tower.castShadow = true;
  group.add(tower);

  // Spire
  const spire = new THREE.Mesh(
    new THREE.ConeGeometry(towerWidth * 0.6, 12, 4),
    roofMaterial
  );
  spire.position.set(0, towerHeight + 6, -depth / 2 + towerWidth / 2);
  spire.castShadow = true;
  group.add(spire);

  // Cross on top
  const crossMaterial = new THREE.MeshStandardMaterial({ color: 0xFFD700, roughness: 0.3, metalness: 0.7 });
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3, 0.3), crossMaterial);
  crossV.position.set(0, towerHeight + 13, -depth / 2 + towerWidth / 2);
  group.add(crossV);
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(2, 0.3, 0.3), crossMaterial);
  crossH.position.set(0, towerHeight + 12, -depth / 2 + towerWidth / 2);
  group.add(crossH);

  // Arched windows (simplified as tall rectangles)
  const windowMaterial = new THREE.MeshStandardMaterial({
    color: 0x4169E1,
    emissive: 0x1a1a4e,
    emissiveIntensity: 0.2,
    roughness: 0.2,
  });
  for (let i = 0; i < 5; i++) {
    const window = new THREE.Mesh(new THREE.BoxGeometry(1.5, 4, 0.2), windowMaterial);
    window.position.set((i - 2) * 3.5, 6, depth / 2 + 0.1);
    group.add(window);
  }

  // Large entrance door
  const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.8 });
  const door = new THREE.Mesh(new THREE.BoxGeometry(4, 5, 0.3), doorMaterial);
  door.position.set(0, 2.5, depth / 2 + 0.15);
  group.add(door);

  group.userData.collisionBox = new THREE.Box3().setFromObject(group);
  group.userData.buildingType = 'church';

  return group;
}

/**
 * TOWN HALL - Grand civic building
 */
export function createTownHall(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'townhall';

  const width = 40;
  const depth = 25;
  const height = 18;

  // Main building
  const mainMaterial = new THREE.MeshStandardMaterial({
    color: 0xF5F5DC,
    roughness: 0.7,
    metalness: 0.1,
  });
  const main = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mainMaterial);
  main.position.y = height / 2;
  main.castShadow = true;
  main.receiveShadow = true;
  group.add(main);

  // Roof with slight overhang
  const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x2F4F4F, roughness: 0.8 });
  const roof = new THREE.Mesh(new THREE.BoxGeometry(width + 2, 2, depth + 2), roofMaterial);
  roof.position.y = height + 1;
  roof.castShadow = true;
  group.add(roof);

  // Clock tower in center
  const towerWidth = 8;
  const towerHeight = 20;
  const tower = new THREE.Mesh(
    new THREE.BoxGeometry(towerWidth, towerHeight, towerWidth),
    mainMaterial
  );
  tower.position.y = height + towerHeight / 2;
  tower.castShadow = true;
  group.add(tower);

  // Tower roof
  const towerRoof = new THREE.Mesh(
    new THREE.ConeGeometry(towerWidth * 0.7, 6, 4),
    roofMaterial
  );
  towerRoof.position.y = height + towerHeight + 3;
  towerRoof.castShadow = true;
  group.add(towerRoof);

  // Clock face
  const clockMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFFF0, roughness: 0.5 });
  const clock = new THREE.Mesh(new THREE.CircleGeometry(2.5, 16), clockMaterial);
  clock.position.set(0, height + towerHeight - 3, towerWidth / 2 + 0.1);
  group.add(clock);

  // Clock hands
  const handMaterial = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.5 });
  const hourHand = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.5, 0.1), handMaterial);
  hourHand.position.set(0, height + towerHeight - 2.5, towerWidth / 2 + 0.15);
  hourHand.rotation.z = Math.PI / 6;
  group.add(hourHand);
  const minuteHand = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2, 0.1), handMaterial);
  minuteHand.position.set(0, height + towerHeight - 2, towerWidth / 2 + 0.2);
  minuteHand.rotation.z = -Math.PI / 3;
  group.add(minuteHand);

  // Columns at entrance
  const columnMaterial = new THREE.MeshStandardMaterial({ color: 0xF5F5F5, roughness: 0.6 });
  for (let i = 0; i < 6; i++) {
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 10, 8), columnMaterial);
    column.position.set((i - 2.5) * 4, 5, depth / 2 + 1.5);
    column.castShadow = true;
    group.add(column);
  }

  // Entrance platform
  const platformMaterial = new THREE.MeshStandardMaterial({ color: 0xD3D3D3, roughness: 0.8 });
  const platform = new THREE.Mesh(new THREE.BoxGeometry(28, 1, 6), platformMaterial);
  platform.position.set(0, 0.5, depth / 2 + 3);
  platform.receiveShadow = true;
  group.add(platform);

  // Steps
  for (let i = 0; i < 4; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(28, 0.3, 1), platformMaterial);
    step.position.set(0, i * 0.25 + 0.15, depth / 2 + 6.5 - i * 0.5);
    step.receiveShadow = true;
    group.add(step);
  }

  // Windows grid
  addWindows(group, width, height, depth, 3, 8);

  // Grand entrance doors
  const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.7 });
  const leftDoor = new THREE.Mesh(new THREE.BoxGeometry(3, 6, 0.3), doorMaterial);
  leftDoor.position.set(-2, 3, depth / 2 + 0.15);
  group.add(leftDoor);
  const rightDoor = new THREE.Mesh(new THREE.BoxGeometry(3, 6, 0.3), doorMaterial);
  rightDoor.position.set(2, 3, depth / 2 + 0.15);
  group.add(rightDoor);

  group.userData.collisionBox = new THREE.Box3().setFromObject(group);
  group.userData.buildingType = 'townhall';

  return group;
}

/**
 * WAREHOUSE - Industrial building
 */
export function createWarehouse(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'warehouse';

  const width = 25 + Math.random() * 15;
  const depth = 30 + Math.random() * 20;
  const height = 8 + Math.random() * 4;

  // Main body - corrugated metal look
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x808080,
    roughness: 0.9,
    metalness: 0.3,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), bodyMaterial);
  body.position.y = height / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Slight pitched roof
  const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x696969, roughness: 0.8, metalness: 0.4 });
  const roofGeometry = new THREE.BoxGeometry(width + 1, 1, depth + 1);
  const roof = new THREE.Mesh(roofGeometry, roofMaterial);
  roof.position.y = height + 0.5;
  roof.castShadow = true;
  group.add(roof);

  // Large rolling doors
  const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.7, metalness: 0.5 });
  const numDoors = Math.floor(width / 8);
  for (let i = 0; i < numDoors; i++) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(5, 6, 0.3), doorMaterial);
    door.position.set((i - (numDoors - 1) / 2) * 7, 3, depth / 2 + 0.15);
    group.add(door);

    // Door frame
    const frameMaterial = new THREE.MeshStandardMaterial({ color: 0xFFD700, roughness: 0.6 });
    const frameTop = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.3, 0.4), frameMaterial);
    frameTop.position.set((i - (numDoors - 1) / 2) * 7, 6.15, depth / 2 + 0.2);
    group.add(frameTop);
  }

  // Small windows high up
  const windowMaterial = new THREE.MeshStandardMaterial({ color: 0xADD8E6, roughness: 0.3 });
  for (let i = 0; i < Math.floor(width / 5); i++) {
    const window = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1, 0.1), windowMaterial);
    window.position.set((i - Math.floor(width / 10)) * 5, height - 1.5, depth / 2 + 0.05);
    group.add(window);
  }

  group.userData.collisionBox = new THREE.Box3().setFromObject(group);
  group.userData.buildingType = 'warehouse';

  return group;
}

/**
 * Factory function to create building by type
 */
export type BuildingType = 'house' | 'apartment' | 'skyscraper' | 'shop' | 'office' | 'church' | 'townhall' | 'warehouse';

export function createBuilding(type: BuildingType): THREE.Group {
  switch (type) {
    case 'house': return createHouse();
    case 'apartment': return createApartmentBlock();
    case 'skyscraper': return createSkyscraper();
    case 'shop': return createShop();
    case 'office': return createOffice();
    case 'church': return createChurch();
    case 'townhall': return createTownHall();
    case 'warehouse': return createWarehouse();
    default: return createHouse();
  }
}
