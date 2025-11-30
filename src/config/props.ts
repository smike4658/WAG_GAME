/**
 * Static prop configurations for WAG GAME
 *
 * Props are non-animated 3D objects used for:
 * - Powerups (coffee, energy drinks)
 * - Environment decoration (benches, signs, bins)
 * - Interactive objects
 */

interface PropConfig {
  id: string;
  displayName: string;
  displayNameCz: string;
  path: string;
  type: 'powerup' | 'decoration' | 'interactive';
  scale?: number; // Optional scale override
  description?: string;
}

export const PROPS: PropConfig[] = [
  {
    id: 'coffee-powerup',
    displayName: 'Coffee Powerup',
    displayNameCz: 'Káva (powerup)',
    path: 'assets/models/props/coffee_powerup.glb',
    type: 'powerup',
    description: 'Low-poly stylized coffee cup. Restores energy or provides speed boost.',
  },
];

/**
 * Get prop configuration by ID
 */
export function getPropConfig(id: string): PropConfig | undefined {
  return PROPS.find((prop) => prop.id === id);
}

/**
 * Get all props of a specific type
 */
export function getPropsByType(type: PropConfig['type']): PropConfig[] {
  return PROPS.filter((prop) => prop.type === type);
}
