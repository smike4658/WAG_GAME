import * as THREE from 'three';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { InputManager } from './core/InputManager';
import { Player } from './entities/Player';
import { EmployeeManager, DEFAULT_EMPLOYEES } from './entities/EmployeeManager';
import { NetLauncher } from './weapons/NetLauncher';
import { StaticCity } from './world/StaticCity';
import { SimpleCity } from './world/SimpleCity';
import { getCityCollider } from './world/collision/CityCollider';
import { AudioManager } from './audio/AudioManager';
import { MUSIC_CONFIG } from './audio/AudioConfig';
import { AssetLoader } from './core/AssetLoader';
import { CharacterLoader } from './core/CharacterLoader';
import { LevelSelector } from './ui/LevelSelector';
import { LevelConfig } from './config/levels';
import { HUD, createHUDData } from './ui/HUD';
import { DayNightCycle } from './world/environment/DayNightCycle';
import { IntroSequence } from './scenes/IntroSequence';
import { LeaderboardService } from './services/LeaderboardService';
import { VictoryScreen } from './ui/VictoryScreen';
import { LeaderboardScreen } from './ui/LeaderboardScreen';
import { PowerupManager, PowerupType } from './powerups/PowerupManager';
import { ScreenEffects } from './ui/ScreenEffects';

/**
 * WAG GAME - Main Entry Point
 *
 * A 3D browser game where Jirka (Head of Team) catches employees
 * in a low-poly recreation of Ostrava's Masarykovo namesti.
 */

class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly labelRenderer: CSS2DRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly inputManager: InputManager;
  private city: StaticCity | SimpleCity | null = null;

  private player: Player | null = null;
  private netLauncher: NetLauncher | null = null;
  private employeeManager: EmployeeManager | null = null;
  private audioManager: AudioManager;
  private assetLoader: AssetLoader;
  private characterLoader: CharacterLoader;
  private levelSelector: LevelSelector;
  private selectedLevel: LevelConfig | null = null;

  // Leaderboard system
  private leaderboardService: LeaderboardService;
  private victoryScreen: VictoryScreen;
  private leaderboardScreen: LeaderboardScreen;

  // New modular HUD system
  private readonly hud: HUD;

  // Day/Night cycle system
  private dayNightCycle: DayNightCycle | null = null;

  // Powerup system
  private powerupManager: PowerupManager | null = null;
  private screenEffects: ScreenEffects;

  private previousTime = 0;
  private isLoading = true;
  private isInMenu = true;
  private isVictory = false;

  // Track caught employees for minimap
  private readonly caughtEmployeeIds: Set<string> = new Set();

  // Player idle voice line timer
  private idleVoiceTimer = 0;
  private readonly idleVoiceInterval = 15; // Play idle line every 15-25 seconds

  constructor() {
    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    const app = document.getElementById('app');
    if (!app) throw new Error('App container not found');
    app.appendChild(this.renderer.domElement);

    // Create CSS2D renderer for labels
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
    this.labelRenderer.domElement.style.position = 'absolute';
    this.labelRenderer.domElement.style.top = '0';
    this.labelRenderer.domElement.style.pointerEvents = 'none';
    app.appendChild(this.labelRenderer.domElement);

    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);

    // Create camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      2000
    );
    this.camera.position.set(0, 1.7, 5);

    // Setup input
    this.inputManager = new InputManager(this.renderer.domElement);

    // City will be created AFTER assets are loaded
    // this.city is initialized in start() after AssetLoader

    // Initialize audio manager
    this.audioManager = AudioManager.getInstance();

    // Initialize asset loader
    this.assetLoader = AssetLoader.getInstance();

    // Initialize character loader
    this.characterLoader = CharacterLoader.getInstance();

    // Initialize level selector
    this.levelSelector = new LevelSelector();
    this.levelSelector.setOnSelect((level) => this.onLevelSelected(level));
    this.levelSelector.setOnLeaderboard(() => this.showLeaderboard());

    // Initialize leaderboard system
    this.leaderboardService = LeaderboardService.getInstance();
    this.leaderboardService.initialize();

    // Initialize screens
    this.victoryScreen = new VictoryScreen();
    this.victoryScreen.setCallbacks({
      onPlayAgain: () => this.restartGame(),
      onMainMenu: () => this.returnToMenu(),
      onShowLeaderboard: () => this.showLeaderboard(),
    });

    this.leaderboardScreen = new LeaderboardScreen();
    this.leaderboardScreen.setOnBack(() => {
      // Back to level selector or victory screen depending on context
    });

    // Initialize new HUD system
    this.hud = new HUD();
    this.hud.mount();

    // Initialize screen effects
    this.screenEffects = new ScreenEffects();
    this.screenEffects.mount();

    // Setup scene
    this.setupLighting();
    this.setupHelpers();

    // Handle window resize
    window.addEventListener('resize', () => this.onResize());

    // Add overlays (hidden initially)
    this.addLoadingOverlay();
    this.addInstructionOverlay();

    // Setup pointer lock listener for HUD visibility and game timer
    document.addEventListener('pointerlockchange', () => {
      const isLocked = document.pointerLockElement !== null;
      if (!this.isLoading && !this.isInMenu && !this.isVictory) {
        this.hud.setActive(isLocked);
        // Control game timer based on pointer lock
        if (isLocked) {
          this.hud.startGameTimer();
        } else {
          this.hud.pauseGameTimer();
        }
      }
    });
  }

  /**
   * Handle level selection from menu
   */
  /**
   * Handle level selection from menu
   */
  private async onLevelSelected(level: LevelConfig): Promise<void> {
    console.log(`[Game] Level selected: ${level.name}`);
    this.selectedLevel = level;
    this.isInMenu = false;
    this.levelSelector.hide();

    // Play intro sequence
    const intro = new IntroSequence();
    await intro.play();

    this.startGame();
  }

  private setupLighting(): void {
    // Bright daytime lighting for the low-poly city

    // Strong ambient for overall visibility
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    // Main sun light - warm afternoon sun
    const sunLight = new THREE.DirectionalLight(0xfffaf0, 1.2);
    sunLight.position.set(100, 150, 100);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 500;
    sunLight.shadow.camera.left = -200;
    sunLight.shadow.camera.right = 200;
    sunLight.shadow.camera.top = 200;
    sunLight.shadow.camera.bottom = -200;
    sunLight.shadow.bias = -0.0001;
    this.scene.add(sunLight);

    // Fill light - softer, from opposite side
    const fillLight = new THREE.DirectionalLight(0x87CEEB, 0.4);
    fillLight.position.set(-100, 80, -100);
    this.scene.add(fillLight);

    // Hemisphere light - sky blue to ground green
    const hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x556B2F, 0.5);
    this.scene.add(hemiLight);

    // Clear blue sky
    this.scene.background = new THREE.Color(0x87CEEB);

    // Light atmospheric fog
    this.scene.fog = new THREE.Fog(0xc0d8e8, 150, 500);
  }

  private setupHelpers(): void {
    // Debug helpers - disabled for clean look
    // Uncomment for debugging:
    // const gridHelper = new THREE.GridHelper(500, 50, 0x444444, 0x888888);
    // gridHelper.position.y = 0.01;
    // this.scene.add(gridHelper);
    // const axesHelper = new THREE.AxesHelper(10);
    // axesHelper.position.y = 0.02;
    // this.scene.add(axesHelper);
  }

  private addLoadingOverlay(): void {
    const overlay = document.createElement('div');
    overlay.id = 'loading';
    overlay.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(26, 26, 46, 0.95);
        color: white;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        font-family: 'Segoe UI', sans-serif;
        z-index: 2000;
      ">
        <h1 style="margin: 0 0 20px 0; color: #FFD700; font-size: 48px;">WAG GAME</h1>
        <p style="margin: 0 0 30px 0; font-size: 20px; opacity: 0.8;">Loading Ostrava...</p>
        <div style="
          width: 200px;
          height: 4px;
          background: rgba(255,255,255,0.2);
          border-radius: 2px;
          overflow: hidden;
        ">
          <div id="loading-bar" style="
            width: 0%;
            height: 100%;
            background: #FFD700;
            transition: width 0.3s ease;
          "></div>
        </div>
        <p id="loading-status" style="margin: 15px 0 0 0; font-size: 14px; opacity: 0.6;">
          Initializing physics...
        </p>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  private updateLoadingProgress(progress: number, status: string): void {
    const bar = document.getElementById('loading-bar');
    const statusEl = document.getElementById('loading-status');
    if (bar) bar.style.width = `${progress}%`;
    if (statusEl) statusEl.textContent = status;
  }

  private hideLoadingOverlay(): void {
    const overlay = document.getElementById('loading');
    if (overlay) {
      overlay.style.transition = 'opacity 0.5s ease';
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 500);
    }
    this.isLoading = false;
  }

  private addInstructionOverlay(): void {
    const overlay = document.createElement('div');
    overlay.id = 'instructions';
    overlay.style.display = 'none';
    overlay.innerHTML = `
      <div style="
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 30px 50px;
        border-radius: 10px;
        text-align: center;
        font-family: 'Segoe UI', sans-serif;
        z-index: 1000;
        pointer-events: none;
      ">
        <h1 style="margin: 0 0 15px 0; color: #FFD700;">WAG GAME</h1>
        <p style="margin: 0 0 10px 0; font-size: 18px;">Help Jirka recruit the team!</p>
        <p style="margin: 0 0 15px 0; font-size: 14px; opacity: 0.7;">Masarykovo namesti, Ostrava</p>
        <div style="text-align: left; font-size: 14px; opacity: 0.8;">
          <p style="margin: 5px 0;">WASD - Move</p>
          <p style="margin: 5px 0;">Mouse - Look around</p>
          <p style="margin: 5px 0;">Space - Jump</p>
          <p style="margin: 5px 0;">Shift - Sprint</p>
          <p style="margin: 5px 0;">Left Click - Throw net</p>
        </div>
        <p style="margin: 15px 0 0 0; font-size: 14px; color: #FFD700;">Click to start</p>
      </div>
    `;
    document.body.appendChild(overlay);

    document.addEventListener('pointerlockchange', () => {
      const instructionsEl = document.getElementById('instructions');
      if (instructionsEl && !this.isLoading) {
        instructionsEl.style.display = document.pointerLockElement ? 'none' : 'block';
      }
    });
  }

  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
  }

  /**
   * Initialize and show level selector
   */
  public async start(): Promise<void> {

    this.previousTime = performance.now();
    this.animate();

    // Hide loading overlay initially (we show it after level select)
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
      loadingEl.style.display = 'none';
    }

    // Show level selector
    this.levelSelector.show();
    console.log('[Game] Level selector displayed');
  }

  /**
   * Start the game with selected level
   */
  private async startGame(): Promise<void> {
    if (!this.selectedLevel) {
      console.error('[Game] No level selected!');
      return;
    }

    // Show loading overlay
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
      loadingEl.style.display = 'flex';
    }

    try {
      // Only load 3D assets for static city levels (SimpleCity doesn't need them)
      if (this.selectedLevel.type === 'static') {
        this.updateLoadingProgress(5, 'Loading 3D assets...');
        await this.assetLoader.initialize((progress, status) => {
          this.updateLoadingProgress(5 + progress * 0.10, status);
        });
      } else {
        this.updateLoadingProgress(15, 'Skipping 3D assets (not needed)...');
      }

      // Load character models
      this.updateLoadingProgress(15, 'Loading character models...');
      await this.characterLoader.initialize((progress, status) => {
        this.updateLoadingProgress(15 + progress * 0.10, status);
      });

      this.updateLoadingProgress(25, `Loading ${this.selectedLevel.name}...`);

      // Load city based on selected level type
      if (this.selectedLevel.type === 'simple' && this.selectedLevel.simpleConfig) {
        // Simple test city with hand-crafted roads
        this.city = new SimpleCity(this.selectedLevel.simpleConfig);
        const cityGroup = await this.city.build((progress, status) => {
          this.updateLoadingProgress(25 + progress * 0.50, status);
        });
        this.scene.add(cityGroup);
      } else if (this.selectedLevel.type === 'static' && this.selectedLevel.staticConfig) {
        // GLB model city
        this.city = new StaticCity(this.selectedLevel.staticConfig);
        const cityGroup = await this.city.load((progress, status) => {
          this.updateLoadingProgress(25 + progress * 0.50, status);
        });
        this.scene.add(cityGroup);
      }

      this.updateLoadingProgress(78, 'Initializing audio...');
      await this.audioManager.initialize();

      this.updateLoadingProgress(82, 'Creating player...');

      // Get spawn position (facing the central square)
      const spawn = this.city!.getSpawnPosition();

      // Create player with collision system
      this.player = new Player(this.camera, this.inputManager, {}, getCityCollider());
      // Spawn player at designated position facing the square
      this.player.setSpawnPosition(spawn.x, 0, spawn.z);

      // Setup sprint exhaustion callback
      this.player.setOnSprintExhausted(() => {
        console.log('[Game] Sprint exhausted!');
        this.hud.onSprintExhausted();
        this.audioManager.playExhaustionSound();
      });

      this.updateLoadingProgress(85, 'Setting up weapons...');

      // Create employee manager (CharacterLoader provides individual models per role)
      this.employeeManager = new EmployeeManager(this.scene);
      this.employeeManager.setOnCatch((employee, _remaining) => {
        console.log(`[Game] Caught ${employee.config.name}!`);
        // Track caught employee for minimap
        this.caughtEmployeeIds.add(employee.id);
        // Notify HUD of catch
        this.hud.onCatch();
        // Play catch sound
        this.audioManager.playCatchSound(employee.getPosition());
        // Play player catch voice line
        this.audioManager.playPlayerCatchSound();
        // Reset idle voice timer after catch
        this.idleVoiceTimer = 0;
      });
      this.employeeManager.setOnAllCaught(() => {
        console.log('[Game] ALL EMPLOYEES CAUGHT! Victory!');
        this.showVictoryScreen();
      });
      this.employeeManager.setOnScream((employee) => {
        console.log(`[Game] ${employee.config.name} screams!`);
        // Play Czech voice clip based on role
        this.audioManager.playVoiceClip(employee.config.role, employee.getPosition());
        // Play player approach voice line (50% chance to not spam)
        if (Math.random() < 0.5) {
          this.audioManager.playPlayerApproachSound();
        }
      });
      // Night refusal behavior removed - employees now work 24/7

      // Initialize NPC loader for lowpoly character models
      this.updateLoadingProgress(87, 'Loading NPC models...');
      await this.employeeManager.initializeNPCLoader((progress, status) => {
        this.updateLoadingProgress(87 + progress * 0.03, status);
      });

      // Spawn employees around the square
      const spawnCenter = new THREE.Vector3(spawn.x, 0, spawn.z);
      this.employeeManager.spawnEmployees(DEFAULT_EMPLOYEES, spawnCenter, 40);

      // Initialize Day/Night cycle
      this.updateLoadingProgress(90, 'Setting up environment...');
      this.dayNightCycle = new DayNightCycle(this.scene, {
        dayDuration: 120,     // 2 minutes for a full day
        nightDuration: 30,    // 30 seconds for night
      });

      // Set up day/night cycle callbacks (visual only - employees work 24/7)
      this.dayNightCycle.setCallbacks({
        onTimeChange: (phase, _progress) => {
          // Update HUD time indicator
          if (this.dayNightCycle) {
            this.hud.updateTime(this.dayNightCycle.getTimeString(), phase);
          }
        },
      });

      // Create net launcher
      this.netLauncher = new NetLauncher(this.scene);
      this.netLauncher.setOnCatch((id) => {
        if (this.employeeManager) {
          this.employeeManager.catchEmployee(id);
        }
      });

      // Initialize powerup system
      this.updateLoadingProgress(95, 'Setting up powerups...');
      this.powerupManager = new PowerupManager(this.scene);

      // Use TEST MODE for Training Ground (test-city) - spawns all 7 powerups
      if (this.selectedLevel?.id === 'test-city') {
        this.powerupManager.initializeTestMode(spawn);
      } else {
        // Normal mode - random powerups at 3 locations
        const cityBox = this.city!.getBounds();
        const cityBounds = {
          min: new THREE.Vector2(cityBox.min.x, cityBox.min.z),
          max: new THREE.Vector2(cityBox.max.x, cityBox.max.z),
        };
        // Use spawn offset from level config to avoid center props
        const spawnOffset = this.selectedLevel?.staticConfig?.spawnOffset;
        const powerupOffset: [number, number] | undefined = spawnOffset
          ? [spawnOffset[0], spawnOffset[2]]
          : undefined;
        this.powerupManager.initialize(cityBounds, powerupOffset);
      }

      // Set up powerup callbacks
      this.powerupManager.setCallbacks({
        onCollect: (powerup) => {
          console.log(`[Game] Collected powerup: ${powerup.definition.nameCz}`);
          this.applyPowerupEffect(powerup.type, true);
          // Play sound effect
          this.audioManager.playCatchSound(this.player!.getPosition());
        },
        onExpire: (powerup) => {
          console.log(`[Game] Powerup expired: ${powerup.definition.nameCz}`);
          this.applyPowerupEffect(powerup.type, false);
        },
        onSpawn: (_position) => {
          console.log('[Game] New powerup spawned');
        },
      });

      this.updateLoadingProgress(100, 'Ready!');
      await new Promise((resolve) => setTimeout(resolve, 500));

      this.hideLoadingOverlay();

      // Reset game timer for new game
      this.hud.resetGameTimer();
      this.isVictory = false;

      const instructionsEl = document.getElementById('instructions');
      if (instructionsEl) {
        instructionsEl.style.display = 'block';
      }

      console.log(`[Game] ${this.selectedLevel.name} loaded successfully!`);
      console.log('[Game] Spawn position:', spawn);

    } catch (error) {
      console.error('[Game] Failed to load:', error);
      this.updateLoadingProgress(100, 'Error - using fallback');
      await new Promise((resolve) => setTimeout(resolve, 1000));
      this.hideLoadingOverlay();
    }
  }

  /**
   * Show victory screen when all employees are caught
   */
  private showVictoryScreen(): void {
    this.isVictory = true;

    // Stop game timer and get elapsed time
    this.hud.stopGameTimer();
    const elapsedMs = this.hud.getGameTimerElapsedMs();

    // Hide HUD during victory
    this.hud.setActive(false);

    // Check if this is a leaderboard-eligible level (Cartoon City)
    const isCartoonLevel = this.selectedLevel?.id === 'cartoon-city';

    if (isCartoonLevel) {
      // Show new victory screen with leaderboard option
      this.victoryScreen.show(elapsedMs);
    } else {
      // Show simple victory screen for other levels
      this.showSimpleVictoryScreen();
    }

    // Exit pointer lock
    document.exitPointerLock();
  }

  /**
   * Show simple victory screen (no leaderboard)
   */
  private showSimpleVictoryScreen(): void {
    const victory = document.createElement('div');
    victory.id = 'victory';
    victory.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 100, 0, 0.9);
        color: white;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        font-family: 'Segoe UI', sans-serif;
        z-index: 3000;
      ">
        <h1 style="margin: 0 0 20px 0; color: #FFD700; font-size: 72px;">VICTORY!</h1>
        <p style="margin: 0 0 10px 0; font-size: 24px;">All employees have been recruited!</p>
        <p style="margin: 0 0 20px 0; font-size: 18px; opacity: 0.8;">Jirka's team is complete.</p>
        <div style="display: flex; gap: 15px; margin-top: 20px;">
          <button id="btn-play-again" style="
            padding: 15px 30px;
            font-size: 16px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            background: linear-gradient(135deg, #FFD700, #FFA500);
            color: #000;
            font-weight: 600;
          ">Play Again</button>
          <button id="btn-menu" style="
            padding: 15px 30px;
            font-size: 16px;
            border: 1px solid rgba(255,255,255,0.3);
            border-radius: 8px;
            cursor: pointer;
            background: rgba(255,255,255,0.1);
            color: white;
            font-weight: 600;
          ">Main Menu</button>
        </div>
      </div>
    `;
    document.body.appendChild(victory);

    // Add event listeners
    const playAgainBtn = victory.querySelector('#btn-play-again');
    const menuBtn = victory.querySelector('#btn-menu');

    playAgainBtn?.addEventListener('click', () => {
      victory.remove();
      this.restartGame();
    });

    menuBtn?.addEventListener('click', () => {
      victory.remove();
      this.returnToMenu();
    });
  }

  /**
   * Show leaderboard screen
   */
  private showLeaderboard(): void {
    this.leaderboardScreen.show();
  }

  /**
   * Restart the current game
   */
  private restartGame(): void {
    // For now, reload the page - proper implementation would reset game state
    window.location.reload();
  }

  /**
   * Return to main menu
   */
  private returnToMenu(): void {
    // For now, reload the page - proper implementation would reset to menu
    window.location.reload();
  }

  /**
   * Apply or remove powerup effect
   */
  private applyPowerupEffect(type: PowerupType, enabled: boolean): void {
    if (!this.player || !this.netLauncher || !this.employeeManager) return;

    switch (type) {
      case PowerupType.SPEED_BOOST:
        this.player.setSpeedMultiplier(enabled ? 3.0 : 1.0);
        break;

      case PowerupType.SIZE_UP:
        this.player.setSizeMultiplier(enabled ? 4.0 : 1.0);
        break;

      case PowerupType.SIZE_DOWN:
        this.player.setSizeMultiplier(enabled ? 0.25 : 1.0);
        break;

      case PowerupType.SUPER_NET:
        // +100% radius = 2x multiplier
        this.netLauncher.setCatchRadiusMultiplier(enabled ? 2.0 : 1.0);
        break;

      case PowerupType.XRAY_VISION:
        this.employeeManager.setXRayVision(enabled);
        break;

      case PowerupType.DRUNK:
        this.player.setDrunkIntensity(enabled ? 1.0 : 0);
        break;

      case PowerupType.BLUR:
        this.screenEffects.setBlur(enabled ? 1.0 : 0);
        break;
    }
  }

  /**
   * Get player's Y rotation for minimap
   */
  private getPlayerRotation(): number {
    // Extract Y rotation from camera quaternion
    const euler = new THREE.Euler();
    euler.setFromQuaternion(this.camera.quaternion, 'YXZ');
    return euler.y;
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);

    const currentTime = performance.now();
    const deltaTime = (currentTime - this.previousTime) / 1000;
    this.previousTime = currentTime;

    // Only update game when not in menu and not loading
    if (!this.isInMenu && !this.isLoading) {
      // Update player
      if (this.player) {
        this.player.update(deltaTime);
        // Update audio listener position for spatial audio
        this.audioManager.updateListenerPosition(this.player.getPosition());

        // Update footstep sounds based on player movement
        this.audioManager.updateFootsteps(deltaTime, {
          isMoving: this.player.isMoving(),
          isSprinting: this.player.isSprinting(),
        });
      }

      // Handle net firing
      if (this.netLauncher && this.player && this.inputManager.isLocked()) {
        const input = this.inputManager.getState();
        if (input.fire && this.netLauncher.canFire()) {
          const pos = this.player.getPosition();
          const dir = this.player.getLookDirection();
          // Offset spawn position slightly forward
          const spawnPos = pos.clone().add(dir.clone().multiplyScalar(1));
          spawnPos.y -= 0.3; // Lower to hand height
          this.netLauncher.fire(spawnPos, dir);
          // Play net throw sound
          this.audioManager.playNetThrowSound();
          // Notify HUD of fire
          this.hud.onFire();
        }
      }

      // Update employees
      if (this.employeeManager && this.player) {
        this.employeeManager.update(deltaTime, this.player.getPosition());

        // Update dynamic music intensity based on nearby fleeing employees
        const fleeingCount = this.employeeManager.getFleeingCountNearby(
          this.player.getPosition(),
          MUSIC_CONFIG.intensityThresholds.detectionRadius
        );
        this.audioManager.updateMusicIntensity(fleeingCount);

        // Update player idle voice timer
        this.idleVoiceTimer += deltaTime;
        const randomInterval = this.idleVoiceInterval + Math.random() * 10; // 15-25 seconds
        if (this.idleVoiceTimer >= randomInterval) {
          this.idleVoiceTimer = 0;
          // Only play if there are still employees to catch
          if (this.employeeManager.getCaughtCount() < this.employeeManager.getTotalCount()) {
            this.audioManager.playPlayerIdleSound();
          }
        }
      }

      // Update city (car animations)
      if (this.city) {
        this.city.update(deltaTime);
      }

      // Update day/night cycle
      if (this.dayNightCycle) {
        this.dayNightCycle.update(deltaTime);
      }

      // Update powerup system
      if (this.powerupManager && this.player) {
        this.powerupManager.update(deltaTime, this.player.getPosition());
        // Update HUD powerup indicator
        this.hud.updatePowerup(this.powerupManager.getActivePowerup());
      }

      // Update net launcher with employee positions
      if (this.netLauncher && this.employeeManager) {
        const employeePositions = this.employeeManager.getActivePositions();
        this.netLauncher.update(deltaTime, employeePositions);
      }

      // Update audio manager (music volume interpolation)
      this.audioManager.update(deltaTime);

      // Update HUD with current game state
      if (this.player && this.employeeManager && this.netLauncher) {
        const hudData = createHUDData(
          this.player.getPosition(),
          this.getPlayerRotation(),
          this.employeeManager.getCaughtCount(),
          this.employeeManager.getTotalCount(),
          this.netLauncher.getCooldownProgress(),
          {
            isSprinting: this.player.isSprinting(),
            sprintProgress: this.player.getSprintProgress(),
            cooldownProgress: this.player.getSprintCooldownProgress(),
            canSprint: this.player.canSprint(),
          },
          this.employeeManager.getActivePositions(),
          this.caughtEmployeeIds
        );
        this.hud.update(hudData, deltaTime);
      }
    }

    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  };
}

// Start the game
const game = new Game();
game.start().catch(console.error);
