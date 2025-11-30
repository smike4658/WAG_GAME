import type { LocalCoordinate, MapConfig } from './types';
import { OSTRAVA_CONFIG } from './types';

/**
 * Converts GPS coordinates (lat/lon) to local game world coordinates (meters)
 * Uses a simple equirectangular projection centered on the reference point.
 *
 * Game world orientation:
 * - +X = East
 * - -X = West
 * - +Z = North
 * - -Z = South
 * - Center (0, 0) = Reference point (Masaryk Statue)
 */
export class CoordinateConverter {
  private readonly metersPerDegLat: number;
  private readonly metersPerDegLon: number;

  constructor(private readonly config: MapConfig = OSTRAVA_CONFIG) {
    // Earth's circumference at equator is ~40,075 km
    // 1 degree of latitude is always ~111.32 km
    this.metersPerDegLat = 111320;

    // Longitude degrees shrink with latitude (cosine correction)
    const latRad = this.config.refLat * (Math.PI / 180);
    this.metersPerDegLon = 111320 * Math.cos(latRad);
  }

  /**
   * Convert lat/lon to local X/Z coordinates in meters
   */
  public toLocal(lat: number, lon: number): LocalCoordinate {
    const x = (lon - this.config.refLon) * this.metersPerDegLon;
    const z = (lat - this.config.refLat) * this.metersPerDegLat;
    return { x, z };
  }

  /**
   * Convert local X/Z back to lat/lon (for debugging)
   */
  public toLatLon(local: LocalCoordinate): { lat: number; lon: number } {
    const lon = local.x / this.metersPerDegLon + this.config.refLon;
    const lat = local.z / this.metersPerDegLat + this.config.refLat;
    return { lat, lon };
  }

  /**
   * Get the bounds of the map in local coordinates
   */
  public getLocalBounds(): { minX: number; maxX: number; minZ: number; maxZ: number } {
    const [south, west, north, east] = this.config.bbox;
    const sw = this.toLocal(south, west);
    const ne = this.toLocal(north, east);

    return {
      minX: sw.x,
      maxX: ne.x,
      minZ: sw.z,
      maxZ: ne.z,
    };
  }

  /**
   * Get the approximate size of the map area in meters
   */
  public getMapSize(): { width: number; height: number } {
    const bounds = this.getLocalBounds();
    return {
      width: bounds.maxX - bounds.minX,
      height: bounds.maxZ - bounds.minZ,
    };
  }

  /**
   * Check if a local coordinate is within the map bounds
   */
  public isInBounds(local: LocalCoordinate): boolean {
    const bounds = this.getLocalBounds();
    return (
      local.x >= bounds.minX &&
      local.x <= bounds.maxX &&
      local.z >= bounds.minZ &&
      local.z <= bounds.maxZ
    );
  }
}
