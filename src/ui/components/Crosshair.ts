/**
 * Crosshair Component
 * Simple crosshair display for aiming
 */

import { type HUDStyleConfig, DEFAULT_HUD_STYLE } from '../HUDConfig';

export class Crosshair {
  private readonly container: HTMLDivElement;
  private readonly style: HUDStyleConfig;

  private hitAnimation = false;
  private hitTimeout: number | null = null;

  constructor(style: Partial<HUDStyleConfig> = {}) {
    this.style = { ...DEFAULT_HUD_STYLE, ...style };

    // Create container
    this.container = document.createElement('div');
    this.container.id = 'hud-crosshair';
    this.container.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 100;
      user-select: none;
    `;

    // Horizontal line
    const horizontal = document.createElement('div');
    horizontal.className = 'crosshair-h';
    horizontal.style.cssText = `
      width: 20px;
      height: 2px;
      background: rgba(255, 255, 255, 0.8);
      position: absolute;
      left: -10px;
      top: -1px;
      transition: all 0.1s ease;
    `;
    this.container.appendChild(horizontal);

    // Vertical line
    const vertical = document.createElement('div');
    vertical.className = 'crosshair-v';
    vertical.style.cssText = `
      width: 2px;
      height: 20px;
      background: rgba(255, 255, 255, 0.8);
      position: absolute;
      left: -1px;
      top: -10px;
      transition: all 0.1s ease;
    `;
    this.container.appendChild(vertical);

    // Center dot
    const dot = document.createElement('div');
    dot.className = 'crosshair-dot';
    dot.style.cssText = `
      width: 4px;
      height: 4px;
      background: rgba(255, 255, 255, 0.9);
      border-radius: 50%;
      position: absolute;
      left: -2px;
      top: -2px;
      transition: all 0.1s ease;
    `;
    this.container.appendChild(dot);
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
   * Show hit feedback (when catching employee)
   */
  public showHit(): void {
    if (this.hitTimeout) {
      clearTimeout(this.hitTimeout);
    }

    this.hitAnimation = true;

    // Expand and turn green
    const lines = this.container.querySelectorAll('.crosshair-h, .crosshair-v');
    lines.forEach((line) => {
      (line as HTMLElement).style.background = this.style.accentColor;
      (line as HTMLElement).style.transform = 'scale(1.5)';
    });

    const dot = this.container.querySelector('.crosshair-dot') as HTMLElement;
    if (dot) {
      dot.style.background = this.style.accentColor;
      dot.style.transform = 'scale(2)';
    }

    this.hitTimeout = window.setTimeout(() => {
      this.resetCrosshair();
    }, 200);
  }

  /**
   * Show fire feedback (when shooting)
   */
  public showFire(): void {
    // Quick spread animation
    const lines = this.container.querySelectorAll('.crosshair-h, .crosshair-v');
    lines.forEach((line) => {
      (line as HTMLElement).style.transform = 'scale(1.3)';
    });

    setTimeout(() => {
      if (!this.hitAnimation) {
        this.resetCrosshair();
      }
    }, 100);
  }

  /**
   * Reset crosshair to default state
   */
  private resetCrosshair(): void {
    this.hitAnimation = false;

    const lines = this.container.querySelectorAll('.crosshair-h, .crosshair-v');
    lines.forEach((line) => {
      (line as HTMLElement).style.background = 'rgba(255, 255, 255, 0.8)';
      (line as HTMLElement).style.transform = 'scale(1)';
    });

    const dot = this.container.querySelector('.crosshair-dot') as HTMLElement;
    if (dot) {
      dot.style.background = 'rgba(255, 255, 255, 0.9)';
      dot.style.transform = 'scale(1)';
    }
  }

  /**
   * Show/hide the component
   */
  public setVisible(visible: boolean): void {
    this.container.style.display = visible ? 'block' : 'none';
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
    if (this.hitTimeout) {
      clearTimeout(this.hitTimeout);
    }
    this.unmount();
  }
}
