/**
 * HUD Manager
 * Central manager for all HUD components
 * Handles mounting, updating, and visibility of UI elements
 */

import * as THREE from 'three';
import {
  type HUDData,
  type HUDStyleConfig,
  type MinimapEntity,
  DEFAULT_HUD_STYLE,
} from './HUDConfig';
import {
  ProgressCounter,
  Minimap,
  CooldownIndicator,
  Crosshair,
  ControlsHint,
  SprintIndicator,
  TimeIndicator,
  GameTimer,
  PowerupIndicator,
} from './components';
import type { TimeOfDay } from '../world/environment/DayNightCycle';
import type { ActivePowerup } from '../powerups/PowerupManager';

/**
 * HUD visibility state
 */
interface HUDVisibility {
  minimap: boolean;
  progress: boolean;
  cooldown: boolean;
  crosshair: boolean;
  controls: boolean;
  sprint: boolean;
  time: boolean;
  gameTimer: boolean;
  powerup: boolean;
}

/**
 * Main HUD class - manages all UI components
 */
export class HUD {
  // Components
  private readonly progressCounter: ProgressCounter;
  private readonly minimap: Minimap;
  private readonly cooldownIndicator: CooldownIndicator;
  private readonly crosshair: Crosshair;
  private readonly controlsHint: ControlsHint;
  private readonly sprintIndicator: SprintIndicator;
  private readonly timeIndicator: TimeIndicator;
  private readonly gameTimer: GameTimer;
  private readonly powerupIndicator: PowerupIndicator;

  // State
  private readonly style: HUDStyleConfig;
  private visibility: HUDVisibility = {
    minimap: true,
    progress: true,
    cooldown: true,
    crosshair: true,
    controls: true,
    sprint: true,
    time: true,
    gameTimer: true,
    powerup: true,
  };

  private mounted = false;
  private active = false;

  // Track previous cooldown to detect when weapon becomes ready
  private previousCooldown = 1;
  // Track previous sprint cooldown to detect when sprint becomes ready
  private previousSprintCooldown = 1;

  constructor(style: Partial<HUDStyleConfig> = {}) {
    this.style = { ...DEFAULT_HUD_STYLE, ...style };

    // Create all components
    this.progressCounter = new ProgressCounter(this.style);
    this.minimap = new Minimap(this.style);
    this.cooldownIndicator = new CooldownIndicator(this.style);
    this.crosshair = new Crosshair(this.style);
    this.controlsHint = new ControlsHint(this.style);
    this.sprintIndicator = new SprintIndicator(this.style);
    this.timeIndicator = new TimeIndicator(this.style);
    this.gameTimer = new GameTimer(this.style);
    this.powerupIndicator = new PowerupIndicator(this.style);
  }

  /**
   * Mount HUD to DOM
   */
  public mount(parent: HTMLElement = document.body): void {
    if (this.mounted) return;

    this.progressCounter.mount(parent);
    this.minimap.mount(parent);
    this.cooldownIndicator.mount(parent);
    this.crosshair.mount(parent);
    this.controlsHint.mount(parent);
    this.sprintIndicator.mount(parent);
    this.timeIndicator.mount(parent);
    this.gameTimer.mount(parent);
    this.powerupIndicator.mount(parent);

    this.mounted = true;

    // Initially hidden
    this.setActive(false);

    console.log('[HUD] Mounted all components');
  }

  /**
   * Unmount HUD from DOM
   */
  public unmount(): void {
    if (!this.mounted) return;

    this.progressCounter.unmount();
    this.minimap.unmount();
    this.cooldownIndicator.unmount();
    this.crosshair.unmount();
    this.controlsHint.unmount();
    this.sprintIndicator.unmount();
    this.timeIndicator.unmount();
    this.gameTimer.unmount();
    this.powerupIndicator.unmount();

    this.mounted = false;
  }

  /**
   * Set HUD active state (shown during gameplay)
   */
  public setActive(active: boolean): void {
    this.active = active;
    this.updateVisibility();

    if (active) {
      this.controlsHint.show(true); // Auto-hide after delay
    }
  }

  /**
   * Check if HUD is active
   */
  public isActive(): boolean {
    return this.active;
  }

  /**
   * Update HUD with game data
   */
  public update(data: HUDData, deltaTime: number): void {
    if (!this.active || !this.mounted) return;

    // Update progress counter
    this.progressCounter.update(data.caughtCount, data.totalCount);

    // Update minimap
    this.minimap.update(
      data.player.position,
      data.player.rotation,
      data.entities,
      deltaTime
    );

    // Update cooldown indicator
    this.cooldownIndicator.update(data.weaponCooldown);

    // Flash when weapon becomes ready
    if (this.previousCooldown < 1 && data.weaponCooldown >= 1) {
      this.cooldownIndicator.flashReady();
    }
    this.previousCooldown = data.weaponCooldown;

    // Update sprint indicator
    this.sprintIndicator.update(data.sprint);

    // Flash when sprint becomes ready
    if (this.previousSprintCooldown < 1 && data.sprint.cooldownProgress >= 1) {
      this.sprintIndicator.flashReady();
    }
    this.previousSprintCooldown = data.sprint.cooldownProgress;

    // Update game timer
    this.gameTimer.update();
  }

  /**
   * Notify HUD that player fired weapon
   */
  public onFire(): void {
    this.crosshair.showFire();
  }

  /**
   * Notify HUD that player caught an employee
   */
  public onCatch(): void {
    this.crosshair.showHit();
  }

  /**
   * Notify HUD that sprint was exhausted
   */
  public onSprintExhausted(): void {
    this.sprintIndicator.showExhausted();
  }

  /**
   * Toggle specific HUD element visibility
   */
  public setElementVisibility(element: keyof HUDVisibility, visible: boolean): void {
    this.visibility[element] = visible;
    this.updateVisibility();
  }

  /**
   * Get visibility of specific element
   */
  public getElementVisibility(element: keyof HUDVisibility): boolean {
    return this.visibility[element];
  }

  /**
   * Update component visibility based on state
   */
  private updateVisibility(): void {
    this.progressCounter.setVisible(this.active && this.visibility.progress);
    this.minimap.setVisible(this.active && this.visibility.minimap);
    this.cooldownIndicator.setVisible(this.active && this.visibility.cooldown);
    this.crosshair.setVisible(this.active && this.visibility.crosshair);
    this.controlsHint.setVisible(this.active && this.visibility.controls);
    this.sprintIndicator.setVisible(this.active && this.visibility.sprint);
    this.timeIndicator.setVisible(this.active && this.visibility.time);
    this.gameTimer.setVisible(this.active && this.visibility.gameTimer);
    this.powerupIndicator.setVisible(this.active && this.visibility.powerup);
  }

  /**
   * Set minimap zoom level (radius in world units)
   */
  public setMinimapZoom(radius: number): void {
    this.minimap.setRadius(radius);
  }

  /**
   * Get minimap zoom level
   */
  public getMinimapZoom(): number {
    return this.minimap.getRadius();
  }

  /**
   * Update the time indicator
   */
  public updateTime(timeString: string, phase: TimeOfDay): void {
    this.timeIndicator.update(timeString, phase);
  }

  /**
   * Show night message pulse effect
   */
  public showNightMessage(): void {
    this.timeIndicator.showNightMessage();
  }

  // ===== Powerup Methods =====

  /**
   * Update powerup indicator
   */
  public updatePowerup(powerup: ActivePowerup | null): void {
    this.powerupIndicator.update(powerup);
  }

  // ===== Game Timer Methods =====

  /**
   * Reset game timer to zero
   */
  public resetGameTimer(): void {
    this.gameTimer.reset();
  }

  /**
   * Start the game timer
   */
  public startGameTimer(): void {
    this.gameTimer.start();
  }

  /**
   * Pause the game timer
   */
  public pauseGameTimer(): void {
    this.gameTimer.pause();
  }

  /**
   * Stop the game timer (final)
   */
  public stopGameTimer(): void {
    this.gameTimer.stop();
    this.gameTimer.flashVictory();
  }

  /**
   * Get elapsed time in milliseconds
   */
  public getGameTimerElapsedMs(): number {
    return this.gameTimer.getElapsedMs();
  }

  /**
   * Clean up all resources
   */
  public dispose(): void {
    this.progressCounter.dispose();
    this.minimap.dispose();
    this.cooldownIndicator.dispose();
    this.crosshair.dispose();
    this.controlsHint.dispose();
    this.sprintIndicator.dispose();
    this.timeIndicator.dispose();
    this.gameTimer.dispose();
    this.powerupIndicator.dispose();

    this.mounted = false;
  }
}

/**
 * Sprint state for HUD data
 */
interface SprintDataInput {
  isSprinting: boolean;
  sprintProgress: number;
  cooldownProgress: number;
  canSprint: boolean;
}

/**
 * Helper function to create HUD data from game state
 */
export function createHUDData(
  playerPosition: THREE.Vector3,
  playerRotation: number,
  caughtCount: number,
  totalCount: number,
  weaponCooldown: number,
  sprintData: SprintDataInput,
  employeePositions: Map<string, THREE.Vector3>,
  caughtEmployeeIds: Set<string> = new Set()
): HUDData {
  const entities: MinimapEntity[] = [];

  for (const [id, position] of employeePositions) {
    entities.push({
      id,
      position,
      type: caughtEmployeeIds.has(id) ? 'caught' : 'employee',
    });
  }

  return {
    player: {
      position: playerPosition,
      rotation: playerRotation,
    },
    caughtCount,
    totalCount,
    weaponCooldown,
    sprint: sprintData,
    entities,
  };
}
