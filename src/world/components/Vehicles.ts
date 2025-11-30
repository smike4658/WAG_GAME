import * as THREE from 'three';

/**
 * Vehicle color palettes
 */
const COLORS = {
  cars: [0xFF6B6B, 0x4ECDC4, 0x45B7D1, 0x96CEB4, 0xFECE61, 0xE8E8E8, 0x2C3E50, 0x9B59B6],
  vans: [0xFFFFFF, 0x3498DB, 0xE74C3C, 0xF39C12, 0x27AE60],
  buses: [0xE74C3C, 0x3498DB, 0x27AE60, 0xF39C12],
  trucks: [0x2C3E50, 0x7F8C8D, 0xE74C3C, 0x3498DB],
  trams: [0xE74C3C, 0x2ECC71, 0x3498DB],
  windows: [0x87CEEB, 0xADD8E6, 0xB0E0E6],
  wheels: [0x1a1a1a, 0x2c2c2c],
  chrome: [0xC0C0C0, 0xD3D3D3],
};

function randomFrom<T>(arr: T[]): T {
  const index = Math.floor(Math.random() * arr.length);
  return arr[index] as T;
}

/**
 * Create wheel helper
 */
function createWheel(radius: number, width: number): THREE.Mesh {
  const wheelGeometry = new THREE.CylinderGeometry(radius, radius, width, 12);
  wheelGeometry.rotateZ(Math.PI / 2);
  const wheelMaterial = new THREE.MeshStandardMaterial({
    color: randomFrom(COLORS.wheels),
    roughness: 0.8,
    metalness: 0.2,
  });
  const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
  wheel.castShadow = true;
  return wheel;
}

/**
 * CAR - Standard passenger car
 */
export function createCar(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'car';

  const bodyColor = randomFrom(COLORS.cars);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.4,
    metalness: 0.6,
  });

  // Car body - lower part
  const bodyLower = new THREE.Mesh(
    new THREE.BoxGeometry(4, 1, 2),
    bodyMaterial
  );
  bodyLower.position.y = 0.7;
  bodyLower.castShadow = true;
  group.add(bodyLower);

  // Car body - upper part (cabin)
  const bodyUpper = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 1, 1.8),
    bodyMaterial
  );
  bodyUpper.position.set(-0.3, 1.5, 0);
  bodyUpper.castShadow = true;
  group.add(bodyUpper);

  // Windows
  const windowMaterial = new THREE.MeshStandardMaterial({
    color: randomFrom(COLORS.windows),
    roughness: 0.1,
    metalness: 0.3,
    transparent: true,
    opacity: 0.7,
  });

  // Front windshield
  const frontWindow = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.8, 1.6),
    windowMaterial
  );
  frontWindow.position.set(0.85, 1.5, 0);
  frontWindow.rotation.z = 0.3;
  group.add(frontWindow);

  // Rear window
  const rearWindow = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.7, 1.6),
    windowMaterial
  );
  rearWindow.position.set(-1.5, 1.45, 0);
  rearWindow.rotation.z = -0.2;
  group.add(rearWindow);

  // Side windows
  const sideWindowL = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.6, 0.1),
    windowMaterial
  );
  sideWindowL.position.set(-0.3, 1.6, 0.95);
  group.add(sideWindowL);

  const sideWindowR = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.6, 0.1),
    windowMaterial
  );
  sideWindowR.position.set(-0.3, 1.6, -0.95);
  group.add(sideWindowR);

  // Wheels
  const wheelPositions = [
    { x: 1.2, z: 1 },
    { x: 1.2, z: -1 },
    { x: -1.2, z: 1 },
    { x: -1.2, z: -1 },
  ];
  wheelPositions.forEach(pos => {
    const wheel = createWheel(0.4, 0.3);
    wheel.position.set(pos.x, 0.4, pos.z);
    group.add(wheel);
  });

  // Headlights
  const lightMaterial = new THREE.MeshStandardMaterial({
    color: 0xFFFFAA,
    emissive: 0xFFFFAA,
    emissiveIntensity: 0.3,
    roughness: 0.3,
  });
  const headlightL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.4), lightMaterial);
  headlightL.position.set(2.05, 0.7, 0.6);
  group.add(headlightL);
  const headlightR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.4), lightMaterial);
  headlightR.position.set(2.05, 0.7, -0.6);
  group.add(headlightR);

  // Taillights
  const tailMaterial = new THREE.MeshStandardMaterial({
    color: 0xFF0000,
    emissive: 0xFF0000,
    emissiveIntensity: 0.2,
    roughness: 0.4,
  });
  const taillightL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.25, 0.3), tailMaterial);
  taillightL.position.set(-2.05, 0.7, 0.6);
  group.add(taillightL);
  const taillightR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.25, 0.3), tailMaterial);
  taillightR.position.set(-2.05, 0.7, -0.6);
  group.add(taillightR);

  group.userData.collisionBox = new THREE.Box3().setFromObject(group);
  group.userData.vehicleType = 'car';

  return group;
}

/**
 * VAN - Delivery van
 */
export function createVan(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'van';

  const bodyColor = randomFrom(COLORS.vans);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.5,
    metalness: 0.4,
  });

  // Main cargo body
  const cargoBody = new THREE.Mesh(
    new THREE.BoxGeometry(4.5, 2.2, 2.2),
    bodyMaterial
  );
  cargoBody.position.set(-0.5, 1.4, 0);
  cargoBody.castShadow = true;
  group.add(cargoBody);

  // Front cabin
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 1.8, 2.2),
    bodyMaterial
  );
  cabin.position.set(2, 1.2, 0);
  cabin.castShadow = true;
  group.add(cabin);

  // Front windshield
  const windowMaterial = new THREE.MeshStandardMaterial({
    color: randomFrom(COLORS.windows),
    roughness: 0.1,
    metalness: 0.3,
    transparent: true,
    opacity: 0.7,
  });
  const frontWindow = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 1.2, 2),
    windowMaterial
  );
  frontWindow.position.set(2.95, 1.4, 0);
  frontWindow.rotation.z = 0.15;
  group.add(frontWindow);

  // Side windows on cabin
  const sideWindowL = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.8, 0.1),
    windowMaterial
  );
  sideWindowL.position.set(2, 1.5, 1.15);
  group.add(sideWindowL);
  const sideWindowR = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.8, 0.1),
    windowMaterial
  );
  sideWindowR.position.set(2, 1.5, -1.15);
  group.add(sideWindowR);

  // Wheels (larger)
  const wheelPositions = [
    { x: 1.8, z: 1.1 },
    { x: 1.8, z: -1.1 },
    { x: -1.5, z: 1.1 },
    { x: -1.5, z: -1.1 },
  ];
  wheelPositions.forEach(pos => {
    const wheel = createWheel(0.5, 0.35);
    wheel.position.set(pos.x, 0.5, pos.z);
    group.add(wheel);
  });

  // Rear doors detail
  const doorLine = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 2, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x333333 })
  );
  doorLine.position.set(-2.78, 1.4, 0);
  group.add(doorLine);

  group.userData.collisionBox = new THREE.Box3().setFromObject(group);
  group.userData.vehicleType = 'van';

  return group;
}

/**
 * BUS - City bus
 */
export function createBus(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'bus';

  const bodyColor = randomFrom(COLORS.buses);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.5,
    metalness: 0.3,
  });

  // Main body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(10, 2.8, 2.8),
    bodyMaterial
  );
  body.position.y = 1.8;
  body.castShadow = true;
  group.add(body);

  // Roof slightly different color
  const roofMaterial = new THREE.MeshStandardMaterial({
    color: 0xE8E8E8,
    roughness: 0.6,
    metalness: 0.2,
  });
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(10.1, 0.2, 2.9),
    roofMaterial
  );
  roof.position.y = 3.3;
  roof.castShadow = true;
  group.add(roof);

  // Windows row
  const windowMaterial = new THREE.MeshStandardMaterial({
    color: randomFrom(COLORS.windows),
    roughness: 0.1,
    metalness: 0.3,
    transparent: true,
    opacity: 0.6,
  });

  for (let i = 0; i < 5; i++) {
    const windowL = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 1.2, 0.1),
      windowMaterial
    );
    windowL.position.set(-3.5 + i * 2, 2.2, 1.45);
    group.add(windowL);

    const windowR = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 1.2, 0.1),
      windowMaterial
    );
    windowR.position.set(-3.5 + i * 2, 2.2, -1.45);
    group.add(windowR);
  }

  // Front windshield
  const frontWindow = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 1.8, 2.6),
    windowMaterial
  );
  frontWindow.position.set(5.05, 2, 0);
  group.add(frontWindow);

  // Rear window
  const rearWindow = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 1.5, 2.4),
    windowMaterial
  );
  rearWindow.position.set(-5.05, 2.2, 0);
  group.add(rearWindow);

  // Wheels (6 wheels - dual rear)
  const wheel1 = createWheel(0.55, 0.4);
  wheel1.position.set(3.5, 0.55, 1.3);
  group.add(wheel1);
  const wheel2 = createWheel(0.55, 0.4);
  wheel2.position.set(3.5, 0.55, -1.3);
  group.add(wheel2);
  const wheel3 = createWheel(0.55, 0.4);
  wheel3.position.set(-3, 0.55, 1.3);
  group.add(wheel3);
  const wheel4 = createWheel(0.55, 0.4);
  wheel4.position.set(-3, 0.55, -1.3);
  group.add(wheel4);
  const wheel5 = createWheel(0.55, 0.4);
  wheel5.position.set(-3.8, 0.55, 1.3);
  group.add(wheel5);
  const wheel6 = createWheel(0.55, 0.4);
  wheel6.position.set(-3.8, 0.55, -1.3);
  group.add(wheel6);

  // Door area (darker)
  const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.7 });
  const door1 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2, 0.1), doorMaterial);
  door1.position.set(2.5, 1.5, 1.45);
  group.add(door1);
  const door2 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2, 0.1), doorMaterial);
  door2.position.set(-1.5, 1.5, 1.45);
  group.add(door2);

  // Route number display
  const displayMaterial = new THREE.MeshStandardMaterial({
    color: 0xFFAA00,
    emissive: 0xFFAA00,
    emissiveIntensity: 0.3,
  });
  const display = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 1.5), displayMaterial);
  display.position.set(5.06, 2.8, 0);
  group.add(display);

  group.userData.collisionBox = new THREE.Box3().setFromObject(group);
  group.userData.vehicleType = 'bus';

  return group;
}

/**
 * TRUCK - Cargo truck
 */
export function createTruck(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'truck';

  const cabinColor = randomFrom(COLORS.trucks);
  const cabinMaterial = new THREE.MeshStandardMaterial({
    color: cabinColor,
    roughness: 0.5,
    metalness: 0.4,
  });

  // Cabin
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 2.5, 2.5),
    cabinMaterial
  );
  cabin.position.set(2.5, 1.8, 0);
  cabin.castShadow = true;
  group.add(cabin);

  // Cargo container
  const cargoMaterial = new THREE.MeshStandardMaterial({
    color: 0xE8E8E8,
    roughness: 0.7,
    metalness: 0.2,
  });
  const cargo = new THREE.Mesh(
    new THREE.BoxGeometry(6, 3, 2.6),
    cargoMaterial
  );
  cargo.position.set(-1.5, 2, 0);
  cargo.castShadow = true;
  group.add(cargo);

  // Windshield
  const windowMaterial = new THREE.MeshStandardMaterial({
    color: randomFrom(COLORS.windows),
    roughness: 0.1,
    metalness: 0.3,
    transparent: true,
    opacity: 0.7,
  });
  const frontWindow = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 1.5, 2.2),
    windowMaterial
  );
  frontWindow.position.set(3.8, 2.2, 0);
  group.add(frontWindow);

  // Side windows
  const sideWindowL = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.1), windowMaterial);
  sideWindowL.position.set(2.5, 2.3, 1.3);
  group.add(sideWindowL);
  const sideWindowR = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.1), windowMaterial);
  sideWindowR.position.set(2.5, 2.3, -1.3);
  group.add(sideWindowR);

  // Wheels (6 wheels)
  const wheel1 = createWheel(0.6, 0.4);
  wheel1.position.set(2.8, 0.6, 1.3);
  group.add(wheel1);
  const wheel2 = createWheel(0.6, 0.4);
  wheel2.position.set(2.8, 0.6, -1.3);
  group.add(wheel2);
  const wheel3 = createWheel(0.6, 0.4);
  wheel3.position.set(-2.5, 0.6, 1.3);
  group.add(wheel3);
  const wheel4 = createWheel(0.6, 0.4);
  wheel4.position.set(-2.5, 0.6, -1.3);
  group.add(wheel4);
  const wheel5 = createWheel(0.6, 0.4);
  wheel5.position.set(-3.5, 0.6, 1.3);
  group.add(wheel5);
  const wheel6 = createWheel(0.6, 0.4);
  wheel6.position.set(-3.5, 0.6, -1.3);
  group.add(wheel6);

  // Exhaust pipe
  const exhaustMaterial = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.6, metalness: 0.5 });
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 2.5, 8), exhaustMaterial);
  exhaust.position.set(1.3, 2.5, 1.3);
  group.add(exhaust);

  group.userData.collisionBox = new THREE.Box3().setFromObject(group);
  group.userData.vehicleType = 'truck';

  return group;
}

/**
 * TRAM - City tram/streetcar (Ostrava style!)
 */
export function createTram(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'tram';

  const bodyColor = randomFrom(COLORS.trams);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.4,
    metalness: 0.5,
  });

  // Main body - two connected cars
  const car1 = new THREE.Mesh(
    new THREE.BoxGeometry(8, 2.8, 2.6),
    bodyMaterial
  );
  car1.position.set(4.5, 1.7, 0);
  car1.castShadow = true;
  group.add(car1);

  const car2 = new THREE.Mesh(
    new THREE.BoxGeometry(8, 2.8, 2.6),
    bodyMaterial
  );
  car2.position.set(-4.5, 1.7, 0);
  car2.castShadow = true;
  group.add(car2);

  // Connection accordion
  const accordionMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 });
  const accordion = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 2.4, 2.4),
    accordionMaterial
  );
  accordion.position.set(0, 1.7, 0);
  group.add(accordion);

  // Roof
  const roofMaterial = new THREE.MeshStandardMaterial({ color: 0xE8E8E8, roughness: 0.6 });
  const roof1 = new THREE.Mesh(new THREE.BoxGeometry(8.1, 0.2, 2.7), roofMaterial);
  roof1.position.set(4.5, 3.2, 0);
  group.add(roof1);
  const roof2 = new THREE.Mesh(new THREE.BoxGeometry(8.1, 0.2, 2.7), roofMaterial);
  roof2.position.set(-4.5, 3.2, 0);
  group.add(roof2);

  // Windows
  const windowMaterial = new THREE.MeshStandardMaterial({
    color: 0xADD8E6,
    roughness: 0.1,
    metalness: 0.3,
    transparent: true,
    opacity: 0.6,
  });

  // Windows for both cars
  [-4.5, 4.5].forEach(carX => {
    for (let i = 0; i < 4; i++) {
      const windowL = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 0.1), windowMaterial);
      windowL.position.set(carX - 2.5 + i * 1.8, 2, 1.35);
      group.add(windowL);

      const windowR = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 0.1), windowMaterial);
      windowR.position.set(carX - 2.5 + i * 1.8, 2, -1.35);
      group.add(windowR);
    }
  });

  // Front/rear windshields
  const frontWindow = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.8, 2.4), windowMaterial);
  frontWindow.position.set(8.55, 2, 0);
  group.add(frontWindow);
  const rearWindow = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.8, 2.4), windowMaterial);
  rearWindow.position.set(-8.55, 2, 0);
  group.add(rearWindow);

  // Wheels (on rail bogies)
  const bogiePositions = [6, 3, -3, -6];
  bogiePositions.forEach(x => {
    const wheel1 = createWheel(0.4, 0.2);
    wheel1.position.set(x, 0.4, 0.8);
    group.add(wheel1);
    const wheel2 = createWheel(0.4, 0.2);
    wheel2.position.set(x, 0.4, -0.8);
    group.add(wheel2);
  });

  // Pantograph (power collector)
  const pantographMaterial = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.5, metalness: 0.6 });
  const pantographBase = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 1), pantographMaterial);
  pantographBase.position.set(4.5, 3.35, 0);
  group.add(pantographBase);

  const pantographArm1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 0.1), pantographMaterial);
  pantographArm1.position.set(4.5, 4, 0.3);
  pantographArm1.rotation.z = 0.3;
  group.add(pantographArm1);
  const pantographArm2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 0.1), pantographMaterial);
  pantographArm2.position.set(4.5, 4, -0.3);
  pantographArm2.rotation.z = 0.3;
  group.add(pantographArm2);

  const pantographTop = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 1.5), pantographMaterial);
  pantographTop.position.set(4.5, 4.7, 0);
  group.add(pantographTop);

  // Doors (darker)
  const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.7 });
  const doorPositions = [6.5, 2.5, -2.5, -6.5];
  doorPositions.forEach(x => {
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.1), doorMaterial);
    door.position.set(x, 1.5, 1.35);
    group.add(door);
  });

  // Destination display
  const displayMaterial = new THREE.MeshStandardMaterial({
    color: 0xFFAA00,
    emissive: 0xFFAA00,
    emissiveIntensity: 0.4,
  });
  const display = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 1.8), displayMaterial);
  display.position.set(8.56, 2.7, 0);
  group.add(display);

  group.userData.collisionBox = new THREE.Box3().setFromObject(group);
  group.userData.vehicleType = 'tram';

  return group;
}

/**
 * Factory function to create vehicle by type
 */
export type VehicleType = 'car' | 'van' | 'bus' | 'truck' | 'tram';

export function createVehicle(type: VehicleType): THREE.Group {
  switch (type) {
    case 'car': return createCar();
    case 'van': return createVan();
    case 'bus': return createBus();
    case 'truck': return createTruck();
    case 'tram': return createTram();
    default: return createCar();
  }
}
