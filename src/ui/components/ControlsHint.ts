/**
 * ControlsHint Component
 * Shows control hints at bottom of screen
 * Auto-hides after a delay
 */

import { type HUDStyleConfig, DEFAULT_HUD_STYLE, HUD_POSITIONS } from '../HUDConfig';

export class ControlsHint {
  private readonly container: HTMLDivElement;
  private readonly style: HUDStyleConfig;

  private hideTimeout: number | null = null;
  private readonly autoHideDelay = 10000; // 10 seconds

  constructor(style: Partial<HUDStyleConfig> = {}) {
    this.style = { ...DEFAULT_HUD_STYLE, ...style };

    // Create container
    this.container = document.createElement('div');
    this.container.id = 'hud-controls';
    this.container.style.cssText = `
      position: fixed;
      bottom: ${HUD_POSITIONS.controls.bottom}px;
      left: ${HUD_POSITIONS.controls.left}px;
      background: ${this.style.backgroundColor};
      color: ${this.style.textColor};
      padding: 10px 15px;
      border-radius: 5px;
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 12px;
      z-index: 100;
      pointer-events: none;
      user-select: none;
      opacity: 0.7;
      transition: opacity 0.5s ease;
      backdrop-filter: blur(4px);
    `;

    this.container.innerHTML = `
      <span style="margin-right: 15px;"><strong>WASD</strong> Move</span>
      <span style="margin-right: 15px;"><strong>Mouse</strong> Look</span>
      <span style="margin-right: 15px;"><strong>Space</strong> Jump</span>
      <span style="margin-right: 15px;"><strong>Shift</strong> Sprint</span>
      <span><strong>LMB</strong> Throw Net</span>
    `;
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
   * Show controls with optional auto-hide
   */
  public show(autoHide = true): void {
    this.container.style.opacity = '0.7';

    if (autoHide) {
      this.startAutoHide();
    }
  }

  /**
   * Hide controls
   */
  public hide(): void {
    this.container.style.opacity = '0';
    this.cancelAutoHide();
  }

  /**
   * Start auto-hide timer
   */
  private startAutoHide(): void {
    this.cancelAutoHide();

    this.hideTimeout = window.setTimeout(() => {
      this.fadeOut();
    }, this.autoHideDelay);
  }

  /**
   * Cancel auto-hide timer
   */
  private cancelAutoHide(): void {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }

  /**
   * Fade out animation
   */
  private fadeOut(): void {
    this.container.style.opacity = '0';
  }

  /**
   * Show/hide the component
   */
  public setVisible(visible: boolean): void {
    this.container.style.display = visible ? 'block' : 'none';
    if (visible) {
      this.show();
    }
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.cancelAutoHide();
    this.unmount();
  }
}
