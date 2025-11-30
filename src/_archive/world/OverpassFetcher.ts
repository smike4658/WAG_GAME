import type { OSMResponse, MapConfig } from './types';
import { OSTRAVA_CONFIG } from './types';

/**
 * Fetches OpenStreetMap data via the Overpass API
 * Returns buildings, roads, trees, and points of interest for the game area
 */
export class OverpassFetcher {
  private readonly apiUrl = 'https://overpass-api.de/api/interpreter';

  constructor(private readonly config: MapConfig = OSTRAVA_CONFIG) {}

  /**
   * Build the Overpass QL query for our map area
   */
  private buildQuery(): string {
    const [south, west, north, east] = this.config.bbox;
    const bboxStr = `${south},${west},${north},${east}`;

    return `
[out:json][bbox:${bboxStr}];
(
  // Buildings
  way["building"];
  relation["building"];

  // Roads and paths
  way["highway"];

  // Natural features
  node["natural"="tree"];
  way["leisure"="park"];

  // Points of interest
  node["amenity"];
  node["historic"];

  // Railways (trams - very Ostrava!)
  way["railway"="tram"];
);
out geom;
`.trim();
  }

  /**
   * Fetch all map data from Overpass API
   */
  public async fetchAll(): Promise<OSMResponse> {
    const query = this.buildQuery();

    console.log('[OverpassFetcher] Fetching OSM data for Ostrava...');
    console.log('[OverpassFetcher] Bbox:', this.config.bbox);

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as OSMResponse;

    console.log(`[OverpassFetcher] Received ${data.elements.length} elements`);
    this.logElementCounts(data);

    return data;
  }

  /**
   * Fetch only buildings (lighter query for testing)
   */
  public async fetchBuildings(): Promise<OSMResponse> {
    const [south, west, north, east] = this.config.bbox;
    const bboxStr = `${south},${west},${north},${east}`;

    const query = `
[out:json][bbox:${bboxStr}];
way["building"];
out geom;
`.trim();

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status}`);
    }

    return response.json() as Promise<OSMResponse>;
  }

  /**
   * Fetch only roads
   */
  public async fetchRoads(): Promise<OSMResponse> {
    const [south, west, north, east] = this.config.bbox;
    const bboxStr = `${south},${west},${north},${east}`;

    const query = `
[out:json][bbox:${bboxStr}];
way["highway"];
out geom;
`.trim();

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status}`);
    }

    return response.json() as Promise<OSMResponse>;
  }

  /**
   * Log counts of different element types for debugging
   */
  private logElementCounts(data: OSMResponse): void {
    interface ElementCounts {
      buildings: number;
      roads: number;
      trees: number;
      amenities: number;
      historic: number;
      trams: number;
      other: number;
    }

    const counts: ElementCounts = {
      buildings: 0,
      roads: 0,
      trees: 0,
      amenities: 0,
      historic: 0,
      trams: 0,
      other: 0,
    };

    for (const element of data.elements) {
      const tags = element.tags ?? {};

      if (tags['building']) {
        counts.buildings++;
      } else if (tags['highway']) {
        counts.roads++;
      } else if (tags['natural'] === 'tree') {
        counts.trees++;
      } else if (tags['amenity']) {
        counts.amenities++;
      } else if (tags['historic']) {
        counts.historic++;
      } else if (tags['railway'] === 'tram') {
        counts.trams++;
      } else {
        counts.other++;
      }
    }

    console.log('[OverpassFetcher] Element counts:', counts);
  }
}
