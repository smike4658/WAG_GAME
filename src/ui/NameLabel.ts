import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

/**
 * NameLabel - Creates a floating name and role label above NPCs
 * Uses CSS2DRenderer for crisp HTML text rendering
 */
export class NameLabel {
  private readonly label: CSS2DObject;
  private readonly element: HTMLDivElement;

  constructor(name: string, role: string) {
    // Create label container
    this.element = document.createElement('div');
    this.element.className = 'employee-label';
    this.element.style.cssText = `
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      text-align: center;
      pointer-events: none;
      user-select: none;
      transform: translateY(-100%);
    `;

    // Create name element
    const nameEl = document.createElement('div');
    nameEl.textContent = name;
    nameEl.style.cssText = `
      font-size: 14px;
      font-weight: bold;
      color: #ffffff;
      text-shadow:
        0 1px 2px rgba(0,0,0,0.8),
        0 0 4px rgba(0,0,0,0.5);
      margin-bottom: 2px;
    `;
    this.element.appendChild(nameEl);

    // Create role element
    const roleEl = document.createElement('div');
    roleEl.textContent = role;
    roleEl.style.cssText = `
      font-size: 11px;
      font-weight: normal;
      color: #e0e0e0;
      text-shadow:
        0 1px 2px rgba(0,0,0,0.8),
        0 0 3px rgba(0,0,0,0.5);
    `;
    this.element.appendChild(roleEl);

    // Create CSS2DObject
    this.label = new CSS2DObject(this.element);
    this.label.position.set(0, 2.5, 0); // Position above character head
  }

  /**
   * Get the CSS2DObject to add to the scene
   */
  public getLabel(): CSS2DObject {
    return this.label;
  }

  /**
   * Update label visibility based on distance to camera
   */
  public updateVisibility(distanceToCamera: number): void {
    // Fade out when far away
    const maxDistance = 50;
    const minDistance = 5;

    if (distanceToCamera > maxDistance) {
      this.element.style.opacity = '0';
    } else if (distanceToCamera > minDistance) {
      const fade = 1 - (distanceToCamera - minDistance) / (maxDistance - minDistance);
      this.element.style.opacity = fade.toString();
    } else {
      this.element.style.opacity = '1';
    }
  }

  /**
   * Set label visibility
   */
  public setVisible(visible: boolean): void {
    this.element.style.display = visible ? 'block' : 'none';
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.element.remove();
  }
}
