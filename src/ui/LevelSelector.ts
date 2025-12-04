import { LevelConfig, LEVELS } from '../config/levels';

/**
 * Level selector UI - displays available levels on the main menu
 */
export class LevelSelector {
  private container: HTMLDivElement;
  private onSelect: ((level: LevelConfig) => void) | null = null;
  private onLeaderboard: (() => void) | null = null;
  private selectedLevel: LevelConfig | null = null;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'level-selector';
    this.setupStyles();
    this.render();
  }

  /**
   * Set callback for when a level is selected
   */
  public setOnSelect(callback: (level: LevelConfig) => void): void {
    this.onSelect = callback;
  }

  /**
   * Set callback for when leaderboard button is clicked
   */
  public setOnLeaderboard(callback: () => void): void {
    this.onLeaderboard = callback;
  }

  /**
   * Show the level selector
   */
  public show(): void {
    document.body.appendChild(this.container);
  }

  /**
   * Hide and remove the level selector
   */
  public hide(): void {
    if (this.container.parentNode) {
      this.container.style.opacity = '0';
      setTimeout(() => {
        this.container.remove();
      }, 300);
    }
  }

  /**
   * Get currently selected level
   */
  public getSelectedLevel(): LevelConfig | null {
    return this.selectedLevel;
  }

  private setupStyles(): void {
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
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      z-index: 3000;
      opacity: 1;
      transition: opacity 0.3s ease;
    `;

    // Add a dark overlay to ensure text readability
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(26, 26, 46, 0.85);
      z-index: -1;
    `;
    this.container.appendChild(overlay);
  }

  private render(): void {
    this.container.innerHTML = `
      <div style="text-align: center; margin-bottom: 40px;">
        <h1 style="
          margin: 0;
          font-size: 72px;
          font-weight: 900;
          background: linear-gradient(to right, #FF4D4D, #FFD700);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 4px 0px rgba(0,0,0,0.5));
          letter-spacing: 2px;
          text-transform: uppercase;
          font-family: 'Arial Black', sans-serif;
        ">WAG: MANDATORY ATTENDANCE</h1>
        <p style="
          margin: 10px 0 0 0;
          font-size: 24px;
          color: #fff;
          letter-spacing: 1px;
          font-weight: 600;
          text-shadow: 0 2px 4px rgba(0,0,0,0.8);
          background: rgba(0,0,0,0.5);
          display: inline-block;
          padding: 5px 20px;
          border-radius: 20px;
        ">Hunt down the latecomers!</p>
      </div>

      <h2 style="
        color: white;
        font-size: 24px;
        margin: 0 0 20px 0;
        font-weight: 400;
        letter-spacing: 1px;
        opacity: 0.9;
        text-shadow: 0 2px 4px rgba(0,0,0,0.8);
      ">Select Deployment Zone</h2>

      <div id="level-cards" style="
        display: flex;
        gap: 20px;
        flex-wrap: wrap;
        justify-content: center;
        max-width: 1000px;
        padding: 0 20px;
      "></div>

      <button id="btn-leaderboard" style="
        margin-top: 30px;
        padding: 15px 35px;
        font-size: 18px;
        font-weight: 600;
        border: none;
        border-radius: 10px;
        cursor: pointer;
        background: linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 165, 0, 0.2));
        color: #FFD700;
        border: 2px solid rgba(255, 215, 0, 0.4);
        transition: all 0.3s ease;
        text-transform: uppercase;
        letter-spacing: 1px;
      ">🏆 Leaderboard</button>

      <div style="
        margin-top: 50px;
        text-align: center;
        color: rgba(255, 255, 255, 0.5);
        font-size: 14px;
      ">
        <p style="margin: 5px 0;">WASD - Move | Mouse - Look | Space - Jump | LMB - Throw Net</p>
      </div>
    `;

    const cardsContainer = this.container.querySelector('#level-cards');
    if (cardsContainer) {
      LEVELS.forEach((level, index) => {
        const card = this.createLevelCard(level, index);
        cardsContainer.appendChild(card);
      });
    }

    // Leaderboard button listener
    const leaderboardBtn = this.container.querySelector('#btn-leaderboard');
    if (leaderboardBtn) {
      leaderboardBtn.addEventListener('click', () => {
        this.onLeaderboard?.();
      });
      leaderboardBtn.addEventListener('mouseenter', () => {
        (leaderboardBtn as HTMLElement).style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.4), rgba(255, 165, 0, 0.4))';
        (leaderboardBtn as HTMLElement).style.transform = 'translateY(-3px)';
        (leaderboardBtn as HTMLElement).style.boxShadow = '0 10px 30px rgba(255, 215, 0, 0.3)';
      });
      leaderboardBtn.addEventListener('mouseleave', () => {
        (leaderboardBtn as HTMLElement).style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 165, 0, 0.2))';
        (leaderboardBtn as HTMLElement).style.transform = 'translateY(0)';
        (leaderboardBtn as HTMLElement).style.boxShadow = 'none';
      });
    }
  }

  private createLevelCard(level: LevelConfig, index: number): HTMLDivElement {
    const card = document.createElement('div');
    card.className = level.disabled ? 'level-card level-card-disabled' : 'level-card';
    card.dataset.levelId = level.id;

    // Determine icon based on level type
    const icon = level.type === 'simple' ? '🔧' : '🏙️';
    const typeLabel = level.type === 'simple' ? 'TEST' : 'CITY';

    // Coming soon overlay for disabled levels
    const comingSoonOverlay = level.disabled ? `
      <div style="
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10;
      ">
        <span style="
          background: rgba(100, 100, 100, 0.9);
          color: #ccc;
          padding: 8px 20px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 2px;
          text-transform: uppercase;
        ">Coming Soon</span>
      </div>
    ` : '';

    card.innerHTML = `
      ${comingSoonOverlay}
      <div class="card-thumbnail" style="
        width: 100%;
        height: 140px;
        background: linear-gradient(135deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.1) 100%);
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 56px;
        position: relative;
        overflow: hidden;
        border-bottom: 1px solid rgba(255,255,255,0.1);
      ">
        <span style="
          z-index: 1;
          filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3)) ${level.disabled ? 'grayscale(1)' : ''};
          transition: transform 0.3s ease;
          opacity: ${level.disabled ? '0.5' : '1'};
        " class="card-icon">${icon}</span>

        <div style="
          position: absolute;
          top: 15px;
          right: 15px;
          background: ${level.type === 'simple' ? 'rgba(231, 76, 60, 0.9)' : 'rgba(39, 174, 96, 0.9)'};
          color: white;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 1px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.2);
          ${level.disabled ? 'filter: grayscale(1); opacity: 0.5;' : ''}
        ">${typeLabel}</div>
      </div>
      <div class="card-content" style="
        padding: 20px;
        text-align: center;
      ">
        <h3 style="
          margin: 0 0 10px 0;
          color: ${level.disabled ? 'rgba(255, 255, 255, 0.4)' : 'white'};
          font-size: 20px;
          font-weight: 600;
        ">${level.name}</h3>
        <p style="
          margin: 0;
          color: rgba(255, 255, 255, ${level.disabled ? '0.3' : '0.6'});
          font-size: 14px;
          line-height: 1.4;
        ">${level.description}</p>
      </div>
    `;

    // Card styling with improved readability
    card.style.cssText = `
      width: 260px;
      background: rgba(20, 20, 35, 0.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-radius: 16px;
      cursor: ${level.disabled ? 'not-allowed' : 'pointer'};
      transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
      border: 1px solid rgba(255, 255, 255, 0.15);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      overflow: hidden;
      animation: fadeInUp 0.5s ease ${index * 0.1}s both;
      position: relative;
      ${level.disabled ? 'opacity: 0.7;' : ''}
    `;

    // Add animation keyframes if not already added
    if (!document.getElementById('level-selector-styles')) {
      const style = document.createElement('style');
      style.id = 'level-selector-styles';
      style.textContent = `
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .level-card:not(.level-card-disabled):hover {
          transform: translateY(-8px);
          background: rgba(30, 30, 50, 0.95) !important;
          border-color: #FFD700 !important;
          box-shadow: 0 15px 35px rgba(0, 0, 0, 0.6), 0 0 20px rgba(255, 215, 0, 0.3) !important;
        }
        .level-card:not(.level-card-disabled):hover .card-icon {
          transform: scale(1.15) rotate(5deg);
        }
        .level-card:not(.level-card-disabled):active {
          transform: translateY(-4px) scale(1.01);
        }
        .level-card-disabled:hover {
          opacity: 0.75 !important;
        }
      `;
      document.head.appendChild(style);
    }

    // Click handler - only for enabled levels
    if (!level.disabled) {
      card.addEventListener('click', () => {
        this.selectedLevel = level;
        this.highlightCard(card);

        // Small delay before callback for visual feedback
        setTimeout(() => {
          if (this.onSelect) {
            this.onSelect(level);
          }
        }, 200);
      });
    }

    return card;
  }

  private highlightCard(selectedCard: HTMLDivElement): void {
    // Remove highlight from all cards
    const allCards = this.container.querySelectorAll('.level-card');
    allCards.forEach(card => {
      (card as HTMLDivElement).style.borderColor = 'transparent';
      (card as HTMLDivElement).style.boxShadow = 'none';
    });

    // Highlight selected card
    selectedCard.style.borderColor = '#FFD700';
    selectedCard.style.boxShadow = '0 0 30px rgba(255, 215, 0, 0.5)';
  }
}
