/**
 * Types for Ostrava map data and OSM conversion
 */

/** Raw coordinate pair [longitude, latitude] from OSM */
export type OSMCoordinate = [number, number];

/** Local coordinate in meters from reference point */
export interface LocalCoordinate {
  x: number;
  z: number;
}

/** Building data parsed from OSM */
export interface BuildingData {
  id: string;
  type: string;
  footprint: LocalCoordinate[];
  height: number;
  color: number;
  isLandmark: boolean;
  name?: string;
}

/** Road segment data parsed from OSM */
export interface RoadData {
  id: string;
  type: string;
  path: LocalCoordinate[];
  width: number;
  color: number;
}

/** Tree position data */
export interface TreeData {
  position: LocalCoordinate;
}

/** Point of interest for minimap */
export interface POIData {
  name: string;
  position: LocalCoordinate;
  type: 'landmark' | 'spawn' | 'zone';
}

/** Complete map data structure */
export interface OstravaMapData {
  buildings: BuildingData[];
  roads: RoadData[];
  trees: TreeData[];
  landmarks: {
    playerSpawn: LocalCoordinate;
    pois: POIData[];
  };
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
}

/** OSM Overpass API response element */
export interface OSMElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  tags?: Record<string, string>;
  lat?: number;
  lon?: number;
  geometry?: Array<{ lat: number; lon: number }>;
  bounds?: {
    minlat: number;
    minlon: number;
    maxlat: number;
    maxlon: number;
  };
  members?: Array<{
    type: string;
    ref: number;
    role: string;
    geometry?: Array<{ lat: number; lon: number }>;
  }>;
}

/** OSM Overpass API response */
export interface OSMResponse {
  version: number;
  generator: string;
  elements: OSMElement[];
}

/** Map configuration */
export interface MapConfig {
  /** Reference latitude for coordinate conversion */
  refLat: number;
  /** Reference longitude for coordinate conversion */
  refLon: number;
  /** Bounding box [south, west, north, east] */
  bbox: [number, number, number, number];
}

/** Ostrava Masarykovo namesti configuration */
export const OSTRAVA_CONFIG: MapConfig = {
  refLat: 49.8357,
  refLon: 18.2927,
  bbox: [49.832, 18.287, 49.839, 18.298],
};
