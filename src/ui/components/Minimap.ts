/**
 * Minimap Component
 * Radar-style circular minimap that rotates with player direction
 * Shows employees, caught targets, and player position
 */

import * as THREE from 'three';
import { type HUDStyleConfig, DEFAULT_HUD_STYLE, HUD_POSITIONS, type MinimapEntity } from '../HUDConfig';

export class Minimap {
  private readonly container: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly style: HUDStyleConfig;

  private readonly size: number;
  private radius: number;
  private readonly halfSize: number;

  // Player state
  private playerPosition: THREE.Vector3 = new THREE.Vector3();
  private playerRotation = 0;

  // Entities to display
  private entities: MinimapEntity[] = [];

  // Animation
  private scanAngle = 0;
  private readonly scanSpeed = 2; // Radians per second

  constructor(style: Partial<HUDStyleConfig> = {}) {
    this.style = { ...DEFAULT_HUD_STYLE, ...style };
    this.size = this.style.minimapSize;
    this.radius = this.style.minimapRadius;
    this.halfSize = this.size / 2;

    // Create container
    this.container = document.createElement('div');
    this.container.id = 'hud-minimap';
    this.container.style.cssText = `
      position: fixed;
      bottom: ${HUD_POSITIONS.minimap.bottom}px;
      right: ${HUD_POSITIONS.minimap.right}px;
      width: ${this.size}px;
      height: ${this.size}px;
      z-index: 100;
      pointer-events: none;
      user-select: none;
    `;

    // Create canvas
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.size * 2; // 2x for retina
    this.canvas.height = this.size * 2;
    this.canvas.style.cssText = `
      width: ${this.size}px;
      height: ${this.size}px;
      border-radius: 50%;
      box-shadow: 0 0 20px rgba(0, 0, 0, 0.5), inset 0 0 30px rgba(0, 0, 0, 0.3);
      border: 3px solid rgba(255, 215, 0, 0.4);
    `;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get 2D context for minimap');
    }
    this.ctx = ctx;
    this.ctx.scale(2, 2); // Scale for retina

    this.container.appendChild(this.canvas);
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
   * Update minimap with new data
   */
  public update(
    playerPosition: THREE.Vector3,
    playerRotation: number,
    entities: MinimapEntity[],
    deltaTime: number
  ): void {
    this.playerPosition.copy(playerPosition);
    this.playerRotation = playerRotation;
    this.entities = entities;

    // Update scan animation
    this.scanAngle += this.scanSpeed * deltaTime;
    if (this.scanAngle > Math.PI * 2) {
      this.scanAngle -= Math.PI * 2;
    }

    this.render();
  }

  /**
   * Render the minimap
   */
  private render(): void {
    const ctx = this.ctx;
    const center = this.halfSize;

    // Clear canvas
    ctx.clearRect(0, 0, this.size, this.size);

    // Draw background with gradient
    this.drawBackground(center);

    // Draw grid lines
    this.drawGrid(center);

    // Draw radar sweep effect
    this.drawRadarSweep(center);

    // Draw entities (rotated to match player view)
    this.drawEntities(center);

    // Draw player indicator (always center)
    this.drawPlayer(center);

    // Draw compass directions
    this.drawCompass(center);

    // Draw border ring
    this.drawBorder(center);
  }

  /**
   * Draw dark background with radial gradient
   */
  private drawBackground(center: number): void {
    const ctx = this.ctx;

    // Clip to circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, center - 2, 0, Math.PI * 2);
    ctx.clip();

    // Radial gradient background
    const gradient = ctx.createRadialGradient(
      center, center, 0,
      center, center, center
    );
    gradient.addColorStop(0, 'rgba(20, 30, 40, 0.95)');
    gradient.addColorStop(0.7, 'rgba(10, 20, 30, 0.95)');
    gradient.addColorStop(1, 'rgba(5, 10, 15, 0.98)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.size, this.size);

    ctx.restore();
  }

  /**
   * Draw concentric grid circles and cross lines
   */
  private drawGrid(center: number): void {
    const ctx = this.ctx;

    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, center - 2, 0, Math.PI * 2);
    ctx.clip();

    ctx.strokeStyle = 'rgba(100, 150, 100, 0.2)';
    ctx.lineWidth = 1;

    // Concentric circles (distance indicators)
    const rings = 3;
    for (let i = 1; i <= rings; i++) {
      const ringRadius = (center - 5) * (i / rings);
      ctx.beginPath();
      ctx.arc(center, center, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Cross lines (rotated with player)
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(this.playerRotation);

    ctx.beginPath();
    // Vertical line (forward/back)
    ctx.moveTo(0, -(center - 5));
    ctx.lineTo(0, center - 5);
    // Horizontal line (left/right)
    ctx.moveTo(-(center - 5), 0);
    ctx.lineTo(center - 5, 0);
    ctx.stroke();

    ctx.restore();
    ctx.restore();
  }

  /**
   * Draw animated radar sweep effect
   */
  private drawRadarSweep(center: number): void {
    const ctx = this.ctx;

    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, center - 2, 0, Math.PI * 2);
    ctx.clip();

    // Create sweep gradient
    const sweepAngle = this.scanAngle + this.playerRotation;
    const gradient = ctx.createConicGradient(sweepAngle, center, center);

    gradient.addColorStop(0, 'rgba(0, 255, 100, 0.15)');
    gradient.addColorStop(0.1, 'rgba(0, 255, 100, 0.05)');
    gradient.addColorStop(0.2, 'rgba(0, 255, 100, 0)');
    gradient.addColorStop(1, 'rgba(0, 255, 100, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.size, this.size);

    ctx.restore();
  }

  /**
   * Draw entities on minimap
   */
  private drawEntities(center: number): void {
    const scale = (center - 10) / this.radius;

    for (const entity of this.entities) {
      // Calculate relative position
      const relX = entity.position.x - this.playerPosition.x;
      const relZ = entity.position.z - this.playerPosition.z;

      // Rotate to match player view (map rotates, player stays up)
      const cos = Math.cos(this.playerRotation);
      const sin = Math.sin(this.playerRotation);
      const rotatedX = relX * cos - relZ * sin;
      const rotatedZ = relX * sin + relZ * cos;

      // Scale to minimap
      const mapX = center + rotatedX * scale;
      const mapY = center + rotatedZ * scale;

      // Check if within minimap bounds
      const distFromCenter = Math.sqrt(
        Math.pow(mapX - center, 2) + Math.pow(mapY - center, 2)
      );

      if (distFromCenter > center - 8) {
        // Entity is outside minimap radius - draw at edge
        const angle = Math.atan2(mapY - center, mapX - center);
        const edgeX = center + Math.cos(angle) * (center - 12);
        const edgeY = center + Math.sin(angle) * (center - 12);
        this.drawEntityDot(edgeX, edgeY, entity, true);
      } else {
        // Entity is within minimap
        this.drawEntityDot(mapX, mapY, entity, false);
      }
    }
  }

  /**
   * Draw a single entity dot
   */
  private drawEntityDot(x: number, y: number, entity: MinimapEntity, isEdge: boolean): void {
    const ctx = this.ctx;

    let color: string;
    let size: number;
    let pulse = false;

    switch (entity.type) {
      case 'employee':
        color = this.style.minimapEmployeeColor;
        size = isEdge ? 4 : 6;
        pulse = true;
        break;
      case 'caught':
        color = this.style.minimapCaughtColor;
        size = 4;
        break;
      case 'vehicle':
        color = '#4488FF';
        size = 3;
        break;
      case 'building':
        color = 'rgba(100, 100, 100, 0.5)';
        size = 8;
        break;
      default:
        color = '#FFFFFF';
        size = 4;
    }

    // Pulsing effect for active employees
    if (pulse) {
      const pulseScale = 1 + Math.sin(Date.now() * 0.005) * 0.2;
      size *= pulseScale;
    }

    // Glow effect
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;

    // Draw dot
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();

    // Reset shadow
    ctx.shadowBlur = 0;

    // Edge indicator (arrow pointing to entity)
    if (isEdge) {
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(x, y, size + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  /**
   * Draw player indicator at center
   */
  private drawPlayer(center: number): void {
    const ctx = this.ctx;

    // Player is always pointing up (forward direction)
    ctx.save();
    ctx.translate(center, center);

    // Glow
    ctx.shadowColor = this.style.minimapPlayerColor;
    ctx.shadowBlur = 10;

    // Draw triangle pointing up
    ctx.fillStyle = this.style.minimapPlayerColor;
    ctx.beginPath();
    ctx.moveTo(0, -10);  // Top point
    ctx.lineTo(-6, 6);   // Bottom left
    ctx.lineTo(6, 6);    // Bottom right
    ctx.closePath();
    ctx.fill();

    // Inner detail
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(-3, 3);
    ctx.lineTo(3, 3);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  /**
   * Draw compass directions (N, E, S, W)
   */
  private drawCompass(center: number): void {
    const ctx = this.ctx;
    const compassRadius = center - 15;

    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(this.playerRotation);

    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const directions: Array<{ label: string; angle: number; color: string }> = [
      { label: 'N', angle: -Math.PI / 2, color: '#FF4444' },
      { label: 'E', angle: 0, color: '#AAAAAA' },
      { label: 'S', angle: Math.PI / 2, color: '#AAAAAA' },
      { label: 'W', angle: Math.PI, color: '#AAAAAA' },
    ];

    for (const dir of directions) {
      const x = Math.cos(dir.angle) * compassRadius;
      const y = Math.sin(dir.angle) * compassRadius;

      ctx.fillStyle = dir.color;
      ctx.fillText(dir.label, x, y);
    }

    ctx.restore();
  }

  /**
   * Draw decorative border ring
   */
  private drawBorder(center: number): void {
    const ctx = this.ctx;

    // Outer ring
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(center, center, center - 1, 0, Math.PI * 2);
    ctx.stroke();

    // Inner decorative ring
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(center, center, center - 6, 0, Math.PI * 2);
    ctx.stroke();

    // Tick marks
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
    ctx.lineWidth = 2;

    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 + this.playerRotation;
      const innerR = center - 8;
      const outerR = center - 3;

      ctx.beginPath();
      ctx.moveTo(
        center + Math.cos(angle) * innerR,
        center + Math.sin(angle) * innerR
      );
      ctx.lineTo(
        center + Math.cos(angle) * outerR,
        center + Math.sin(angle) * outerR
      );
      ctx.stroke();
    }
  }

  /**
   * Show/hide the component
   */
  public setVisible(visible: boolean): void {
    this.container.style.display = visible ? 'block' : 'none';
  }

  /**
   * Check if visible
   */
  public isVisible(): boolean {
    return this.container.style.display !== 'none';
  }

  /**
   * Update minimap radius (zoom level)
   */
  public setRadius(newRadius: number): void {
    this.radius = Math.max(20, Math.min(200, newRadius));
  }

  /**
   * Get current radius
   */
  public getRadius(): number {
    return this.radius;
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.unmount();
  }
}
