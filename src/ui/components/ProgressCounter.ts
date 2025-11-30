/**
 * ProgressCounter Component
 * Displays caught/total employees count with animated updates
 */

import { type HUDStyleConfig, DEFAULT_HUD_STYLE, HUD_POSITIONS } from '../HUDConfig';

export class ProgressCounter {
  private readonly container: HTMLDivElement;
  private readonly countDisplay: HTMLDivElement;
  private readonly labelDisplay: HTMLDivElement;
  private readonly style: HUDStyleConfig;

  private currentCount = 0;
  private totalCount = 0;
  private animationTimeout: number | null = null;

  constructor(style: Partial<HUDStyleConfig> = {}) {
    this.style = { ...DEFAULT_HUD_STYLE, ...style };

    // Create container
    this.container = document.createElement('div');
    this.container.id = 'hud-progress';
    this.container.style.cssText = `
      position: fixed;
      top: ${HUD_POSITIONS.progress.top}px;
      left: ${HUD_POSITIONS.progress.left}px;
      background: ${this.style.backgroundColor};
      padding: 15px 25px;
      border-radius: 10px;
      font-family: 'Segoe UI', Arial, sans-serif;
      z-index: 100;
      pointer-events: none;
      user-select: none;
      border: 2px solid rgba(255, 215, 0, 0.3);
      backdrop-filter: blur(4px);
    `;

    // Label
    this.labelDisplay = document.createElement('div');
    this.labelDisplay.style.cssText = `
      font-size: 14px;
      color: ${this.style.textColor};
      opacity: 0.7;
      margin-bottom: 5px;
      text-transform: uppercase;
      letter-spacing: 1px;
    `;
    this.labelDisplay.textContent = 'Employees Caught';
    this.container.appendChild(this.labelDisplay);

    // Count display
    this.countDisplay = document.createElement('div');
    this.countDisplay.style.cssText = `
      font-size: ${this.style.progressFontSize}px;
      font-weight: bold;
      color: ${this.style.primaryColor};
      transition: transform 0.2s ease, color 0.3s ease;
    `;
    this.countDisplay.textContent = '0/0';
    this.container.appendChild(this.countDisplay);
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
   * Update the counter display
   */
  public update(caught: number, total: number): void {
    // Only animate if count changed
    const countChanged = caught !== this.currentCount;

    this.currentCount = caught;
    this.totalCount = total;

    this.countDisplay.textContent = `${caught}/${total}`;

    // Animate on catch
    if (countChanged && caught > 0) {
      this.animateCatch();
    }

    // Update color based on progress
    this.updateProgressColor();
  }

  /**
   * Animate when catching an employee
   */
  private animateCatch(): void {
    // Clear previous animation
    if (this.animationTimeout) {
      clearTimeout(this.animationTimeout);
    }

    // Pop animation
    this.countDisplay.style.transform = 'scale(1.3)';
    this.countDisplay.style.color = this.style.accentColor;

    this.animationTimeout = window.setTimeout(() => {
      this.countDisplay.style.transform = 'scale(1)';
      this.updateProgressColor();
    }, 200);
  }

  /**
   * Update color based on progress percentage
   */
  private updateProgressColor(): void {
    if (this.totalCount === 0) return;

    const progress = this.currentCount / this.totalCount;

    if (progress >= 1) {
      // Victory - bright green
      this.countDisplay.style.color = '#00FF00';
      this.container.style.borderColor = 'rgba(0, 255, 0, 0.5)';
    } else if (progress >= 0.75) {
      // Almost there - light gold
      this.countDisplay.style.color = '#FFFF00';
    } else if (progress >= 0.5) {
      // Halfway - gold
      this.countDisplay.style.color = this.style.primaryColor;
    } else {
      // Starting - gold
      this.countDisplay.style.color = this.style.primaryColor;
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
    if (this.animationTimeout) {
      clearTimeout(this.animationTimeout);
    }
    this.unmount();
  }
}
