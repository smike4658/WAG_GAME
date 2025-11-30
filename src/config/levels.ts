import * as THREE from 'three';

/**
 * Level configuration type
 */
export interface LevelConfig {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  type: 'simple' | 'static';

  // For SimpleCity
  simpleConfig?: {
    size: THREE.Vector2;
    roadWidth: number;
    carCount: number;
    debugRoads: boolean;
  };

  // For StaticCity (GLB models)
  staticConfig?: {
    modelPath: string;
    scale: number;
    groundSize: number;
    /** Rotation correction in radians [x, y, z] - for Blender exports use [-Math.PI/2, 0, 0] */
    rotationCorrection?: [number, number, number];
    /** Position correction [x, y, z] to fine-tune placement */
    positionCorrection?: [number, number, number];
    /** Offset for generated waypoints (useful if road mesh includes curbs) */
    roadWaypointOffset?: number;
  };
}

/**
 * Available game levels
 */
export const LEVELS: LevelConfig[] = [
  {
    id: 'test-city',
    name: 'Training Ground',
    description: 'A controlled environment to practice your net-throwing skills.',
    thumbnail: '/thumbnails/test-city.png',
    type: 'simple',
    simpleConfig: {
      size: new THREE.Vector2(200, 200),
      roadWidth: 10,
      carCount: 15,
      debugRoads: true,
    },
  },
  {
    id: 'cartoon-city',
    name: 'Cartoon District',
    description: 'A vibrant, colorful district teeming with potential recruits.',
    thumbnail: '/thumbnails/cartoon-city.png',
    type: 'static',
    staticConfig: {
      modelPath: '/models/cartoon-city/uploads_files_6376639_Cartoon_City_Free (1).glb',
      scale: 1.0,
      groundSize: 500,
      // Position correction to align roads with ground level
      positionCorrection: [0, -0.35, 0],
      // Lower waypoints slightly to account for curb height in this model
      roadWaypointOffset: -0.15,
    },
  },
  {
    id: 'low-poly-city',
    name: 'Downtown Ostrava',
    description: 'The bustling heart of the city. High traffic, high rewards.',
    thumbnail: '/thumbnails/low-poly-city.png',
    type: 'static',
    staticConfig: {
      modelPath: '/low-poly-city/Low Poly City.glb',
      scale: 1.0,
      groundSize: 600,
      // Flip upside down (180° Z) to put buildings up
      rotationCorrection: [0, 0, 0],
      // Lower city so player stands on street (not floating)
      positionCorrection: [0, -3.2, 0],
    },
  },
];

/**
 * Get level by ID
 */
export function getLevelById(id: string): LevelConfig | undefined {
  return LEVELS.find(level => level.id === id);
}

/**
 * Get default level
 */
export function getDefaultLevel(): LevelConfig {
  const defaultLevel = LEVELS[0];
  if (!defaultLevel) {
    throw new Error('No levels configured');
  }
  return defaultLevel;
}
