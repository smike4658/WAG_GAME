/**
 * Day/Night Cycle System
 * Controls lighting, sky color, sun/moon position, and time-based events
 */

import * as THREE from 'three';

/**
 * Time of day phases
 */
export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';

/**
 * Day/Night cycle configuration
 */
export interface DayNightConfig {
  /** Duration of full day (dawn + day + dusk) in seconds */
  dayDuration: number;
  /** Duration of night in seconds */
  nightDuration: number;
  /** Dawn/dusk transition duration as fraction of day (0-0.5) */
  transitionFraction: number;
}

/**
 * Lighting preset for each time phase
 */
interface LightingPreset {
  skyColor: THREE.Color;
  fogColor: THREE.Color;
  fogNear: number;
  fogFar: number;
  ambientIntensity: number;
  ambientColor: THREE.Color;
  sunIntensity: number;
  sunColor: THREE.Color;
  sunPosition: THREE.Vector3;
}

/**
 * Callbacks for time-based events
 */
interface DayNightCallbacks {
  onDawn?: () => void;
  onDay?: () => void;
  onDusk?: () => void;
  onNight?: () => void;
  onTimeChange?: (timeOfDay: TimeOfDay, progress: number) => void;
}

const DEFAULT_CONFIG: DayNightConfig = {
  dayDuration: 60,      // 60 seconds of day
  nightDuration: 15,    // 15 seconds of night
  transitionFraction: 0.15, // 15% of day for dawn/dusk each
};

/**
 * Lighting presets for different times of day
 */
const LIGHTING_PRESETS: Record<TimeOfDay, LightingPreset> = {
  dawn: {
    skyColor: new THREE.Color(0xFFB347),      // Orange-pink
    fogColor: new THREE.Color(0xFFCCAA),
    fogNear: 100,
    fogFar: 400,
    ambientIntensity: 0.4,
    ambientColor: new THREE.Color(0xFFDDAA),
    sunIntensity: 0.6,
    sunColor: new THREE.Color(0xFFAA55),
    sunPosition: new THREE.Vector3(200, 30, 0),
  },
  day: {
    skyColor: new THREE.Color(0x87CEEB),      // Clear blue
    fogColor: new THREE.Color(0xc0d8e8),
    fogNear: 150,
    fogFar: 500,
    ambientIntensity: 0.6,
    ambientColor: new THREE.Color(0xffffff),
    sunIntensity: 1.2,
    sunColor: new THREE.Color(0xfffaf0),
    sunPosition: new THREE.Vector3(100, 150, 100),
  },
  dusk: {
    skyColor: new THREE.Color(0xFF6B6B),      // Red-orange
    fogColor: new THREE.Color(0xDDA0A0),
    fogNear: 100,
    fogFar: 400,
    ambientIntensity: 0.35,
    ambientColor: new THREE.Color(0xFFAAAA),
    sunIntensity: 0.5,
    sunColor: new THREE.Color(0xFF6644),
    sunPosition: new THREE.Vector3(-200, 30, 0),
  },
  night: {
    skyColor: new THREE.Color(0x0a0a20),      // Dark blue
    fogColor: new THREE.Color(0x1a1a3a),
    fogNear: 50,
    fogFar: 250,
    ambientIntensity: 0.15,
    ambientColor: new THREE.Color(0x4444AA),
    sunIntensity: 0.3,
    sunColor: new THREE.Color(0xAAAAFF),      // Moonlight
    sunPosition: new THREE.Vector3(0, 120, -100),
  },
};

/**
 * DayNightCycle - manages time-based lighting and sky
 */
export class DayNightCycle {
  private readonly scene: THREE.Scene;
  private readonly config: DayNightConfig;

  // Lights
  private ambientLight: THREE.AmbientLight | null = null;
  private sunLight: THREE.DirectionalLight | null = null;
  private hemisphereLight: THREE.HemisphereLight | null = null;

  // Celestial bodies
  private readonly celestialGroup: THREE.Group;
  private readonly sunMesh: THREE.Mesh;
  private readonly moonMesh: THREE.Mesh;
  private readonly starField: THREE.Points;

  // Time tracking
  private currentTime = 0;        // 0 = start of dawn
  private readonly totalCycleDuration: number;
  private currentPhase: TimeOfDay = 'day';
  private previousPhase: TimeOfDay = 'day';

  // Callbacks
  private callbacks: DayNightCallbacks = {};

  // Paused state
  private paused = false;

  constructor(scene: THREE.Scene, config: Partial<DayNightConfig> = {}) {
    this.scene = scene;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.totalCycleDuration = this.config.dayDuration + this.config.nightDuration;

    // Create celestial objects group
    this.celestialGroup = new THREE.Group();
    this.celestialGroup.name = 'celestial_bodies';

    // Create sun
    this.sunMesh = this.createSun();
    this.celestialGroup.add(this.sunMesh);

    // Create moon
    this.moonMesh = this.createMoon();
    this.celestialGroup.add(this.moonMesh);

    // Create stars
    this.starField = this.createStarField();
    this.celestialGroup.add(this.starField);

    this.scene.add(this.celestialGroup);

    // Find existing lights or create new ones
    this.findOrCreateLights();

    // Start at midday
    this.setTimeOfDay(0.25); // 25% through cycle = midday

    console.log('[DayNightCycle] Initialized with day:', this.config.dayDuration, 's, night:', this.config.nightDuration, 's');
  }

  /**
   * Create the sun visual
   */
  private createSun(): THREE.Mesh {
    const sunGeometry = new THREE.SphereGeometry(15, 32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({
      color: 0xFFFF00,
      transparent: true,
      opacity: 1,
    });
    const sun = new THREE.Mesh(sunGeometry, sunMaterial);
    sun.name = 'sun';

    // Add glow effect
    const glowGeometry = new THREE.SphereGeometry(25, 32, 32);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xFFAA00,
      transparent: true,
      opacity: 0.3,
      side: THREE.BackSide,
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    sun.add(glow);

    return sun;
  }

  /**
   * Create the moon visual
   */
  private createMoon(): THREE.Mesh {
    const moonGeometry = new THREE.SphereGeometry(12, 32, 32);
    const moonMaterial = new THREE.MeshBasicMaterial({
      color: 0xEEEEFF,
      transparent: true,
      opacity: 1,
    });
    const moon = new THREE.Mesh(moonGeometry, moonMaterial);
    moon.name = 'moon';

    // Add subtle glow
    const glowGeometry = new THREE.SphereGeometry(18, 32, 32);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x8888FF,
      transparent: true,
      opacity: 0.2,
      side: THREE.BackSide,
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    moon.add(glow);

    return moon;
  }

  /**
   * Create star field for night sky
   */
  private createStarField(): THREE.Points {
    const starCount = 2000;
    const positions = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
      // Distribute stars on a large sphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 800;

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = Math.abs(radius * Math.cos(phi)); // Only upper hemisphere
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

      sizes[i] = Math.random() * 2 + 0.5;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
      color: 0xFFFFFF,
      size: 1.5,
      transparent: true,
      opacity: 0,
      sizeAttenuation: false,
    });

    const stars = new THREE.Points(geometry, material);
    stars.name = 'stars';

    return stars;
  }

  /**
   * Find existing lights in scene or create new ones
   */
  private findOrCreateLights(): void {
    this.scene.traverse((child) => {
      if (child instanceof THREE.AmbientLight && !this.ambientLight) {
        this.ambientLight = child;
      }
      if (child instanceof THREE.DirectionalLight && !this.sunLight) {
        this.sunLight = child;
      }
      if (child instanceof THREE.HemisphereLight && !this.hemisphereLight) {
        this.hemisphereLight = child;
      }
    });

    // Create lights if not found
    if (!this.ambientLight) {
      this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      this.scene.add(this.ambientLight);
    }

    if (!this.sunLight) {
      this.sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
      this.sunLight.castShadow = true;
      this.scene.add(this.sunLight);
    }

    if (!this.hemisphereLight) {
      this.hemisphereLight = new THREE.HemisphereLight(0x87CEEB, 0x556B2F, 0.5);
      this.scene.add(this.hemisphereLight);
    }
  }

  /**
   * Set callbacks for time events
   */
  public setCallbacks(callbacks: DayNightCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Update the cycle
   */
  public update(deltaTime: number): void {
    if (this.paused) return;

    // Advance time
    this.currentTime += deltaTime;
    if (this.currentTime >= this.totalCycleDuration) {
      this.currentTime -= this.totalCycleDuration;
    }

    // Calculate current phase
    this.updatePhase();

    // Apply lighting based on current time
    this.applyLighting();

    // Update celestial positions
    this.updateCelestialBodies();

    // Trigger callbacks
    if (this.currentPhase !== this.previousPhase) {
      this.triggerPhaseCallback();
      this.previousPhase = this.currentPhase;
    }

    // Always trigger time change callback
    if (this.callbacks.onTimeChange) {
      this.callbacks.onTimeChange(this.currentPhase, this.getPhaseProgress());
    }
  }

  /**
   * Determine current phase based on time
   */
  private updatePhase(): void {
    const dayDuration = this.config.dayDuration;
    const transitionTime = dayDuration * this.config.transitionFraction;

    if (this.currentTime < transitionTime) {
      // Dawn
      this.currentPhase = 'dawn';
    } else if (this.currentTime < dayDuration - transitionTime) {
      // Day
      this.currentPhase = 'day';
    } else if (this.currentTime < dayDuration) {
      // Dusk
      this.currentPhase = 'dusk';
    } else {
      // Night
      this.currentPhase = 'night';
    }
  }

  /**
   * Get progress within current phase (0-1)
   */
  private getPhaseProgress(): number {
    const dayDuration = this.config.dayDuration;
    const nightDuration = this.config.nightDuration;
    const transitionTime = dayDuration * this.config.transitionFraction;

    switch (this.currentPhase) {
      case 'dawn':
        return this.currentTime / transitionTime;
      case 'day':
        return (this.currentTime - transitionTime) / (dayDuration - 2 * transitionTime);
      case 'dusk':
        return (this.currentTime - (dayDuration - transitionTime)) / transitionTime;
      case 'night':
        return (this.currentTime - dayDuration) / nightDuration;
      default:
        return 0;
    }
  }

  /**
   * Apply lighting based on current time
   */
  private applyLighting(): void {
    const dayDuration = this.config.dayDuration;
    const transitionTime = dayDuration * this.config.transitionFraction;

    let fromPreset: LightingPreset;
    let toPreset: LightingPreset;
    let t: number;

    // Determine transition
    if (this.currentPhase === 'dawn') {
      fromPreset = LIGHTING_PRESETS.night;
      toPreset = LIGHTING_PRESETS.day;
      t = this.currentTime / transitionTime;
    } else if (this.currentPhase === 'day') {
      fromPreset = LIGHTING_PRESETS.day;
      toPreset = LIGHTING_PRESETS.day;
      t = 0;
    } else if (this.currentPhase === 'dusk') {
      fromPreset = LIGHTING_PRESETS.day;
      toPreset = LIGHTING_PRESETS.night;
      t = (this.currentTime - (dayDuration - transitionTime)) / transitionTime;
    } else {
      fromPreset = LIGHTING_PRESETS.night;
      toPreset = LIGHTING_PRESETS.night;
      t = 0;
    }

    // Smooth easing
    t = this.smoothstep(t);

    // Interpolate colors
    const skyColor = new THREE.Color().lerpColors(fromPreset.skyColor, toPreset.skyColor, t);
    const fogColor = new THREE.Color().lerpColors(fromPreset.fogColor, toPreset.fogColor, t);
    const ambientColor = new THREE.Color().lerpColors(fromPreset.ambientColor, toPreset.ambientColor, t);
    const sunColor = new THREE.Color().lerpColors(fromPreset.sunColor, toPreset.sunColor, t);

    // Interpolate values
    const ambientIntensity = THREE.MathUtils.lerp(fromPreset.ambientIntensity, toPreset.ambientIntensity, t);
    const sunIntensity = THREE.MathUtils.lerp(fromPreset.sunIntensity, toPreset.sunIntensity, t);
    const fogNear = THREE.MathUtils.lerp(fromPreset.fogNear, toPreset.fogNear, t);
    const fogFar = THREE.MathUtils.lerp(fromPreset.fogFar, toPreset.fogFar, t);

    // Apply to scene
    this.scene.background = skyColor;

    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color = fogColor;
      this.scene.fog.near = fogNear;
      this.scene.fog.far = fogFar;
    }

    // Apply to lights
    if (this.ambientLight) {
      this.ambientLight.color = ambientColor;
      this.ambientLight.intensity = ambientIntensity;
    }

    if (this.sunLight) {
      this.sunLight.color = sunColor;
      this.sunLight.intensity = sunIntensity;
    }

    if (this.hemisphereLight) {
      this.hemisphereLight.color = skyColor;
      this.hemisphereLight.groundColor = new THREE.Color(0x2a2a1a);
      this.hemisphereLight.intensity = ambientIntensity * 0.8;
    }

    // Update stars visibility
    const starMaterial = this.starField.material as THREE.PointsMaterial;
    if (this.currentPhase === 'night') {
      starMaterial.opacity = Math.min(1, this.getPhaseProgress() * 2);
    } else if (this.currentPhase === 'dawn') {
      starMaterial.opacity = Math.max(0, 1 - this.getPhaseProgress() * 2);
    } else if (this.currentPhase === 'dusk') {
      starMaterial.opacity = Math.min(0.5, this.getPhaseProgress());
    } else {
      starMaterial.opacity = 0;
    }
  }

  /**
   * Update sun and moon positions
   */
  private updateCelestialBodies(): void {
    // Calculate sun position based on time (full arc)
    const cycleProgress = this.currentTime / this.totalCycleDuration;
    const sunAngle = cycleProgress * Math.PI * 2 - Math.PI / 2; // Start at horizon

    const orbitRadius = 600;
    const sunX = Math.cos(sunAngle) * orbitRadius;
    const sunY = Math.sin(sunAngle) * orbitRadius;

    this.sunMesh.position.set(sunX, sunY, 0);

    // Moon is opposite to sun
    this.moonMesh.position.set(-sunX, -sunY, 0);

    // Update sun/moon visibility based on height
    const sunMaterial = this.sunMesh.material as THREE.MeshBasicMaterial;
    const moonMaterial = this.moonMesh.material as THREE.MeshBasicMaterial;

    // Sun visible when above horizon
    sunMaterial.opacity = THREE.MathUtils.clamp(sunY / 100 + 0.5, 0, 1);

    // Moon visible when sun is below
    moonMaterial.opacity = THREE.MathUtils.clamp(-sunY / 100 + 0.5, 0, 1);

    // Update directional light position to match sun/moon
    if (this.sunLight) {
      if (sunY > 0) {
        // Daytime - light follows sun
        this.sunLight.position.set(sunX * 0.3, Math.max(50, sunY * 0.5), 100);
      } else {
        // Nighttime - light is moonlight
        this.sunLight.position.set(-sunX * 0.3, Math.max(50, -sunY * 0.3), -100);
      }
    }
  }

  /**
   * Smoothstep interpolation
   */
  private smoothstep(t: number): number {
    t = Math.max(0, Math.min(1, t));
    return t * t * (3 - 2 * t);
  }

  /**
   * Trigger phase change callback
   */
  private triggerPhaseCallback(): void {
    console.log(`[DayNightCycle] Phase changed to: ${this.currentPhase}`);

    switch (this.currentPhase) {
      case 'dawn':
        this.callbacks.onDawn?.();
        break;
      case 'day':
        this.callbacks.onDay?.();
        break;
      case 'dusk':
        this.callbacks.onDusk?.();
        break;
      case 'night':
        this.callbacks.onNight?.();
        break;
    }
  }

  /**
   * Get current time of day
   */
  public getTimeOfDay(): TimeOfDay {
    return this.currentPhase;
  }

  /**
   * Check if it's night
   */
  public isNight(): boolean {
    return this.currentPhase === 'night';
  }

  /**
   * Check if it's day (including dawn/dusk)
   */
  public isDay(): boolean {
    return this.currentPhase !== 'night';
  }

  /**
   * Get current time as 0-1 fraction of full cycle
   */
  public getCycleProgress(): number {
    return this.currentTime / this.totalCycleDuration;
  }

  /**
   * Get current time in 24h format (0-24)
   */
  public getTime24h(): number {
    // Map cycle to 24h (dawn starts at 6:00)
    const cycleProgress = this.getCycleProgress();
    let hour = 6 + cycleProgress * 24;
    if (hour >= 24) hour -= 24;
    return hour;
  }

  /**
   * Get formatted time string (HH:MM)
   */
  public getTimeString(): string {
    const time24h = this.getTime24h();
    const hours = Math.floor(time24h);
    const minutes = Math.floor((time24h % 1) * 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  /**
   * Set time of day directly (0-1, where 0 = dawn start)
   */
  public setTimeOfDay(progress: number): void {
    this.currentTime = progress * this.totalCycleDuration;
    this.updatePhase();
    this.applyLighting();
    this.updateCelestialBodies();
  }

  /**
   * Skip to specific phase
   */
  public skipToPhase(phase: TimeOfDay): void {
    const dayDuration = this.config.dayDuration;
    const transitionTime = dayDuration * this.config.transitionFraction;

    switch (phase) {
      case 'dawn':
        this.currentTime = 0;
        break;
      case 'day':
        this.currentTime = transitionTime;
        break;
      case 'dusk':
        this.currentTime = dayDuration - transitionTime;
        break;
      case 'night':
        this.currentTime = dayDuration;
        break;
    }

    this.updatePhase();
    this.applyLighting();
    this.updateCelestialBodies();
  }

  /**
   * Pause the cycle
   */
  public pause(): void {
    this.paused = true;
  }

  /**
   * Resume the cycle
   */
  public resume(): void {
    this.paused = false;
  }

  /**
   * Check if paused
   */
  public isPaused(): boolean {
    return this.paused;
  }

  /**
   * Get remaining time in current phase
   */
  public getRemainingPhaseTime(): number {
    const dayDuration = this.config.dayDuration;
    const nightDuration = this.config.nightDuration;
    const transitionTime = dayDuration * this.config.transitionFraction;

    switch (this.currentPhase) {
      case 'dawn':
        return transitionTime - this.currentTime;
      case 'day':
        return (dayDuration - transitionTime) - this.currentTime;
      case 'dusk':
        return dayDuration - this.currentTime;
      case 'night':
        return (dayDuration + nightDuration) - this.currentTime;
      default:
        return 0;
    }
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.scene.remove(this.celestialGroup);

    // Dispose geometries and materials
    this.sunMesh.geometry.dispose();
    (this.sunMesh.material as THREE.Material).dispose();

    this.moonMesh.geometry.dispose();
    (this.moonMesh.material as THREE.Material).dispose();

    this.starField.geometry.dispose();
    (this.starField.material as THREE.Material).dispose();
  }
}
