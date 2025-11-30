/**
 * PowerupIndicator Component
 * Displays active powerup effect with countdown and pixel art coffee icon
 */

import { type HUDStyleConfig, DEFAULT_HUD_STYLE } from '../HUDConfig';
import type { ActivePowerup, PowerupType } from '../../powerups/PowerupManager';

/**
 * Powerup display info
 */
interface PowerupInfo {
  name: string;
  color: string;
}

/**
 * Mapping of powerup types to display info (without emoji - using pixel art instead)
 */
const POWERUP_DISPLAY: Record<PowerupType, PowerupInfo> = {
  speed_boost: { name: 'Turbo káva', color: '#00ffff' },
  size_up: { name: 'Grande káva', color: '#00ff00' },
  super_net: { name: 'Espresso focus', color: '#ff00ff' },
  xray_vision: { name: 'Rentgen', color: '#ffff00' },
  size_down: { name: 'Decaf', color: '#ff8800' },
  drunk: { name: 'Opilost', color: '#8800ff' },
  blur: { name: 'Rozmazání', color: '#888888' },
};

/**
 * Create pixel art coffee cup using CSS box-shadow
 * Each pixel is 3x3px, scaled to create a 24x24 icon
 */
function createPixelArtCoffee(color: string): string {
  const px = 3; // pixel size
  // Coffee cup pixel art (8x8 grid)
  // . = transparent, # = cup color, @ = steam, * = coffee
  const art = `
    ..@@....
    .@..@...
    ..@@....
    .####.
    .#**#.
    .#**#.
    .####.
    ..##..
  `.trim().split('\n').map(row => row.trim());

  const shadows: string[] = [];
  const steamColor = 'rgba(255,255,255,0.6)';
  const coffeeColor = '#3d2314';

  art.forEach((row, y) => {
    [...row].forEach((char, x) => {
      let pixelColor = '';
      if (char === '#') pixelColor = color;
      else if (char === '@') pixelColor = steamColor;
      else if (char === '*') pixelColor = coffeeColor;

      if (pixelColor) {
        shadows.push(`${x * px}px ${y * px}px 0 ${pixelColor}`);
      }
    });
  });

  return shadows.join(',');
}

export class PowerupIndicator {
  private readonly container: HTMLDivElement;
  private readonly iconDisplay: HTMLDivElement;
  private readonly nameDisplay: HTMLDivElement;
  private readonly progressBar: HTMLDivElement;
  private readonly progressFill: HTMLDivElement;
  private readonly style: HUDStyleConfig;

  private currentPowerup: ActivePowerup | null = null;
  private fadeTimeout: number | null = null;

  constructor(style: Partial<HUDStyleConfig> = {}) {
    this.style = { ...DEFAULT_HUD_STYLE, ...style };

    // Create container - positioned top center
    this.container = document.createElement('div');
    this.container.id = 'hud-powerup';
    this.container.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%) scale(0);
      background: ${this.style.backgroundColor};
      padding: 12px 24px;
      border-radius: 50px;
      font-family: 'Segoe UI', Arial, sans-serif;
      z-index: 100;
      pointer-events: none;
      user-select: none;
      border: 3px solid rgba(255, 215, 0, 0.5);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      gap: 12px;
      opacity: 0;
      transition: transform 0.3s ease, opacity 0.3s ease;
    `;

    // Icon container (pixel art coffee cup)
    this.iconDisplay = document.createElement('div');
    this.iconDisplay.style.cssText = `
      width: 3px;
      height: 3px;
      margin-right: 20px;
      margin-left: 4px;
      image-rendering: pixelated;
    `;
    this.container.appendChild(this.iconDisplay);

    // Info container (name + progress)
    const infoContainer = document.createElement('div');
    infoContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 4px;
    `;
    this.container.appendChild(infoContainer);

    // Name display
    this.nameDisplay = document.createElement('div');
    this.nameDisplay.style.cssText = `
      font-size: 16px;
      font-weight: bold;
      color: ${this.style.primaryColor};
      text-transform: uppercase;
      letter-spacing: 1px;
    `;
    infoContainer.appendChild(this.nameDisplay);

    // Progress bar container
    this.progressBar = document.createElement('div');
    this.progressBar.style.cssText = `
      width: 120px;
      height: 6px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 3px;
      overflow: hidden;
    `;
    infoContainer.appendChild(this.progressBar);

    // Progress bar fill
    this.progressFill = document.createElement('div');
    this.progressFill.style.cssText = `
      width: 100%;
      height: 100%;
      background: ${this.style.primaryColor};
      transition: width 0.1s linear;
      border-radius: 3px;
    `;
    this.progressBar.appendChild(this.progressFill);
  }

  /**
   * Mount the component to DOM
   */
  public mount(parent: HTMLElement = document.body): void {
    parent.appendChild(this.container);
  }

  /**
   * Unmount from DOM
   */
  public unmount(): void {
    if (this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
  }

  /**
   * Show powerup indicator with animation
   */
  public show(powerup: ActivePowerup): void {
    this.currentPowerup = powerup;

    const displayInfo = POWERUP_DISPLAY[powerup.type];
    if (!displayInfo) return;

    // Clear any pending fade
    if (this.fadeTimeout) {
      clearTimeout(this.fadeTimeout);
      this.fadeTimeout = null;
    }

    // Update display with pixel art coffee icon
    this.iconDisplay.style.boxShadow = createPixelArtCoffee(displayInfo.color);
    this.nameDisplay.textContent = displayInfo.name;
    this.nameDisplay.style.color = displayInfo.color;
    this.progressFill.style.background = displayInfo.color;

    // Set border color based on advantage/disadvantage
    const borderColor = powerup.definition.isAdvantage
      ? 'rgba(0, 255, 0, 0.6)'
      : 'rgba(255, 0, 0, 0.6)';
    this.container.style.borderColor = borderColor;

    // Animate in
    this.container.style.opacity = '1';
    this.container.style.transform = 'translateX(-50%) scale(1)';
  }

  /**
   * Hide powerup indicator with animation
   */
  public hide(): void {
    // Animate out
    this.container.style.opacity = '0';
    this.container.style.transform = 'translateX(-50%) scale(0.8)';

    this.fadeTimeout = window.setTimeout(() => {
      this.container.style.transform = 'translateX(-50%) scale(0)';
      this.currentPowerup = null;
    }, 300);
  }

  /**
   * Update progress bar
   */
  public update(powerup: ActivePowerup | null): void {
    if (!powerup) {
      if (this.currentPowerup) {
        this.hide();
      }
      return;
    }

    // Show if new powerup or different type
    if (!this.currentPowerup || this.currentPowerup.type !== powerup.type) {
      this.show(powerup);
    }

    // Update progress bar
    const progress = powerup.remainingTime / powerup.totalTime;
    this.progressFill.style.width = `${progress * 100}%`;

    // Flash when about to expire
    if (progress < 0.2) {
      const pulse = Math.sin(performance.now() * 0.02) > 0;
      this.container.style.opacity = pulse ? '1' : '0.6';
    } else {
      this.container.style.opacity = '1';
    }

    this.currentPowerup = powerup;
  }

  /**
   * Show/hide the component
   */
  public setVisible(visible: boolean): void {
    this.container.style.display = visible ? 'flex' : 'none';
  }

  /**
   * Check if visible
   */
  public isVisible(): boolean {
    return this.container.style.display !== 'none';
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    if (this.fadeTimeout) {
      clearTimeout(this.fadeTimeout);
    }
    this.unmount();
  }
}
