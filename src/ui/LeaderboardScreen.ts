/**
 * LeaderboardScreen
 * Displays top 10 players with their times
 * Accessible from main menu
 */

import { LeaderboardService, type LeaderboardEntry } from '../services/LeaderboardService';
import { GameTimer } from './components/GameTimer';

type ScreenCallback = () => void;

export class LeaderboardScreen {
  private container: HTMLDivElement | null = null;
  private onBack: ScreenCallback | null = null;
  private leaderboardService: LeaderboardService;

  constructor() {
    this.leaderboardService = LeaderboardService.getInstance();
  }

  /**
   * Set callback for back button
   */
  public setOnBack(callback: ScreenCallback): void {
    this.onBack = callback;
  }

  /**
   * Show the leaderboard screen
   */
  public async show(): Promise<void> {
    this.render();
    document.body.appendChild(this.container!);

    // Load scores
    await this.loadScores();
  }

  /**
   * Hide and remove the screen
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
   * Render the screen structure
   */
  private render(): void {
    this.container = document.createElement('div');
    this.container.id = 'leaderboard-screen';
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-image: url(/assets/images/intro_background.png);
      background-size: cover;
      background-position: center;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      font-family: 'Segoe UI', sans-serif;
      z-index: 3000;
      opacity: 1;
      transition: opacity 0.3s ease;
    `;

    // Dark overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(26, 26, 46, 0.92);
      z-index: -1;
    `;
    this.container.appendChild(overlay);

    this.container.innerHTML += `
      <div style="text-align: center; max-width: 600px; width: 90%;">
        <h1 style="
          margin: 0 0 10px 0;
          font-size: 48px;
          color: #FFD700;
          text-shadow: 0 4px 15px rgba(255, 215, 0, 0.4);
        ">🏆 LEADERBOARD</h1>

        <p style="
          margin: 0 0 30px 0;
          font-size: 18px;
          color: rgba(255, 255, 255, 0.6);
        ">Cartoon City - Top 10</p>

        <div id="leaderboard-content" style="
          background: rgba(0, 0, 0, 0.5);
          border-radius: 15px;
          padding: 20px;
          border: 1px solid rgba(255, 215, 0, 0.2);
          min-height: 300px;
          display: flex;
          justify-content: center;
          align-items: center;
        ">
          <div class="loader" style="
            color: rgba(255, 255, 255, 0.5);
            font-size: 18px;
          ">Načítám...</div>
        </div>

        <button id="btn-back" style="
          margin-top: 25px;
          padding: 15px 40px;
          font-size: 16px;
          font-weight: 600;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          background: rgba(255, 255, 255, 0.1);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.3);
          transition: all 0.2s ease;
          text-transform: uppercase;
          letter-spacing: 1px;
        ">← Zpět do menu</button>
      </div>

      <style>
        #btn-back:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: translateY(-2px);
        }
      </style>
    `;

    // Back button listener
    const backBtn = this.container.querySelector('#btn-back');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        this.hide();
        this.onBack?.();
      });
    }
  }

  /**
   * Load and display scores
   */
  private async loadScores(): Promise<void> {
    const contentEl = this.container?.querySelector('#leaderboard-content');
    if (!contentEl) return;

    if (!this.leaderboardService.isAvailable()) {
      contentEl.innerHTML = `
        <div style="text-align: center; color: rgba(255, 255, 255, 0.5);">
          <p style="font-size: 18px; margin: 0 0 10px 0;">😔 Leaderboard není dostupný</p>
          <p style="font-size: 14px; margin: 0;">Chybí konfigurace Supabase</p>
        </div>
      `;
      return;
    }

    const scores = await this.leaderboardService.getTopScores(10);

    if (scores.length === 0) {
      contentEl.innerHTML = `
        <div style="text-align: center; color: rgba(255, 255, 255, 0.5);">
          <p style="font-size: 18px; margin: 0 0 10px 0;">📭 Žádné záznamy</p>
          <p style="font-size: 14px; margin: 0;">Buď první, kdo se zapíše!</p>
        </div>
      `;
      return;
    }

    contentEl.innerHTML = this.renderScoresTable(scores);
  }

  /**
   * Render scores as a table
   */
  private renderScoresTable(scores: LeaderboardEntry[]): string {
    const medals = ['🥇', '🥈', '🥉'];

    const rows = scores.map((score, index) => {
      const rank = index < 3 ? medals[index] : `${index + 1}.`;
      const time = GameTimer.formatTime(score.time_ms);
      const date = this.formatDate(score.updated_at || score.created_at);

      const isTopThree = index < 3;
      const rowStyle = isTopThree
        ? 'background: rgba(255, 215, 0, 0.1);'
        : '';

      return `
        <tr style="${rowStyle}">
          <td style="
            padding: 12px 15px;
            font-size: ${isTopThree ? '20px' : '16px'};
            width: 50px;
            text-align: center;
          ">${rank}</td>
          <td style="
            padding: 12px 15px;
            font-weight: ${isTopThree ? '600' : '400'};
            color: ${isTopThree ? '#FFD700' : 'white'};
          ">${this.escapeHtml(score.player_name)}</td>
          <td style="
            padding: 12px 15px;
            font-family: 'Courier New', monospace;
            color: ${isTopThree ? '#FFD700' : '#88FF88'};
            font-weight: 600;
          ">${time}</td>
          <td style="
            padding: 12px 15px;
            color: rgba(255, 255, 255, 0.4);
            font-size: 13px;
          ">${date}</td>
        </tr>
      `;
    }).join('');

    return `
      <table style="
        width: 100%;
        border-collapse: collapse;
        color: white;
      ">
        <thead>
          <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.2);">
            <th style="padding: 10px 15px; text-align: center; color: rgba(255, 255, 255, 0.5); font-weight: 500;">#</th>
            <th style="padding: 10px 15px; text-align: left; color: rgba(255, 255, 255, 0.5); font-weight: 500;">Jméno</th>
            <th style="padding: 10px 15px; text-align: left; color: rgba(255, 255, 255, 0.5); font-weight: 500;">Čas</th>
            <th style="padding: 10px 15px; text-align: left; color: rgba(255, 255, 255, 0.5); font-weight: 500;">Datum</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  /**
   * Format date for display
   */
  private formatDate(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleDateString('cs-CZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
