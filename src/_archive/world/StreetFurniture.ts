import * as THREE from 'three';
import type { LocalCoordinate, OSMElement } from './types';
import { CoordinateConverter } from './CoordinateConverter';

/**
 * Creates street furniture: lamps, benches, trash cans, tram stops
 * Adds life to the low-poly Ostrava streets
 */
export class StreetFurniture {
  private readonly converter: CoordinateConverter;
  private readonly furnitureGroup: THREE.Group;

  constructor() {
    this.converter = new CoordinateConverter();
    this.furnitureGroup = new THREE.Group();
    this.furnitureGroup.name = 'street-furniture';
  }

  /**
   * Process OSM elements and add street furniture
   */
  public processElements(elements: OSMElement[]): THREE.Group {
    // Find amenities for furniture placement
    const benches = elements.filter(
      (el) => el.type === 'node' && el.tags?.['amenity'] === 'bench'
    );

    const lamps = elements.filter(
      (el) => el.type === 'node' && el.tags?.['highway'] === 'street_lamp'
    );

    const tramStops = elements.filter(
      (el) => el.type === 'node' &&
      (el.tags?.['railway'] === 'tram_stop' || el.tags?.['public_transport'] === 'platform')
    );

    const wasteBaskets = elements.filter(
      (el) => el.type === 'node' && el.tags?.['amenity'] === 'waste_basket'
    );

    console.log(`[StreetFurniture] Found: ${lamps.length} lamps, ${benches.length} benches, ${tramStops.length} tram stops`);

    // Create furniture from OSM data
    for (const lamp of lamps) {
      if (lamp.lat !== undefined && lamp.lon !== undefined) {
        const pos = this.converter.toLocal(lamp.lat, lamp.lon);
        this.addStreetLamp(pos);
      }
    }

    for (const bench of benches) {
      if (bench.lat !== undefined && bench.lon !== undefined) {
        const pos = this.converter.toLocal(bench.lat, bench.lon);
        this.addBench(pos);
      }
    }

    for (const stop of tramStops) {
      if (stop.lat !== undefined && stop.lon !== undefined) {
        const pos = this.converter.toLocal(stop.lat, stop.lon);
        const name = stop.tags?.['name'] ?? 'Zastávka';
        this.addTramStop(pos, name);
      }
    }

    for (const basket of wasteBaskets) {
      if (basket.lat !== undefined && basket.lon !== undefined) {
        const pos = this.converter.toLocal(basket.lat, basket.lon);
        this.addTrashCan(pos);
      }
    }

    // If we don't have much OSM furniture data, add some procedurally
    if (lamps.length < 10) {
      this.addProceduralLamps();
    }

    return this.furnitureGroup;
  }

  /**
   * Create a simple street lamp
   */
  private addStreetLamp(pos: LocalCoordinate): void {
    const lamp = new THREE.Group();

    // Pole
    const poleGeometry = new THREE.CylinderGeometry(0.1, 0.15, 5, 6);
    const poleMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a3a3a,
      roughness: 0.7,
      metalness: 0.3,
    });
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
    pole.position.y = 2.5;
    pole.castShadow = true;
    lamp.add(pole);

    // Lamp head
    const headGeometry = new THREE.SphereGeometry(0.3, 8, 6);
    const headMaterial = new THREE.MeshStandardMaterial({
      color: 0xfffacd,
      emissive: 0xffff99,
      emissiveIntensity: 0.3,
      roughness: 0.2,
    });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 5.2;
    head.castShadow = true;
    lamp.add(head);

    // Point light for actual lighting
    const light = new THREE.PointLight(0xffeecc, 0.5, 15);
    light.position.y = 5;
    light.castShadow = false; // Performance
    lamp.add(light);

    lamp.position.set(pos.x, 0, pos.z);
    this.furnitureGroup.add(lamp);
  }

  /**
   * Create a simple bench
   */
  private addBench(pos: LocalCoordinate): void {
    const bench = new THREE.Group();

    // Seat
    const seatGeometry = new THREE.BoxGeometry(1.5, 0.1, 0.5);
    const woodMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b4513,
      roughness: 0.9,
    });
    const seat = new THREE.Mesh(seatGeometry, woodMaterial);
    seat.position.y = 0.5;
    seat.castShadow = true;
    bench.add(seat);

    // Backrest
    const backGeometry = new THREE.BoxGeometry(1.5, 0.5, 0.08);
    const back = new THREE.Mesh(backGeometry, woodMaterial);
    back.position.set(0, 0.75, -0.2);
    back.rotation.x = -0.1;
    back.castShadow = true;
    bench.add(back);

    // Legs
    const legMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a2a2a,
      roughness: 0.7,
      metalness: 0.3,
    });
    const legGeometry = new THREE.BoxGeometry(0.08, 0.5, 0.4);

    const leg1 = new THREE.Mesh(legGeometry, legMaterial);
    leg1.position.set(-0.6, 0.25, 0);
    bench.add(leg1);

    const leg2 = new THREE.Mesh(legGeometry, legMaterial);
    leg2.position.set(0.6, 0.25, 0);
    bench.add(leg2);

    bench.position.set(pos.x, 0, pos.z);
    bench.rotation.y = Math.random() * Math.PI * 2;
    this.furnitureGroup.add(bench);
  }

  /**
   * Create a tram stop shelter
   */
  private addTramStop(pos: LocalCoordinate, name: string): void {
    const stop = new THREE.Group();

    // Shelter roof
    const roofGeometry = new THREE.BoxGeometry(4, 0.2, 2);
    const roofMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a4a6a,
      roughness: 0.5,
      metalness: 0.4,
    });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = 2.8;
    roof.castShadow = true;
    stop.add(roof);

    // Support poles
    const poleMaterial = new THREE.MeshStandardMaterial({
      color: 0x6a6a6a,
      roughness: 0.6,
      metalness: 0.4,
    });
    const poleGeometry = new THREE.CylinderGeometry(0.08, 0.08, 2.8, 6);

    const positions = [[-1.8, -0.9], [-1.8, 0.9], [1.8, -0.9], [1.8, 0.9]];
    for (const [x, z] of positions) {
      const pole = new THREE.Mesh(poleGeometry, poleMaterial);
      pole.position.set(x ?? 0, 1.4, z ?? 0);
      pole.castShadow = true;
      stop.add(pole);
    }

    // Tram sign (yellow)
    const signGeometry = new THREE.BoxGeometry(0.6, 0.8, 0.1);
    const signMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      roughness: 0.3,
    });
    const sign = new THREE.Mesh(signGeometry, signMaterial);
    sign.position.set(2.2, 2, 0);
    sign.castShadow = true;
    stop.add(sign);

    // Sign pole
    const signPoleGeometry = new THREE.CylinderGeometry(0.05, 0.05, 2.5, 6);
    const signPole = new THREE.Mesh(signPoleGeometry, poleMaterial);
    signPole.position.set(2.2, 1.25, 0);
    stop.add(signPole);

    stop.position.set(pos.x, 0, pos.z);
    stop.userData = { name, type: 'tram_stop' };
    this.furnitureGroup.add(stop);

    console.log(`[StreetFurniture] Added tram stop: ${name}`);
  }

  /**
   * Create a trash can
   */
  private addTrashCan(pos: LocalCoordinate): void {
    const canGeometry = new THREE.CylinderGeometry(0.25, 0.2, 0.8, 8);
    const canMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d5a27,
      roughness: 0.8,
    });
    const can = new THREE.Mesh(canGeometry, canMaterial);
    can.position.set(pos.x, 0.4, pos.z);
    can.castShadow = true;
    this.furnitureGroup.add(can);
  }

  /**
   * Add procedural street lamps when OSM data is sparse
   */
  private addProceduralLamps(): void {
    const bounds = this.converter.getLocalBounds();
    const lampCount = 30;

    for (let i = 0; i < lampCount; i++) {
      const x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
      const z = bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ);
      this.addStreetLamp({ x, z });
    }

    console.log(`[StreetFurniture] Added ${lampCount} procedural street lamps`);
  }

  /**
   * Get the furniture group
   */
  public getGroup(): THREE.Group {
    return this.furnitureGroup;
  }
}
