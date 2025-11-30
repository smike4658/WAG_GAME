/**
 * HUD Configuration and Types
 * Centralized configuration for all HUD elements
 */

import * as THREE from 'three';
// TimeOfDay type reserved for future day/night HUD features
import type { TimeOfDay as _TimeOfDay } from '../world/environment/DayNightCycle';

/**
 * Entity data for minimap display
 */
export interface MinimapEntity {
  id: string;
  position: THREE.Vector3;
  type: 'employee' | 'caught' | 'vehicle' | 'building';
  color?: number;
}

/**
 * Data passed to HUD each frame
 */
export interface HUDData {
  // Player state
  player: {
    position: THREE.Vector3;
    rotation: number; // Y-axis rotation in radians
  };

  // Game progress
  caughtCount: number;
  totalCount: number;

  // Weapon state
  weaponCooldown: number; // 0-1, 1 = ready

  // Sprint state
  sprint: {
    isSprinting: boolean;
    sprintProgress: number;    // 0-1, remaining sprint when active
    cooldownProgress: number;  // 0-1, 1 = ready to sprint
    canSprint: boolean;
  };

  // Entities for minimap
  entities: MinimapEntity[];
}

/**
 * Visual configuration for HUD elements
 */
export interface HUDStyleConfig {
  // Colors
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;

  // Minimap specific
  minimapSize: number;
  minimapRadius: number; // World units visible on minimap
  minimapPlayerColor: string;
  minimapEmployeeColor: string;
  minimapCaughtColor: string;

  // Progress counter
  progressFontSize: number;

  // Cooldown indicator
  cooldownSize: number;
}

/**
 * Default HUD style - can be overridden per level
 */
export const DEFAULT_HUD_STYLE: HUDStyleConfig = {
  // Colors - dark theme with gold accent
  primaryColor: '#FFD700',      // Gold
  secondaryColor: '#FFFFFF',
  accentColor: '#00FF88',       // Green for success
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  textColor: '#FFFFFF',

  // Minimap
  minimapSize: 180,             // Pixels
  minimapRadius: 50,            // 50 world units radius
  minimapPlayerColor: '#FFD700',
  minimapEmployeeColor: '#FF4444',
  minimapCaughtColor: '#44FF44',

  // Progress
  progressFontSize: 32,

  // Cooldown
  cooldownSize: 60,
};

/**
 * Position presets for HUD elements
 */
export const HUD_POSITIONS = {
  minimap: { bottom: 20, right: 20 },
  progress: { top: 20, left: 20 },
  cooldown: { bottom: 20, left: '50%', transform: 'translateX(-50%)' },
  controls: { bottom: 20, left: 20 },
} as const;
