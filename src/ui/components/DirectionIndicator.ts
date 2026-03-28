import * as THREE from 'three';

/**
 * DirectionIndicator - Edge-of-screen arrow pointing to nearest uncaught employee
 * Shows distance, pulses faster when closer
 */
export class DirectionIndicator {
  private readonly container: HTMLDivElement;
  private readonly arrow: HTMLDivElement;
  private readonly distLabel: HTMLDivElement;

  private readonly camera: THREE.PerspectiveCamera;
  private visible = false;

  // Reusable
  private readonly _tmpVec = new THREE.Vector3();
  private readonly _tmpVec2 = new THREE.Vector3();

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;

    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 150;
      display: none;
      transition: opacity 0.3s ease;
    `;

    this.arrow = document.createElement('div');
    this.arrow.style.cssText = `
      width: 0; height: 0;
      border-left: 12px solid transparent;
      border-right: 12px solid transparent;
      border-bottom: 20px solid #FFD700;
      filter: drop-shadow(0 0 6px rgba(255, 215, 0, 0.6));
    `;
    this.container.appendChild(this.arrow);

    this.distLabel = document.createElement('div');
    this.distLabel.style.cssText = `
      color: #FFD700;
      font-size: 13px;
      font-weight: 700;
      font-family: 'Segoe UI', sans-serif;
      text-shadow: 0 1px 4px rgba(0,0,0,0.9);
      text-align: center;
      margin-top: 4px;
    `;
    this.container.appendChild(this.distLabel);

    document.body.appendChild(this.container);
  }

  /**
   * Update indicator position/visibility
   * @param employeePositions - Map of active employee positions
   * @param playerPos - Player world position
   */
  public update(employeePositions: Map<string, THREE.Vector3>, playerPos: THREE.Vector3): void {
    if (employeePositions.size === 0) {
      this.hide();
      return;
    }

    // Find nearest employee
    let nearestDist = Infinity;
    let nearestPos: THREE.Vector3 | null = null;

    for (const pos of employeePositions.values()) {
      const dist = playerPos.distanceTo(pos);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestPos = pos;
      }
    }

    if (!nearestPos) {
      this.hide();
      return;
    }

    // Project to screen to check if visible in viewport
    this._tmpVec.copy(nearestPos);
    this._tmpVec.y += 1; // Aim at torso
    this._tmpVec.project(this.camera);

    const isOnScreen = (
      this._tmpVec.z < 1 &&
      this._tmpVec.x > -0.8 && this._tmpVec.x < 0.8 &&
      this._tmpVec.y > -0.8 && this._tmpVec.y < 0.8
    );

    // Hide when target is clearly visible on screen
    if (isOnScreen && nearestDist < 50) {
      this.hide();
      return;
    }

    this.show();

    // Calculate screen-space direction from center to target
    // Use camera forward and right to get 2D angle
    const cameraDir = this._tmpVec2;
    this.camera.getWorldDirection(cameraDir);

    const toTarget = this._tmpVec.copy(nearestPos).sub(playerPos);
    toTarget.y = 0;
    toTarget.normalize();

    cameraDir.y = 0;
    cameraDir.normalize();

    // Angle between camera forward and target direction
    const cross = cameraDir.x * toTarget.z - cameraDir.z * toTarget.x;
    const dot = cameraDir.x * toTarget.x + cameraDir.z * toTarget.z;
    const angle = Math.atan2(cross, dot);

    // Position arrow on screen edge (elliptical path)
    const marginX = 60;
    const marginY = 60;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const radiusX = centerX - marginX;
    const radiusY = centerY - marginY;

    const x = centerX + Math.sin(angle) * radiusX;
    const y = centerY - Math.cos(angle) * radiusY;

    // Clamp to screen
    const clampedX = Math.max(marginX, Math.min(x, window.innerWidth - marginX));
    const clampedY = Math.max(marginY, Math.min(y, window.innerHeight - marginY));

    this.container.style.left = `${clampedX}px`;
    this.container.style.top = `${clampedY}px`;
    this.container.style.transform = `translate(-50%, -50%) rotate(${-angle}rad)`;

    // Distance label (counter-rotate so text stays upright)
    this.distLabel.style.transform = `rotate(${angle}rad)`;
    this.distLabel.textContent = `${Math.round(nearestDist)}m`;

    // Pulse speed based on proximity (closer = faster pulse)
    const pulseSpeed = nearestDist < 15 ? 8 : nearestDist < 30 ? 4 : 2;
    const pulse = 0.7 + Math.sin(performance.now() / 1000 * pulseSpeed) * 0.3;
    this.arrow.style.opacity = String(pulse);
  }

  private show(): void {
    if (!this.visible) {
      this.visible = true;
      this.container.style.display = 'block';
    }
  }

  private hide(): void {
    if (this.visible) {
      this.visible = false;
      this.container.style.display = 'none';
    }
  }

  public dispose(): void {
    this.container.remove();
  }
}
