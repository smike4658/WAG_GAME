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
 * Create a stadium block (takes 2x2 blocks)
 */
export function createStadiumBlock(blockSize: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'stadium_block';

  const stadiumSize = blockSize * 2 - 12;
  const fieldWidth = stadiumSize * 0.6;
  const fieldLength = stadiumSize * 0.8;

  // Running track (oval)
  const trackGeo = new THREE.RingGeometry(
    Math.min(fieldWidth, fieldLength) / 2 + 5,
    Math.min(fieldWidth, fieldLength) / 2 + 12,
    64
  );
  const trackMat = new THREE.MeshLambertMaterial({ color: 0xcc4422 });
  const track = new THREE.Mesh(trackGeo, trackMat);
  track.rotation.x = -Math.PI / 2;
  track.position.y = 0.01;
  group.add(track);

  // Inner grass field
  const grassGeo = new THREE.CircleGeometry(Math.min(fieldWidth, fieldLength) / 2 + 5, 64);
  const grassMat = new THREE.MeshLambertMaterial({ color: 0x2d8c3c });
  const grass = new THREE.Mesh(grassGeo, grassMat);
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = 0.02;
  group.add(grass);

  // Football field markings
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  // Outer rectangle lines
  const outerLines = [
    { x: 0, z: -fieldLength / 2 + 5, w: fieldWidth - 10, h: 0.15 },
    { x: 0, z: fieldLength / 2 - 5, w: fieldWidth - 10, h: 0.15 },
    { x: -fieldWidth / 2 + 5, z: 0, w: 0.15, h: fieldLength - 10 },
    { x: fieldWidth / 2 - 5, z: 0, w: 0.15, h: fieldLength - 10 },
  ];

  outerLines.forEach(line => {
    const lineGeo = new THREE.PlaneGeometry(line.w, line.h);
    const lineMesh = new THREE.Mesh(lineGeo, lineMat);
    lineMesh.rotation.x = -Math.PI / 2;
    if (line.w < 1) {
      lineMesh.rotation.z = Math.PI / 2;
    }
    lineMesh.position.set(line.x, 0.03, line.z);
    group.add(lineMesh);
  });

  // Center line
  const centerLine = new THREE.Mesh(
    new THREE.PlaneGeometry(fieldWidth - 10, 0.15),
    lineMat
  );
  centerLine.rotation.x = -Math.PI / 2;
  centerLine.position.set(0, 0.03, 0);
  group.add(centerLine);

  // Center circle
  const centerCircle = new THREE.Mesh(
    new THREE.RingGeometry(8, 8.15, 32),
    lineMat
  );
  centerCircle.rotation.x = -Math.PI / 2;
  centerCircle.position.y = 0.03;
  group.add(centerCircle);

  // Goals
  const goalMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const goalWidth = 7;
  const goalHeight = 2.5;

  const createGoal = (z: number, rotation: number): THREE.Group => {
    const goal = new THREE.Group();
    const postGeo = new THREE.CylinderGeometry(0.1, 0.1, goalHeight);

    const leftPost = new THREE.Mesh(postGeo, goalMat);
    leftPost.position.set(-goalWidth / 2, goalHeight / 2, 0);
    goal.add(leftPost);

    const rightPost = new THREE.Mesh(postGeo, goalMat);
    rightPost.position.set(goalWidth / 2, goalHeight / 2, 0);
    goal.add(rightPost);

    const crossbarGeo = new THREE.CylinderGeometry(0.1, 0.1, goalWidth);
    const crossbar = new THREE.Mesh(crossbarGeo, goalMat);
    crossbar.position.set(0, goalHeight, 0);
    crossbar.rotation.z = Math.PI / 2;
    goal.add(crossbar);

    goal.position.set(0, 0, z);
    goal.rotation.y = rotation;
    return goal;
  };

  const goal1 = createGoal(-fieldLength / 2 + 5, 0);
  const goal2 = createGoal(fieldLength / 2 - 5, Math.PI);
  group.add(goal1);
  group.add(goal2);

  // Bleachers/stands
  const standMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
  const standSeatMat = new THREE.MeshLambertMaterial({ color: 0xcc0000 });

  const createStand = (x: number, z: number, width: number, rotation: number): THREE.Group => {
    const stand = new THREE.Group();
    const rows = 5;
    const rowHeight = 1;
    const rowDepth = 1.5;

    for (let i = 0; i < rows; i++) {
      const stepGeo = new THREE.BoxGeometry(width, rowHeight, rowDepth);
      const step = new THREE.Mesh(stepGeo, standMat);
      step.position.set(0, i * rowHeight + rowHeight / 2, i * rowDepth);
      stand.add(step);

      const seatGeo = new THREE.BoxGeometry(width, 0.3, 0.5);
      const seat = new THREE.Mesh(seatGeo, standSeatMat);
      seat.position.set(0, i * rowHeight + rowHeight + 0.15, i * rowDepth);
      stand.add(seat);
    }

    stand.position.set(x, 0, z);
    stand.rotation.y = rotation;
    return stand;
  };

  const standOffset = Math.min(fieldWidth, fieldLength) / 2 + 15;
  const stands = [
    createStand(0, -standOffset, stadiumSize * 0.5, 0),
    createStand(0, standOffset, stadiumSize * 0.5, Math.PI),
    createStand(-standOffset, 0, stadiumSize * 0.4, Math.PI / 2),
    createStand(standOffset, 0, stadiumSize * 0.4, -Math.PI / 2),
  ];

  stands.forEach(stand => group.add(stand));

  // Floodlights at corners
  const createFloodlight = (): THREE.Group => {
    const light = new THREE.Group();
    const poleGeo = new THREE.CylinderGeometry(0.3, 0.4, 25);
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 12.5;
    light.add(pole);

    const fixtureMat = new THREE.MeshLambertMaterial({ color: 0xffffcc });
    const fixtureGeo = new THREE.BoxGeometry(3, 1, 2);
    const fixture = new THREE.Mesh(fixtureGeo, fixtureMat);
    fixture.position.y = 25;
    light.add(fixture);

    return light;
  };

  const lightPositions = [
    { x: -stadiumSize / 2 + 5, z: -stadiumSize / 2 + 5 },
    { x: stadiumSize / 2 - 5, z: -stadiumSize / 2 + 5 },
    { x: -stadiumSize / 2 + 5, z: stadiumSize / 2 - 5 },
    { x: stadiumSize / 2 - 5, z: stadiumSize / 2 - 5 },
  ];

  lightPositions.forEach(pos => {
    const floodlight = createFloodlight();
    floodlight.position.set(pos.x, 0, pos.z);
    group.add(floodlight);
    markForCylinderCollision(floodlight, 0.5);
  });

  return group;
}
