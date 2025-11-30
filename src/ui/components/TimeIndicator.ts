/**
 * TimeIndicator Component
 * Shows current time of day with sun/moon icon
 */

import { type HUDStyleConfig, DEFAULT_HUD_STYLE } from '../HUDConfig';
import type { TimeOfDay } from '../../world/environment/DayNightCycle';

export class TimeIndicator {
  private readonly container: HTMLDivElement;
  private readonly iconContainer: HTMLDivElement;
  private readonly timeDisplay: HTMLDivElement;
  private readonly phaseDisplay: HTMLDivElement;
  private readonly style: HUDStyleConfig;

  private currentPhase: TimeOfDay = 'day';

  constructor(style: Partial<HUDStyleConfig> = {}) {
    this.style = { ...DEFAULT_HUD_STYLE, ...style };

    // Create container - top right corner
    this.container = document.createElement('div');
    this.container.id = 'hud-time';
    this.container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${this.style.backgroundColor};
      padding: 10px 15px;
      border-radius: 10px;
      font-family: 'Segoe UI', Arial, sans-serif;
      z-index: 100;
      pointer-events: none;
      user-select: none;
      display: flex;
      align-items: center;
      gap: 10px;
      border: 2px solid rgba(255, 215, 0, 0.3);
      backdrop-filter: blur(4px);
      transition: background 0.5s ease, border-color 0.5s ease;
    `;

    // Icon container (sun/moon)
    this.iconContainer = document.createElement('div');
    this.iconContainer.style.cssText = `
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      transition: transform 0.3s ease;
    `;
    this.iconContainer.textContent = '☀️';

    // Time display
    const textContainer = document.createElement('div');
    textContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: flex-start;
    `;

    this.timeDisplay = document.createElement('div');
    this.timeDisplay.style.cssText = `
      font-size: 18px;
      font-weight: bold;
      color: ${this.style.primaryColor};
      font-family: 'Courier New', monospace;
    `;
    this.timeDisplay.textContent = '12:00';

    this.phaseDisplay = document.createElement('div');
    this.phaseDisplay.style.cssText = `
      font-size: 11px;
      color: ${this.style.textColor};
      opacity: 0.7;
      text-transform: uppercase;
      letter-spacing: 1px;
    `;
    this.phaseDisplay.textContent = 'DAY';

    textContainer.appendChild(this.timeDisplay);
    textContainer.appendChild(this.phaseDisplay);

    this.container.appendChild(this.iconContainer);
    this.container.appendChild(textContainer);
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
   * Update the time display
   */
  public update(timeString: string, phase: TimeOfDay): void {
    this.timeDisplay.textContent = timeString;

    // Update phase if changed
    if (phase !== this.currentPhase) {
      this.currentPhase = phase;
      this.updatePhaseVisuals();
    }
  }

  /**
   * Update visuals based on current phase
   */
  private updatePhaseVisuals(): void {
    // Update icon
    switch (this.currentPhase) {
      case 'dawn':
        this.iconContainer.textContent = '🌅';
        this.phaseDisplay.textContent = 'DAWN';
        this.container.style.borderColor = 'rgba(255, 150, 50, 0.4)';
        this.timeDisplay.style.color = '#FFB347';
        break;
      case 'day':
        this.iconContainer.textContent = '☀️';
        this.phaseDisplay.textContent = 'DAY';
        this.container.style.borderColor = 'rgba(255, 215, 0, 0.4)';
        this.timeDisplay.style.color = this.style.primaryColor;
        break;
      case 'dusk':
        this.iconContainer.textContent = '🌇';
        this.phaseDisplay.textContent = 'DUSK';
        this.container.style.borderColor = 'rgba(255, 100, 100, 0.4)';
        this.timeDisplay.style.color = '#FF6B6B';
        break;
      case 'night':
        this.iconContainer.textContent = '🌙';
        this.phaseDisplay.textContent = 'NIGHT';
        this.container.style.borderColor = 'rgba(100, 100, 200, 0.4)';
        this.container.style.background = 'rgba(10, 10, 30, 0.8)';
        this.timeDisplay.style.color = '#AAAAFF';
        break;
    }

    // Animate icon
    this.iconContainer.style.transform = 'scale(1.3)';
    setTimeout(() => {
      this.iconContainer.style.transform = 'scale(1)';
    }, 200);

    // Reset background for non-night phases
    if (this.currentPhase !== 'night') {
      this.container.style.background = this.style.backgroundColor;
    }
  }

  /**
   * Show night work restriction message
   */
  public showNightMessage(): void {
    // Pulse effect
    this.container.style.transform = 'scale(1.1)';
    this.container.style.boxShadow = '0 0 20px rgba(100, 100, 255, 0.5)';

    setTimeout(() => {
      this.container.style.transform = 'scale(1)';
      this.container.style.boxShadow = 'none';
    }, 500);
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
    this.unmount();
  }
}
