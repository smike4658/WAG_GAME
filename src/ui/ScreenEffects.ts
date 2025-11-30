/**
 * ScreenEffects
 * Manages full-screen visual effects like blur, vignette, etc.
 * Uses CSS filters for performance (GPU accelerated)
 */

export class ScreenEffects {
  private readonly container: HTMLDivElement;
  private targetBlur = 0;

  constructor() {
    // Create overlay container
    this.container = document.createElement('div');
    this.container.id = 'screen-effects';
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 50;
      transition: backdrop-filter 0.3s ease;
    `;
  }

  /**
   * Mount to DOM
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
   * Set blur effect intensity (0-1)
   */
  public setBlur(intensity: number): void {
    this.targetBlur = Math.max(0, Math.min(1, intensity));
    this.updateEffects();
  }

  /**
   * Update visual effects
   */
  private updateEffects(): void {
    // Blur effect - max 6px blur for full screen effect
    const blurPx = this.targetBlur * 6;
    const style = this.container.style as CSSStyleDeclaration & { webkitBackdropFilter?: string; webkitMaskImage?: string };

    if (blurPx > 0) {
      // Apply blur to entire screen (no mask - full blur effect)
      style.backdropFilter = `blur(${blurPx}px)`;
      style.webkitBackdropFilter = `blur(${blurPx}px)`;
      // No mask - blur covers entire screen
      style.maskImage = 'none';
      style.webkitMaskImage = 'none';
    } else {
      style.backdropFilter = 'none';
      style.webkitBackdropFilter = 'none';
      style.maskImage = 'none';
      style.webkitMaskImage = 'none';
    }
  }

  /**
   * Clear all effects
   */
  public clear(): void {
    this.targetBlur = 0;
    const style = this.container.style as CSSStyleDeclaration & { webkitBackdropFilter?: string; webkitMaskImage?: string };
    style.backdropFilter = 'none';
    style.webkitBackdropFilter = 'none';
    style.maskImage = 'none';
    style.webkitMaskImage = 'none';
  }

  /**
   * Dispose
   */
  public dispose(): void {
    this.clear();
    this.unmount();
  }
}
