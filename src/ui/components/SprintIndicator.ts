/**
 * SprintIndicator Component
 * Shows sprint availability and cooldown status
 * Appears as a horizontal bar below the crosshair
 */

import { type HUDStyleConfig, DEFAULT_HUD_STYLE } from '../HUDConfig';

/**
 * Sprint state for the indicator
 */
export interface SprintState {
  isSprinting: boolean;
  sprintProgress: number;      // 0-1, remaining sprint time when active
  cooldownProgress: number;    // 0-1, 1 = ready to sprint
  canSprint: boolean;
}

export class SprintIndicator {
  private readonly container: HTMLDivElement;
  private readonly barContainer: HTMLDivElement;
  private readonly barFill: HTMLDivElement;
  private readonly label: HTMLDivElement;
  private readonly style: HUDStyleConfig;

  private readonly barWidth = 120;
  private readonly barHeight = 6;

  constructor(style: Partial<HUDStyleConfig> = {}) {
    this.style = { ...DEFAULT_HUD_STYLE, ...style };

    // Create container
    this.container = document.createElement('div');
    this.container.id = 'hud-sprint';
    this.container.style.cssText = `
      position: fixed;
      bottom: 140px;
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
    this.label.textContent = 'SPRINT';

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
   * Update sprint indicator
   */
  public update(state: SprintState): void {
    // Determine what to show
    if (state.isSprinting) {
      // Show remaining sprint time
      this.container.style.opacity = '1';
      this.barFill.style.width = `${state.sprintProgress * 100}%`;
      this.barFill.style.background = this.getSprintColor(state.sprintProgress);
      this.label.textContent = 'SPRINTING';
    } else if (!state.canSprint) {
      // Show cooldown progress
      this.container.style.opacity = '0.7';
      this.barFill.style.width = `${state.cooldownProgress * 100}%`;
      this.barFill.style.background = '#888888';
      this.label.textContent = 'COOLDOWN';
    } else {
      // Ready to sprint - hide indicator
      this.container.style.opacity = '0';
      this.barFill.style.width = '100%';
      this.barFill.style.background = this.style.primaryColor;
      this.label.textContent = 'SPRINT';
    }
  }

  /**
   * Get color based on sprint progress
   */
  private getSprintColor(progress: number): string {
    if (progress > 0.5) {
      return this.style.accentColor; // Green
    } else if (progress > 0.2) {
      return '#FFAA00'; // Orange
    } else {
      return '#FF4444'; // Red - almost exhausted
    }
  }

  /**
   * Flash when sprint becomes available
   */
  public flashReady(): void {
    this.container.style.opacity = '1';
    this.barFill.style.background = this.style.accentColor;
    this.label.textContent = 'READY!';

    setTimeout(() => {
      this.container.style.opacity = '0';
    }, 500);
  }

  /**
   * Show exhaustion effect
   */
  public showExhausted(): void {
    this.container.style.opacity = '1';
    this.barFill.style.width = '0%';
    this.barFill.style.background = '#FF4444';
    this.label.textContent = 'EXHAUSTED';
    this.container.style.transform = 'translateX(-50%) scale(1.1)';

    setTimeout(() => {
      this.container.style.transform = 'translateX(-50%) scale(1)';
    }, 150);
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
