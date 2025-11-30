/**
 * VictoryScreen
 * Displayed when player catches all employees
 * Allows optional score submission to leaderboard
 */

import { LeaderboardService, type SubmitResult } from '../services/LeaderboardService';
import { GameTimer } from './components/GameTimer';

type VictoryCallback = () => void;

interface VictoryScreenCallbacks {
  onPlayAgain?: VictoryCallback;
  onMainMenu?: VictoryCallback;
  onShowLeaderboard?: VictoryCallback;
}

type ScreenState = 'initial' | 'submitting' | 'submitted' | 'skipped';

export class VictoryScreen {
  private container: HTMLDivElement | null = null;
  private callbacks: VictoryScreenCallbacks = {};
  private leaderboardService: LeaderboardService;
  private timeMs = 0;
  private state: ScreenState = 'initial';

  constructor() {
    this.leaderboardService = LeaderboardService.getInstance();
  }

  /**
   * Set callbacks for screen actions
   */
  public setCallbacks(callbacks: VictoryScreenCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Show the victory screen
   */
  public show(timeMs: number): void {
    this.timeMs = timeMs;
    this.state = 'initial';
    this.render();
    document.body.appendChild(this.container!);

    // Exit pointer lock
    document.exitPointerLock();
  }

  /**
   * Hide and remove the victory screen
   */
  public hide(): void {
    if (this.container && this.container.parentNode) {
      this.container.style.opacity = '0';
      setTimeout(() => {
        this.container?.remove();
        this.container = null;
      }, 300);
    }
  }

  /**
   * Main render method
   */
  private render(): void {
    this.container = document.createElement('div');
    this.container.id = 'victory-screen';
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 50, 0, 0.95);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      font-family: 'Segoe UI', sans-serif;
      z-index: 3000;
      opacity: 1;
      transition: opacity 0.3s ease;
    `;

    this.renderInitialState();
  }

  /**
   * Render initial victory state with score submission option
   */
  private renderInitialState(): void {
    if (!this.container) return;

    const formattedTime = GameTimer.formatTime(this.timeMs);
    const isLeaderboardAvailable = this.leaderboardService.isAvailable();

    this.container.innerHTML = `
      <div style="text-align: center; animation: fadeIn 0.5s ease;">
        <h1 style="
          margin: 0 0 10px 0;
          font-size: 72px;
          color: #FFD700;
          text-shadow: 0 4px 20px rgba(255, 215, 0, 0.5);
        ">🎉 VICTORY! 🎉</h1>

        <p style="
          margin: 0 0 30px 0;
          font-size: 24px;
          color: white;
          opacity: 0.9;
        ">Všichni zaměstnanci byli chyceni!</p>

        <div style="
          background: rgba(0, 0, 0, 0.5);
          padding: 25px 50px;
          border-radius: 15px;
          margin-bottom: 30px;
          border: 2px solid rgba(255, 215, 0, 0.3);
        ">
          <div style="
            font-size: 14px;
            color: rgba(255, 255, 255, 0.6);
            text-transform: uppercase;
            letter-spacing: 2px;
            margin-bottom: 5px;
          ">Tvůj čas</div>
          <div style="
            font-size: 48px;
            font-weight: bold;
            color: #FFD700;
            font-family: 'Courier New', monospace;
            letter-spacing: 2px;
          ">⏱️ ${formattedTime}</div>
        </div>

        ${isLeaderboardAvailable ? this.getLeaderboardFormHTML() : this.getNoLeaderboardHTML()}
      </div>

      <style>
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .victory-btn {
          padding: 15px 30px;
          font-size: 16px;
          font-weight: 600;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .victory-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
        }
        .victory-btn:active {
          transform: translateY(0);
        }
        .victory-btn-primary {
          background: linear-gradient(135deg, #FFD700, #FFA500);
          color: #000;
        }
        .victory-btn-secondary {
          background: rgba(255, 255, 255, 0.1);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.3);
        }
        .victory-input {
          padding: 12px 15px;
          font-size: 18px;
          border: 2px solid rgba(255, 215, 0, 0.5);
          border-radius: 8px;
          background: rgba(0, 0, 0, 0.5);
          color: white;
          outline: none;
          width: 200px;
          text-align: center;
        }
        .victory-input:focus {
          border-color: #FFD700;
          box-shadow: 0 0 15px rgba(255, 215, 0, 0.3);
        }
        .victory-input::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }
      </style>
    `;

    this.attachEventListeners();
  }

  /**
   * Get HTML for leaderboard submission form
   */
  private getLeaderboardFormHTML(): string {
    return `
      <div id="leaderboard-form" style="
        background: rgba(0, 0, 0, 0.4);
        padding: 25px 40px;
        border-radius: 15px;
        margin-bottom: 25px;
        border: 1px solid rgba(255, 255, 255, 0.1);
      ">
        <p style="
          margin: 0 0 15px 0;
          font-size: 18px;
          color: white;
        ">Uložit do leaderboardu?</p>

        <div style="display: flex; gap: 15px; align-items: center; justify-content: center; flex-wrap: wrap;">
          <input
            type="text"
            id="player-name-input"
            class="victory-input"
            placeholder="Tvoje jméno"
            maxlength="20"
          />
          <button id="btn-submit" class="victory-btn victory-btn-primary">
            💾 Uložit
          </button>
          <button id="btn-skip" class="victory-btn victory-btn-secondary">
            ❌ Přeskočit
          </button>
        </div>
        <p style="
          margin: 10px 0 0 0;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
        ">Max 20 znaků</p>
      </div>

      <div id="action-buttons" style="display: none; gap: 15px; justify-content: center;">
        <button id="btn-leaderboard" class="victory-btn victory-btn-primary">
          🏆 Zobrazit leaderboard
        </button>
        <button id="btn-play-again" class="victory-btn victory-btn-secondary">
          🔄 Hrát znovu
        </button>
        <button id="btn-menu" class="victory-btn victory-btn-secondary">
          🏠 Hlavní menu
        </button>
      </div>

      <div id="result-message" style="
        margin-bottom: 20px;
        padding: 15px 25px;
        border-radius: 10px;
        display: none;
        font-size: 16px;
      "></div>
    `;
  }

  /**
   * Get HTML when leaderboard is not available
   */
  private getNoLeaderboardHTML(): string {
    return `
      <p style="
        margin: 0 0 25px 0;
        font-size: 14px;
        color: rgba(255, 255, 255, 0.5);
      ">Leaderboard není dostupný (chybí konfigurace)</p>

      <div style="display: flex; gap: 15px; justify-content: center;">
        <button id="btn-play-again" class="victory-btn victory-btn-primary">
          🔄 Hrát znovu
        </button>
        <button id="btn-menu" class="victory-btn victory-btn-secondary">
          🏠 Hlavní menu
        </button>
      </div>
    `;
  }

  /**
   * Attach event listeners to buttons
   */
  private attachEventListeners(): void {
    if (!this.container) return;

    // Submit button
    const submitBtn = this.container.querySelector('#btn-submit');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => this.handleSubmit());
    }

    // Skip button
    const skipBtn = this.container.querySelector('#btn-skip');
    if (skipBtn) {
      skipBtn.addEventListener('click', () => this.handleSkip());
    }

    // Play again button
    const playAgainBtn = this.container.querySelector('#btn-play-again');
    if (playAgainBtn) {
      playAgainBtn.addEventListener('click', () => {
        this.hide();
        this.callbacks.onPlayAgain?.();
      });
    }

    // Main menu button
    const menuBtn = this.container.querySelector('#btn-menu');
    if (menuBtn) {
      menuBtn.addEventListener('click', () => {
        this.hide();
        this.callbacks.onMainMenu?.();
      });
    }

    // Leaderboard button
    const leaderboardBtn = this.container.querySelector('#btn-leaderboard');
    if (leaderboardBtn) {
      leaderboardBtn.addEventListener('click', () => {
        this.callbacks.onShowLeaderboard?.();
      });
    }

    // Enter key on input
    const input = this.container.querySelector('#player-name-input') as HTMLInputElement;
    if (input) {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.handleSubmit();
        }
      });
      // Auto focus
      setTimeout(() => input.focus(), 100);
    }
  }

  /**
   * Handle score submission
   */
  private async handleSubmit(): Promise<void> {
    if (!this.container || this.state === 'submitting') return;

    const input = this.container.querySelector('#player-name-input') as HTMLInputElement;
    const name = input?.value.trim();

    if (!name) {
      this.showMessage('Zadej prosím jméno', 'error');
      input?.focus();
      return;
    }

    this.state = 'submitting';
    this.setFormEnabled(false);
    this.showMessage('Ukládám...', 'info');

    const result = await this.leaderboardService.submitScore(name, this.timeMs);
    this.showSubmitResult(result);
  }

  /**
   * Show submission result
   */
  private showSubmitResult(result: SubmitResult): void {
    this.state = 'submitted';

    if (!result.success) {
      this.showMessage(result.error || 'Chyba při ukládání', 'error');
      this.setFormEnabled(true);
      this.state = 'initial';
      return;
    }

    // Hide form, show action buttons
    const form = this.container?.querySelector('#leaderboard-form');
    const actionButtons = this.container?.querySelector('#action-buttons');
    if (form) (form as HTMLElement).style.display = 'none';
    if (actionButtons) (actionButtons as HTMLElement).style.display = 'flex';

    if (result.isNewRecord) {
      // New entry
      this.showMessage(
        `✅ Uloženo! Jsi na ${result.currentRank}. místě!`,
        'success'
      );
    } else if (result.isImprovement) {
      // Improved existing record
      const prevTime = GameTimer.formatTime(result.previousTime!);
      const newTime = GameTimer.formatTime(this.timeMs);
      this.showMessage(
        `🎯 Zlepšil jsi svůj rekord!\nPředchozí: ${prevTime} → Nový: ${newTime}\nPosunul ses z ${result.previousRank}. na ${result.currentRank}. místo!`,
        'success'
      );
    } else {
      // Not an improvement
      const bestTime = GameTimer.formatTime(result.previousTime!);
      this.showMessage(
        `⏱️ Tvůj nejlepší čas je stále ${bestTime}\n(Aktuální: ${GameTimer.formatTime(this.timeMs)} - neuloženo)`,
        'info'
      );
    }
  }

  /**
   * Handle skip button
   */
  private handleSkip(): void {
    this.state = 'skipped';

    // Hide form, show action buttons
    const form = this.container?.querySelector('#leaderboard-form');
    const actionButtons = this.container?.querySelector('#action-buttons');
    if (form) (form as HTMLElement).style.display = 'none';
    if (actionButtons) (actionButtons as HTMLElement).style.display = 'flex';
  }

  /**
   * Show a message
   */
  private showMessage(text: string, type: 'success' | 'error' | 'info'): void {
    const messageEl = this.container?.querySelector('#result-message') as HTMLElement;
    if (!messageEl) return;

    const colors = {
      success: { bg: 'rgba(0, 200, 0, 0.2)', border: '#00C800', text: '#88FF88' },
      error: { bg: 'rgba(200, 0, 0, 0.2)', border: '#C80000', text: '#FF8888' },
      info: { bg: 'rgba(100, 100, 200, 0.2)', border: '#6464C8', text: '#AAAAFF' },
    };

    const c = colors[type];
    messageEl.style.background = c.bg;
    messageEl.style.border = `1px solid ${c.border}`;
    messageEl.style.color = c.text;
    messageEl.style.display = 'block';
    messageEl.style.whiteSpace = 'pre-line';
    messageEl.textContent = text;
  }

  /**
   * Enable/disable form inputs
   */
  private setFormEnabled(enabled: boolean): void {
    const input = this.container?.querySelector('#player-name-input') as HTMLInputElement;
    const submitBtn = this.container?.querySelector('#btn-submit') as HTMLButtonElement;
    const skipBtn = this.container?.querySelector('#btn-skip') as HTMLButtonElement;

    if (input) input.disabled = !enabled;
    if (submitBtn) submitBtn.disabled = !enabled;
    if (skipBtn) skipBtn.disabled = !enabled;
  }
}
