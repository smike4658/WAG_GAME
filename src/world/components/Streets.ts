import * as THREE from 'three';

/**
 * Street colors and materials
 */
const COLORS = {
  asphalt: 0x333333,
  asphaltLight: 0x444444,
  sidewalk: 0xC0C0C0,
  sidewalkLines: 0xA0A0A0,
  roadLines: 0xFFFFFF,
  crosswalk: 0xFFFFFF,
  curb: 0x808080,
};

/**
 * Create a straight road segment
 */
export function createRoadSegment(length: number, width: number = 10): THREE.Group {
  const group = new THREE.Group();
  group.name = 'road_segment';

  // Main road surface
  const roadMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.asphalt,
    roughness: 0.9,
    metalness: 0.0,
  });

  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(width, length),
    roadMaterial
  );
  road.rotation.x = -Math.PI / 2;
  road.receiveShadow = true;
  group.add(road);

  // Center line (dashed)
  const lineMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.roadLines,
    roughness: 0.7,
  });

  const dashLength = 3;
  const dashGap = 2;
  const numDashes = Math.floor(length / (dashLength + dashGap));

  for (let i = 0; i < numDashes; i++) {
    const dash = new THREE.Mesh(
      new THREE.PlaneGeometry(0.15, dashLength),
      lineMaterial
    );
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(0, 0.01, -length / 2 + (i + 0.5) * (dashLength + dashGap));
    group.add(dash);
  }

  // Edge lines (solid)
  const edgeOffset = width / 2 - 0.5;
  const leftLine = new THREE.Mesh(
    new THREE.PlaneGeometry(0.1, length),
    lineMaterial
  );
  leftLine.rotation.x = -Math.PI / 2;
  leftLine.position.set(-edgeOffset, 0.01, 0);
  group.add(leftLine);

  const rightLine = new THREE.Mesh(
    new THREE.PlaneGeometry(0.1, length),
    lineMaterial
  );
  rightLine.rotation.x = -Math.PI / 2;
  rightLine.position.set(edgeOffset, 0.01, 0);
  group.add(rightLine);

  group.userData.roadType = 'segment';
  group.userData.width = width;
  group.userData.length = length;

  return group;
}

/**
 * Create sidewalk segment
 */
export function createSidewalk(length: number, width: number = 3): THREE.Group {
  const group = new THREE.Group();
  group.name = 'sidewalk';

  // Main sidewalk surface
  const sidewalkMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.sidewalk,
    roughness: 0.85,
  });

  const sidewalk = new THREE.Mesh(
    new THREE.PlaneGeometry(width, length),
    sidewalkMaterial
  );
  sidewalk.rotation.x = -Math.PI / 2;
  sidewalk.position.y = 0.1; // Slightly raised
  sidewalk.receiveShadow = true;
  group.add(sidewalk);

  // Curb
  const curbMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.curb,
    roughness: 0.8,
  });

  const curb = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.15, length),
    curbMaterial
  );
  curb.position.set(-width / 2 + 0.075, 0.075, 0);
  curb.castShadow = true;
  group.add(curb);

  // Paving pattern (subtle lines)
  const lineMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.sidewalkLines,
    roughness: 0.9,
  });

  const slabSize = 1.5;
  const numSlabs = Math.floor(length / slabSize);

  for (let i = 0; i <= numSlabs; i++) {
    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(width - 0.2, 0.03),
      lineMaterial
    );
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.11, -length / 2 + i * slabSize);
    group.add(line);
  }

  group.userData.propType = 'sidewalk';

  return group;
}

/**
 * Create a crosswalk
 */
export function createCrosswalk(width: number = 10): THREE.Group {
  const group = new THREE.Group();
  group.name = 'crosswalk';

  const crosswalkWidth = 4;
  const stripeWidth = 0.5;
  const stripeGap = 0.5;
  const numStripes = Math.floor(width / (stripeWidth + stripeGap));

  const stripeMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.crosswalk,
    roughness: 0.7,
  });

  for (let i = 0; i < numStripes; i++) {
    const stripe = new THREE.Mesh(
      new THREE.PlaneGeometry(crosswalkWidth, stripeWidth),
      stripeMaterial
    );
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(
      0,
      0.02,
      -width / 2 + stripeGap + i * (stripeWidth + stripeGap) + stripeWidth / 2
    );
    group.add(stripe);
  }

  group.userData.propType = 'crosswalk';

  return group;
}

/**
 * Create an intersection (4-way)
 */
export function createIntersection(size: number = 14): THREE.Group {
  const group = new THREE.Group();
  group.name = 'intersection';

  // Main intersection surface
  const roadMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.asphalt,
    roughness: 0.9,
  });

  const intersection = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    roadMaterial
  );
  intersection.rotation.x = -Math.PI / 2;
  intersection.receiveShadow = true;
  group.add(intersection);

  // Crosswalks on all 4 sides
  const crosswalkOffset = size / 2 - 2;
  const directions = [
    { x: crosswalkOffset, z: 0, rot: 0 },
    { x: -crosswalkOffset, z: 0, rot: 0 },
    { x: 0, z: crosswalkOffset, rot: Math.PI / 2 },
    { x: 0, z: -crosswalkOffset, rot: Math.PI / 2 },
  ];

  directions.forEach(dir => {
    const crosswalk = createCrosswalk(size - 4);
    crosswalk.position.set(dir.x, 0, dir.z);
    crosswalk.rotation.y = dir.rot;
    group.add(crosswalk);
  });

  // Stop lines
  const stopLineMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.roadLines,
    roughness: 0.7,
  });

  const stopLineOffset = size / 2 - 4;
  const stopLinePositions = [
    { x: 0, z: stopLineOffset, rot: 0 },
    { x: 0, z: -stopLineOffset, rot: 0 },
    { x: stopLineOffset, z: 0, rot: Math.PI / 2 },
    { x: -stopLineOffset, z: 0, rot: Math.PI / 2 },
  ];

  stopLinePositions.forEach(pos => {
    const stopLine = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 0.3),
      stopLineMaterial
    );
    stopLine.rotation.x = -Math.PI / 2;
    stopLine.rotation.z = pos.rot;
    stopLine.position.set(pos.x, 0.01, pos.z);
    group.add(stopLine);
  });

  group.userData.roadType = 'intersection';
  group.userData.size = size;

  return group;
}

/**
 * Create a T-intersection
 */
export function createTIntersection(size: number = 12): THREE.Group {
  const group = new THREE.Group();
  group.name = 't_intersection';

  // Main surface
  const roadMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.asphalt,
    roughness: 0.9,
  });

  // T-shape: main road + perpendicular branch
  const mainRoad = new THREE.Mesh(
    new THREE.PlaneGeometry(size * 1.5, size * 0.8),
    roadMaterial
  );
  mainRoad.rotation.x = -Math.PI / 2;
  mainRoad.receiveShadow = true;
  group.add(mainRoad);

  const branch = new THREE.Mesh(
    new THREE.PlaneGeometry(size * 0.8, size * 0.6),
    roadMaterial
  );
  branch.rotation.x = -Math.PI / 2;
  branch.position.z = size * 0.5;
  branch.receiveShadow = true;
  group.add(branch);

  group.userData.roadType = 't_intersection';

  return group;
}

/**
 * Create plaza/square ground
 */
export function createPlaza(width: number, depth: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'plaza';

  // Main cobblestone surface
  const plazaMaterial = new THREE.MeshStandardMaterial({
    color: 0xB8A888,
    roughness: 0.85,
  });

  const plaza = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    plazaMaterial
  );
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.05;
  plaza.receiveShadow = true;
  group.add(plaza);

  // Decorative pattern (grid of slightly different colored tiles)
  const tileMaterial = new THREE.MeshStandardMaterial({
    color: 0xA89878,
    roughness: 0.9,
  });

  const tileSize = 2;
  const tilesX = Math.floor(width / tileSize);
  const tilesZ = Math.floor(depth / tileSize);

  for (let x = 0; x < tilesX; x++) {
    for (let z = 0; z < tilesZ; z++) {
      if ((x + z) % 3 === 0) {
        const tile = new THREE.Mesh(
          new THREE.PlaneGeometry(tileSize - 0.1, tileSize - 0.1),
          tileMaterial
        );
        tile.rotation.x = -Math.PI / 2;
        tile.position.set(
          -width / 2 + (x + 0.5) * tileSize,
          0.06,
          -depth / 2 + (z + 0.5) * tileSize
        );
        group.add(tile);
      }
    }
  }

  // Border/edge
  const borderMaterial = new THREE.MeshStandardMaterial({
    color: 0x808080,
    roughness: 0.8,
  });

  // North border
  const borderN = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.15, 0.3),
    borderMaterial
  );
  borderN.position.set(0, 0.075, -depth / 2);
  group.add(borderN);

  // South border
  const borderS = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.15, 0.3),
    borderMaterial
  );
  borderS.position.set(0, 0.075, depth / 2);
  group.add(borderS);

  // East border
  const borderE = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.15, depth),
    borderMaterial
  );
  borderE.position.set(width / 2, 0.075, 0);
  group.add(borderE);

  // West border
  const borderW = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.15, depth),
    borderMaterial
  );
  borderW.position.set(-width / 2, 0.075, 0);
  group.add(borderW);

  group.userData.areaType = 'plaza';
  group.userData.width = width;
  group.userData.depth = depth;

  return group;
}

/**
 * Create ground/grass area
 */
export function createGround(width: number, depth: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'ground';

  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a7c4e,
    roughness: 0.95,
  });

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    groundMaterial
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  group.add(ground);

  group.userData.areaType = 'ground';

  return group;
}

/**
 * Create tram tracks
 */
export function createTramTracks(length: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'tram_tracks';

  const railMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a4a4a,
    roughness: 0.5,
    metalness: 0.7,
  });

  const trackGauge = 1.5; // Distance between rails
  const railWidth = 0.08;
  const railHeight = 0.1;

  // Left rail
  const leftRail = new THREE.Mesh(
    new THREE.BoxGeometry(railWidth, railHeight, length),
    railMaterial
  );
  leftRail.position.set(-trackGauge / 2, railHeight / 2, 0);
  group.add(leftRail);

  // Right rail
  const rightRail = new THREE.Mesh(
    new THREE.BoxGeometry(railWidth, railHeight, length),
    railMaterial
  );
  rightRail.position.set(trackGauge / 2, railHeight / 2, 0);
  group.add(rightRail);

  // Sleepers (ties)
  const sleeperMaterial = new THREE.MeshStandardMaterial({
    color: 0x5D4037,
    roughness: 0.9,
  });

  const sleeperSpacing = 1;
  const numSleepers = Math.floor(length / sleeperSpacing);

  for (let i = 0; i < numSleepers; i++) {
    const sleeper = new THREE.Mesh(
      new THREE.BoxGeometry(trackGauge + 0.6, 0.08, 0.2),
      sleeperMaterial
    );
    sleeper.position.set(0, 0.02, -length / 2 + (i + 0.5) * sleeperSpacing);
    group.add(sleeper);
  }

  group.userData.propType = 'tram_tracks';

  return group;
}
