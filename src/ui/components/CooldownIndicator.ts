/**
 * CooldownIndicator Component
 * Horizontal bar cooldown indicator for weapon (net launcher)
 * Matches the SprintIndicator visual style
 */

import { type HUDStyleConfig, DEFAULT_HUD_STYLE } from '../HUDConfig';

export class CooldownIndicator {
  private readonly container: HTMLDivElement;
  private readonly barContainer: HTMLDivElement;
  private readonly barFill: HTMLDivElement;
  private readonly label: HTMLDivElement;
  private readonly style: HUDStyleConfig;

  private readonly barWidth = 120;
  private readonly barHeight = 6;

  private cooldownProgress = 1; // 0-1, 1 = ready

  constructor(style: Partial<HUDStyleConfig> = {}) {
    this.style = { ...DEFAULT_HUD_STYLE, ...style };

    // Create container - positioned below sprint indicator
    this.container = document.createElement('div');
    this.container.id = 'hud-cooldown';
    this.container.style.cssText = `
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      z-index: 100;
      pointer-events: none;
      user-select: none;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;

    // Create label
    this.label = document.createElement('div');
    this.label.style.cssText = `
      color: ${this.style.textColor};
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 4px;
      opacity: 0.8;
      text-shadow: 0 1px 2px rgba(0,0,0,0.5);
    `;
    this.label.textContent = 'NET';

    // Create bar container (background)
    this.barContainer = document.createElement('div');
    this.barContainer.style.cssText = `
      width: ${this.barWidth}px;
      height: ${this.barHeight}px;
      background: rgba(0, 0, 0, 0.5);
      border-radius: ${this.barHeight / 2}px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.2);
    `;

    // Create bar fill
    this.barFill = document.createElement('div');
    this.barFill.style.cssText = `
      width: 100%;
      height: 100%;
      background: ${this.style.primaryColor};
      border-radius: ${this.barHeight / 2}px;
      transition: width 0.1s ease, background 0.2s ease;
    `;

    this.barContainer.appendChild(this.barFill);
    this.container.appendChild(this.label);
    this.container.appendChild(this.barContainer);
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
   * Update cooldown progress
   * @param progress 0-1, where 1 means ready to fire
   */
  public update(progress: number): void {
    this.cooldownProgress = Math.max(0, Math.min(1, progress));

    if (this.cooldownProgress < 1) {
      // Show cooldown progress
      this.container.style.opacity = '1';
      this.barFill.style.width = `${this.cooldownProgress * 100}%`;
      this.barFill.style.background = this.getCooldownColor(this.cooldownProgress);
      this.label.textContent = 'RELOADING';
    } else {
      // Ready - hide indicator
      this.container.style.opacity = '0';
      this.barFill.style.width = '100%';
      this.barFill.style.background = this.style.primaryColor;
      this.label.textContent = 'NET';
    }
  }

  /**
   * Get color based on cooldown progress
   */
  private getCooldownColor(progress: number): string {
    if (progress > 0.7) {
      return this.style.accentColor; // Green - almost ready
    } else if (progress > 0.3) {
      return '#FFAA00'; // Orange
    } else {
      return '#FF4444'; // Red - just started
    }
  }

  /**
   * Flash effect when weapon becomes ready
   */
  public flashReady(): void {
    this.container.style.opacity = '1';
    this.barFill.style.background = this.style.accentColor;
    this.label.textContent = 'READY!';
    this.container.style.transform = 'translateX(-50%) scale(1.1)';

    setTimeout(() => {
      this.container.style.transform = 'translateX(-50%) scale(1)';
      this.container.style.opacity = '0';
    }, 400);
  }

  /**
   * Show/hide the component
   */
  public setVisible(visible: boolean): void {
    this.container.style.display = visible ? 'flex' : 'none';
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.unmount();
  }
}
