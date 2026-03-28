/**
 * GameTimer Component
 * Displays elapsed game time as a stopwatch
 * Starts when game begins, stops on victory
 */

import { type HUDStyleConfig, DEFAULT_HUD_STYLE } from '../HUDConfig';

export type GameTimerState = 'stopped' | 'running' | 'paused';

export class GameTimer {
  private readonly container: HTMLDivElement;
  private readonly timeDisplay: HTMLDivElement;
  private readonly labelDisplay: HTMLDivElement;
  private readonly style: HUDStyleConfig;

  private state: GameTimerState = 'stopped';
  private startTime = 0;
  private pausedTime = 0;
  private elapsedAtPause = 0;

  // Countdown mode
  private countdownMs = 180_000; // 3 minutes default
  private bonusTimeMs = 0;
  private isUrgent = false;
  private onTimeUp: (() => void) | null = null;

  // Large countdown overlay for last 10 seconds
  private largeTimerOverlay: HTMLDivElement | null = null;

  constructor(style: Partial<HUDStyleConfig> = {}) {
    this.style = { ...DEFAULT_HUD_STYLE, ...style };

    // Create container - top right corner, below TimeIndicator
    this.container = document.createElement('div');
    this.container.id = 'hud-game-timer';
    this.container.style.cssText = `
      position: fixed;
      top: 85px;
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
      transition: border-color 0.3s ease, box-shadow 0.3s ease;
    `;

    // Stopwatch icon
    const iconContainer = document.createElement('div');
    iconContainer.style.cssText = `
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
    `;
    iconContainer.textContent = '⏱️';

    // Text container
    const textContainer = document.createElement('div');
    textContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: flex-start;
    `;

    // Time display
    this.timeDisplay = document.createElement('div');
    this.timeDisplay.style.cssText = `
      font-size: 20px;
      font-weight: bold;
      color: ${this.style.primaryColor};
      font-family: 'Courier New', monospace;
      letter-spacing: 1px;
    `;
    this.timeDisplay.textContent = '00:00.00';

    // Label
    this.labelDisplay = document.createElement('div');
    this.labelDisplay.style.cssText = `
      font-size: 10px;
      color: ${this.style.textColor};
      opacity: 0.6;
      text-transform: uppercase;
      letter-spacing: 1px;
    `;
    this.labelDisplay.textContent = 'TIME';

    textContainer.appendChild(this.timeDisplay);
    textContainer.appendChild(this.labelDisplay);

    this.container.appendChild(iconContainer);
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
   * Reset timer to zero
   */
  public reset(): void {
    this.state = 'stopped';
    this.startTime = 0;
    this.pausedTime = 0;
    this.elapsedAtPause = 0;
    this.bonusTimeMs = 0;
    this.isUrgent = false;
    this.hideLargeTimer();
    this.updateDisplay(this.countdownMs);
    this.container.style.borderColor = 'rgba(255, 215, 0, 0.3)';
    this.container.style.transform = 'scale(1)';
    this.timeDisplay.style.color = this.style.primaryColor;
    this.labelDisplay.textContent = 'TIME';
  }

  /**
   * Start or resume the timer
   */
  public start(): void {
    if (this.state === 'running') return;

    if (this.state === 'paused') {
      // Resume from pause
      const pauseDuration = performance.now() - this.pausedTime;
      this.startTime += pauseDuration;
    } else {
      // Fresh start
      this.startTime = performance.now();
      this.elapsedAtPause = 0;
    }

    this.state = 'running';
    this.container.style.borderColor = 'rgba(0, 255, 136, 0.5)';
  }

  /**
   * Pause the timer
   */
  public pause(): void {
    if (this.state !== 'running') return;

    this.pausedTime = performance.now();
    this.elapsedAtPause = this.getElapsedMs();
    this.state = 'paused';
    this.container.style.borderColor = 'rgba(255, 165, 0, 0.5)';
  }

  /**
   * Stop the timer (final)
   */
  public stop(): void {
    if (this.state === 'stopped') return;

    if (this.state === 'running') {
      this.elapsedAtPause = this.getElapsedMs();
    }
    this.state = 'stopped';
    this.container.style.borderColor = 'rgba(255, 215, 0, 0.8)';
    this.container.style.boxShadow = '0 0 15px rgba(255, 215, 0, 0.3)';
  }

  /**
   * Get current elapsed time in milliseconds
   */
  public getElapsedMs(): number {
    if (this.state === 'stopped' && this.elapsedAtPause > 0) {
      return this.elapsedAtPause;
    }
    if (this.state === 'paused') {
      return this.elapsedAtPause;
    }
    if (this.state === 'running') {
      return performance.now() - this.startTime;
    }
    return 0;
  }

  /**
   * Get current state
   */
  public getState(): GameTimerState {
    return this.state;
  }

  /**
   * Set countdown duration (call before start)
   */
  public setCountdownDuration(ms: number): void {
    this.countdownMs = ms;
  }

  /**
   * Set callback for when time runs out
   */
  public setOnTimeUp(callback: () => void): void {
    this.onTimeUp = callback;
  }

  /**
   * Add bonus time (from combos)
   */
  public addBonusTime(ms: number): void {
    this.bonusTimeMs += ms;
  }

  /**
   * Get remaining time in ms
   */
  public getRemainingMs(): number {
    const elapsed = this.getElapsedMs();
    return Math.max(0, this.countdownMs + this.bonusTimeMs - elapsed);
  }

  /**
   * Update display (call each frame when running)
   */
  public update(): void {
    if (this.state === 'running') {
      const remaining = this.getRemainingMs();
      this.updateDisplay(remaining);

      // Urgency effects
      const seconds = remaining / 1000;
      if (seconds <= 30 && !this.isUrgent) {
        this.isUrgent = true;
        this.labelDisplay.textContent = 'HURRY!';
      }

      if (seconds <= 30 && seconds > 0) {
        // Pulsing red
        const pulse = Math.sin(performance.now() / 200) * 0.5 + 0.5;
        this.container.style.borderColor = `rgba(255, ${Math.floor(50 + pulse * 50)}, 0, 0.8)`;
        this.timeDisplay.style.color = `rgb(255, ${Math.floor(80 + pulse * 80)}, ${Math.floor(pulse * 40)})`;
        this.container.style.transform = `scale(${1 + pulse * 0.05})`;
      }

      // Large overlay for last 10 seconds
      if (seconds <= 10 && seconds > 0) {
        this.showLargeTimer(remaining);
      } else {
        this.hideLargeTimer();
      }

      // Time's up
      if (remaining <= 0) {
        this.stop();
        this.hideLargeTimer();
        if (this.onTimeUp) this.onTimeUp();
      }
    }
  }

  private showLargeTimer(remainingMs: number): void {
    if (!this.largeTimerOverlay) {
      this.largeTimerOverlay = document.createElement('div');
      this.largeTimerOverlay.style.cssText = `
        position: fixed; top: 15%; left: 50%;
        transform: translate(-50%, -50%);
        font-size: 72px; font-weight: 900;
        font-family: 'Courier New', monospace;
        color: #FF3333;
        text-shadow: 0 0 30px rgba(255, 50, 50, 0.6), 0 2px 10px rgba(0,0,0,0.8);
        pointer-events: none; z-index: 180;
        opacity: 0.9;
      `;
      document.body.appendChild(this.largeTimerOverlay);
    }
    const secs = Math.ceil(remainingMs / 1000);
    this.largeTimerOverlay.textContent = String(secs);
    const pulse = Math.sin(performance.now() / 150) * 0.15 + 1;
    this.largeTimerOverlay.style.transform = `translate(-50%, -50%) scale(${pulse})`;
  }

  private hideLargeTimer(): void {
    if (this.largeTimerOverlay) {
      this.largeTimerOverlay.remove();
      this.largeTimerOverlay = null;
    }
  }

  /**
   * Format milliseconds to MM:SS.ss
   */
  public static formatTime(ms: number): string {
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const centiseconds = Math.floor((ms % 1000) / 10);

    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
  }

  /**
   * Update the time display
   */
  private updateDisplay(ms: number): void {
    this.timeDisplay.textContent = GameTimer.formatTime(ms);
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
   * Flash effect for victory
   */
  public flashVictory(): void {
    this.container.style.transform = 'scale(1.1)';
    this.container.style.boxShadow = '0 0 25px rgba(255, 215, 0, 0.6)';
    this.container.style.borderColor = '#FFD700';

    setTimeout(() => {
      this.container.style.transform = 'scale(1)';
    }, 300);
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.hideLargeTimer();
    this.unmount();
  }
}
